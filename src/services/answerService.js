/**
 * Track A capstone: Gemma drafts a cited answer from the top passages while
 * an NLI model verifies each completed sentence against its cited chunk.
 * Verification is pipelined — claim N verifies while Gemma is still
 * generating claim N+2.
 */
import { appConfig } from '../config/app.config.js'
import { modelsConfig } from '../config/models.config.js'
import { initGemma, generateAnswer } from '../ml/llm/gemmaProvider.js'
import { createBertClassifier, softmax } from '../ml/scoring/bertClassifier.js'
import { useStore } from '../state/store.js'

let nli = null
let nliInit = null

async function ensureNli() {
  if (!appConfig.features.verifyClaims || !modelsConfig.nli?.enabled) return null
  if (nli?.ready) return nli
  if (!nliInit) {
    nli = createBertClassifier(modelsConfig.nli)
    nliInit = nli.init({ offline: useStore.getState().offlineDrill }).catch(() => {
      nli = null
      nliInit = null
      return null
    })
  }
  await nliInit
  return nli?.ready ? nli : null
}

export async function runAnswer(query, results) {
  const store = useStore.getState()
  const passages = results.slice(0, 4)
  store.patchAnswer({
    status: 'loading-model',
    claims: [],
    error: null,
    tokensPerSec: 0,
    verifier: 'pending',
  })

  try {
    await initGemma(modelsConfig.llm.gemma, {
      onStatus: (s) => useStore.getState().patchAnswer({ modelPhase: s.phase }),
    })
  } catch (err) {
    store.patchAnswer({ status: 'error', error: String(err.message ?? err) })
    return
  }

  // NLI warms up concurrently with generation — never blocks tokens.
  const nliPromise = ensureNli().then((v) => {
    useStore.getState().patchAnswer({ verifier: v ? 'active' : 'unavailable' })
    return v
  })

  useStore.getState().patchAnswer({ status: 'generating' })
  const t0 = performance.now()
  const verifyQueue = []
  let seenClaims = 0

  const onProgress = (fullText, done) => {
    const claims = splitClaims(fullText, done)
    const state = useStore.getState()
    const existing = state.answer.claims
    const merged = claims.map((c, i) => ({
      ...c,
      status: existing[i]?.status ?? 'pending',
      entailment: existing[i]?.entailment ?? null,
    }))
    state.patchAnswer({
      claims: merged,
      tokensPerSec: Math.round(fullText.length / 4 / ((performance.now() - t0) / 1000)),
      status: done ? 'verifying' : 'generating',
    })
    // every claim that is now COMPLETE (a later claim exists, or generation
    // ended) enters the verify queue exactly once
    const completeCount = done ? merged.length : Math.max(0, merged.length - 1)
    for (let i = seenClaims; i < completeCount; i++) {
      verifyQueue.push(verifyClaim(i, merged[i], passages, nliPromise))
      seenClaims = i + 1
    }
  }

  try {
    await generateAnswer(query, passages, onProgress)
    await Promise.allSettled(verifyQueue)
    const finalClaims = useStore.getState().answer.claims
    useStore.getState().patchAnswer({
      status: 'done',
      supported: finalClaims.filter((c) => c.status === 'supported').length,
      total: finalClaims.length,
    })
    useStore.getState().logEvent({ kind: 'answer', ms: performance.now() - t0, detail: query.slice(0, 50) })
  } catch (err) {
    useStore.getState().patchAnswer({ status: 'error', error: String(err.message ?? err) })
  }
}

async function verifyClaim(index, claim, passages, nliPromise) {
  const verifier = await nliPromise
  const patch = (fields) =>
    useStore.getState().patchAnswer({
      claims: useStore.getState().answer.claims.map((c, i) => (i === index ? { ...c, ...fields } : c)),
    })

  if (!verifier) {
    patch({ status: 'unverified' })
    return
  }
  if (!claim.text || claim.text.length < 12) {
    patch({ status: 'unverified' })
    return
  }

  // premise = the cited passages (or all of them when the model cited none)
  const cited = claim.cites.length
    ? claim.cites.map((n) => passages[n - 1]).filter(Boolean)
    : passages
  const premise = cited.map((p) => `${p.chunk.heading}. ${p.chunk.text}`).join('\n').slice(0, 1600)

  try {
    const logits = await verifier.scorePairs([[premise, claim.text]])
    const probs = softmax(Array.from(logits))
    const labels = modelsConfig.nli.labels
    const entailment = probs[labels.indexOf('entailment')]
    const contradiction = probs[labels.indexOf('contradiction')]
    /**
     * Calibration: MNLI is precise on contradictions but conservatively
     * "neutral" on instruction-style paraphrases. Red is reserved for
     * contradiction; anything the model can't entail is amber, not red.
     */
    patch({
      entailment,
      status:
        entailment >= modelsConfig.nli.minEntailment
          ? 'supported'
          : contradiction > 0.5
            ? 'contradicted'
            : 'uncertain',
    })
  } catch {
    patch({ status: 'unverified' })
  }
}

/**
 * Splits streaming answer text into claims: sentences with their [n]
 * citation markers. The final fragment is only a claim once generation is
 * done (it may still be mid-sentence).
 */
export function splitClaims(text, done) {
  const clean = text.replace(/^Answer:\s*/i, '').trim()
  if (!clean) return []
  // protect code spans so periods inside `...` never split a sentence
  const shielded = clean.replace(/`[^`]*`/g, (m) => m.replace(/\./g, '․').replace(/!/g, 'ǃ').replace(/\?/g, '⸮'))
  const parts =
    shielded.match(/[^.!?\n]+[.!?]?(\s*\[\d+\](?:\s*,\s*\[\d+\])*)*[.!?]?\s*/g) ?? [shielded]
  const claims = []
  for (const part of parts) {
    const text = part.replace(/․/g, '.').replace(/ǃ/g, '!').replace(/⸮/g, '?').trim()
    if (!text) continue
    const cites = [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]))
    // fragments that are only citations/punctuation belong to the previous claim
    if (claims.length && /^[\s,;.]*(\[\d+\][\s,;.]*)*$/.test(text)) {
      const prev = claims[claims.length - 1]
      prev.text = `${prev.text} ${text}`.trim()
      prev.cites = [...new Set([...prev.cites, ...cites])]
      continue
    }
    // small LLMs loop — collapse consecutive duplicate sentences
    if (claims.length && claims[claims.length - 1].text.replace(/\[\d+\]/g, '').trim() ===
        text.replace(/\[\d+\]/g, '').trim()) {
      continue
    }
    claims.push({ text, cites: [...new Set(cites)] })
  }
  if (!done && claims.length && !/[.!?]\s*(\[\d+\])*\s*$/.test(claims[claims.length - 1].text)) {
    claims[claims.length - 1].partial = true
  }
  return claims
}
