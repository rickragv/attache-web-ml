/**
 * Stage-2 precision rerank: cross-encoder re-scores the bi-encoder's
 * candidate list. Lazy singleton — the 91 MB model loads on the first query
 * that reaches this stage, and a failed init degrades honestly (bi-encoder
 * order stands, the pipeline trace says why).
 */
import { modelsConfig } from '../config/models.config.js'
import { createBertClassifier, sigmoid } from '../ml/scoring/bertClassifier.js'
import { useStore } from '../state/store.js'

let classifier = null
let initPromise = null

export function rerankAvailable() {
  return Boolean(modelsConfig.rerank?.enabled)
}

export function rerankReady() {
  return Boolean(classifier?.ready)
}

async function ensureClassifier() {
  if (classifier?.ready) return classifier
  if (!initPromise) {
    classifier = createBertClassifier(modelsConfig.rerank)
    initPromise = classifier
      .init({
        offline: useStore.getState().offlineDrill,
        onStatus: (s) => useStore.getState().patchEngine({ progress: { provider: 'rerank', ...s } }),
      })
      .then(() => useStore.getState().patchEngine({ progress: null }))
      .catch((err) => {
        initPromise = null
        classifier = null
        throw err
      })
  }
  await initPromise
  return classifier
}

/**
 * Re-scores results[] (each {chunk, score, ...}) against the query.
 * Returns the top `keep`, re-ordered, each annotated with crossScore.
 */
export async function crossEncoderRerank(query, results) {
  const cfg = modelsConfig.rerank
  const clf = await ensureClassifier()
  const candidates = results.slice(0, cfg.candidates)
  const pairs = candidates.map((r) => [query, `${r.chunk.heading}\n${r.chunk.text}`])
  const t0 = performance.now()
  const logits = await clf.scorePairs(pairs)
  const ms = performance.now() - t0
  useStore.getState().logEvent({ kind: 'rerank', ms, n: pairs.length })

  const rescored = candidates
    .map((r, i) => ({ ...r, crossScore: sigmoid(logits[i]) }))
    .sort((a, b) => b.crossScore - a.crossScore)
    .slice(0, cfg.keep)
    .map((r, i) => ({ ...r, biRank: r.semRank, semRank: i + 1 }))
  return { rescored, ms, backend: clf.backend }
}
