/**
 * Query pipeline: triage → semantic retrieval → keyword-delta annotation.
 * Also powers Compare (keyword order vs. semantic rerank of the same pool).
 */
import { appConfig } from '../config/app.config.js'
import { modelsConfig } from '../config/models.config.js'
import { retrievalConfig } from '../config/retrieval.config.js'
import { runPipeline } from '../ml/pipeline/runner.js'
import { engine, searchVectors } from './engineService.js'
import { crossEncoderRerank, rerankAvailable } from './rerankService.js'
import { useStore } from '../state/store.js'

const DEVANAGARI_RE = /[ऀ-ॿ]/g

export function detectLocale(text) {
  const dev = (text.match(DEVANAGARI_RE) ?? []).length
  return dev > text.replace(/\s/g, '').length * 0.3 ? 'hi' : 'en'
}

export async function classifyQuery(queryVec) {
  const { routes, minConfidence } = useStore.getState()
  let best = null
  const scores = []
  for (const route of routes) {
    const proto = engine.prototypes.get(route.id)
    if (!proto) continue
    let dot = 0
    for (let d = 0; d < proto.length; d++) dot += proto[d] * queryVec[d]
    scores.push({ routeId: route.id, label: route.label, score: dot, gate: route.gate })
    if (!best || dot > best.score) best = { ...route, score: dot }
  }
  scores.sort((a, b) => b.score - a.score)
  const unclear = !best || best.score < minConfidence
  return {
    routeId: unclear ? 'unclear' : best.id,
    label: unclear ? 'Unclear' : best.label,
    confidence: best?.score ?? 0,
    gate: unclear ? false : Boolean(best.gate),
    scores,
  }
}

export async function runAsk(query) {
  const store = useStore.getState()
  const t0 = performance.now()
  store.patchAsk({ query, status: 'running', results: [], triage: null, timings: null, trace: [] })
  store.patchAnswer({ status: 'idle', claims: [], error: null })

  const pushTrace = (entry) => {
    if (entry.status === 'running') return
    useStore.getState().patchAsk({ trace: [...useStore.getState().ask.trace, entry] })
  }

  const stages = [
    {
      id: 'embed',
      label: 'Query embedding',
      async run(ctx) {
        const { vectors, dims, ms } = await engine.client.embed([query], 'query')
        ctx.queryVec = vectors.subarray(0, dims)
        useStore.getState().logEvent({ kind: 'embed', ms, n: 1, scope: 'query' })
      },
    },
    {
      id: 'triage',
      label: 'Zero-shot triage',
      async run(ctx) {
        const locale = detectLocale(query)
        const providerCfg = modelsConfig.embedding[useStore.getState().engine.provider]
        // a monolingual model must never gate a language it can't read
        ctx.triage =
          locale === 'hi' && !providerCfg?.multilingual
            ? {
                routeId: 'passthrough',
                label: 'Passed through — active model is not multilingual',
                confidence: 0,
                gate: false,
                scores: [],
              }
            : await classifyQuery(ctx.queryVec)
        ctx.triage.locale = locale
        if (ctx.triage.gate) ctx.halt = true
      },
    },
    {
      id: 'retrieve',
      label: 'Semantic recall',
      async run(ctx) {
        const { search } = retrievalConfig
        const hits = searchVectors(ctx.queryVec, search.topK * 3, { minScore: search.minScore })
        const bmHits = engine.bm25.search(query, 50)
        const bmRankByIdx = new Map(bmHits.map((h, rank) => [h.idx, rank + 1]))
        const state = useStore.getState()
        const chunks = state.corpus.chunks
        const docsSeen = new Map()
        const results = []
        const wantCount = rerankAvailable() && appConfig.features.rerank
          ? modelsConfig.rerank.candidates
          : appConfig.ui.askResultCount
        for (const hit of hits) {
          const chunk = chunks[hit.idx]
          if (!chunk) continue
          const used = docsSeen.get(chunk.docId) ?? 0
          if (used >= search.perDocCap) continue
          docsSeen.set(chunk.docId, used + 1)
          results.push({
            chunk,
            doc: state.corpus.docs.find((d) => d.id === chunk.docId),
            score: hit.score,
            semRank: results.length + 1,
            keywordRank: bmRankByIdx.get(hit.idx) ?? null,
          })
          if (results.length >= wantCount) break
        }
        ctx.results = results
      },
    },
    {
      id: 'rerank',
      label: 'Cross-encoder rerank',
      optional: true,
      when: (ctx) =>
        appConfig.features.rerank && rerankAvailable() && (ctx.results?.length ?? 0) > 1,
      async run(ctx) {
        const { rescored, backend } = await crossEncoderRerank(query, ctx.results)
        ctx.results = rescored
        ctx.rerankApplied = true
        ctx.stageDetail = { ...ctx.stageDetail, rerank: `${rescored.length} kept · ${backend}` }
      },
    },
  ]

  try {
    const ctx = await runPipeline(stages, {}, { onStage: pushTrace })
    const timings = Object.fromEntries(
      ctx.trace.map((s) => [`${s.id}Ms`, s.ms]),
    )
    if (ctx.triage.gate) {
      store.patchAsk({
        status: 'gated',
        triage: { ...ctx.triage, ms: timings.triageMs },
        timings: { ...timings, totalMs: performance.now() - t0 },
      })
      useStore.getState().logEvent({ kind: 'gate', ms: timings.triageMs, detail: query.slice(0, 60) })
      return
    }
    store.patchAsk({
      status: 'done',
      triage: { ...ctx.triage, ms: timings.triageMs },
      results: (ctx.results ?? []).slice(0, appConfig.ui.askResultCount),
      rerankApplied: Boolean(ctx.rerankApplied),
      timings: { ...timings, totalMs: performance.now() - t0 },
    })
    useStore.getState().logEvent({ kind: 'search', ms: performance.now() - t0, detail: query.slice(0, 60) })
  } catch (err) {
    store.patchAsk({ status: 'error', error: String(err.message ?? err) })
  }
}

export async function runCompare(query) {
  const store = useStore.getState()
  store.patchCompare({ query, status: 'running', keyword: [], reranked: [], timings: null })
  const t0 = performance.now()

  const chunks = store.corpus.chunks
  const tKw0 = performance.now()
  const kwHits = engine.bm25.search(query, retrievalConfig.rerank.candidates)
  const keywordMs = performance.now() - tKw0

  const { vectors, dims, ms: embedMs } = await engine.client.embed([query], 'query')
  const queryVec = vectors.subarray(0, dims)
  store.logEvent({ kind: 'embed', ms: embedMs, n: 1, scope: 'compare' })

  const tRr0 = performance.now()
  const scored = engine.vectors.scoreIndices(
    queryVec,
    kwHits.map((h) => h.idx),
  )
  const rerankMs = performance.now() - tRr0

  const keyword = kwHits.map((h, i) => ({
    chunk: chunks[h.idx],
    doc: store.corpus.docs.find((d) => d.id === chunks[h.idx]?.docId),
    score: h.score,
    rank: i + 1,
  }))
  const reranked = scored
    .map((s, i) => ({ ...keyword[i], semScore: s.score, keywordRank: i + 1 }))
    .sort((a, b) => b.semScore - a.semScore)
    .map((r, i) => ({ ...r, rank: i + 1, delta: r.keywordRank - (i + 1) }))

  store.patchCompare({
    status: 'done',
    keyword,
    reranked,
    timings: { keywordMs, embedMs, rerankMs, totalMs: performance.now() - t0 },
  })
}
