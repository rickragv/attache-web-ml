/**
 * Entity extraction for the Workspace knowledge graph.
 *
 * Two layers, always both:
 *  - neural NER (DistilBERT token classifier on LiteRT) → PER/ORG/LOC/MISC,
 *    decoded from BIO tags with WordPiece de-subwording
 *  - pattern extraction (amounts, dates, emails, reference IDs) — these are
 *    the entities small NER models are worst at, and they double as the
 *    whole extractor when the model is unavailable.
 */
import { modelsConfig } from '../../config/models.config.js'
import { cachedFetch } from '../modelCache.js'
import { createBertClassifier, softmax } from '../scoring/bertClassifier.js'
import { useStore } from '../../state/store.js'

let classifier = null
let idToToken = null
let initPromise = null

export async function ensureNer() {
  const cfg = modelsConfig.ner
  if (!cfg?.enabled) return null
  if (classifier?.ready) return classifier
  if (!initPromise) {
    classifier = createBertClassifier(cfg)
    initPromise = (async () => {
      const vocab = await cachedFetch(cfg.vocabUrl, { offline: useStore.getState().offlineDrill })
      idToToken = new TextDecoder().decode(vocab.buffer).split(/\r?\n/)
      await classifier.init({ offline: useStore.getState().offlineDrill })
    })().catch(() => {
      classifier = null
      initPromise = null
      return null
    })
  }
  await initPromise
  return classifier?.ready ? classifier : null
}

/** @returns [{surface, type, count}] aggregated over the text */
export async function extractEntities(text) {
  const found = extractPatterns(text)
  const ner = await ensureNer()
  if (ner) {
    try {
      found.push(...decodeNer(await ner.classifyTokens(text)))
    } catch {
      /* model hiccup — patterns still stand */
    }
  }
  return aggregate(found)
}

export function nerActive() {
  return Boolean(classifier?.ready)
}

/* ------------------------------------------------------------------ */

function decodeNer({ ids, mask, logits }) {
  const cfg = modelsConfig.ner
  const labels = cfg.labels
  const n = labels.length
  const entities = []
  let current = null

  const flush = () => {
    if (current && current.pieces.length) {
      const surface = joinPieces(current.pieces)
      if (surface.length > 1) entities.push({ surface, type: current.type })
    }
    current = null
  }

  for (let i = 0; i < ids.length; i++) {
    if (!mask[i]) break
    const token = idToToken[ids[i]] ?? ''
    if (token.startsWith('[')) continue // [CLS]/[SEP]/[PAD]
    const row = Array.from(logits.subarray(i * n, (i + 1) * n))
    const probs = softmax(row)
    const best = probs.indexOf(Math.max(...probs))
    const label = labels[best]

    if (label === 'O' || probs[best] < cfg.minScore) {
      // subword continuations inherit the open entity even when tagged O
      if (current && token.startsWith('##')) current.pieces.push(token)
      else flush()
      continue
    }
    const [bi, type] = label.split('-')
    if (bi === 'B' || !current || current.type !== type) {
      if (!(token.startsWith('##') && current)) {
        flush()
        current = { type, pieces: [token] }
        continue
      }
    }
    current.pieces.push(token)
  }
  flush()
  return entities
}

function joinPieces(pieces) {
  let out = ''
  for (const p of pieces) {
    out += p.startsWith('##') ? p.slice(2) : (out ? ' ' : '') + p
  }
  return titleCase(out.trim())
}

/* ------------------------------------------------------------------ */

const PATTERNS = [
  // case-sensitive + word-bounded: "Rs" must be the currency marker, never
  // the tail of "years"/"directors"
  { type: 'AMOUNT', re: /(?:₹|\bRs\.?\s|\bUSD\s|\$)\s?[\d,]+(?:\.\d{1,2})?(?:\s?(?:lakh|crore|million|billion))?/g },
  { type: 'DATE', re: /\b\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s\d{4}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s\d{1,2},?\s\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g },
  { type: 'EMAIL', re: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g },
  { type: 'ID', re: /\b(?:[A-Z]{3,}\d[\w-]{4,}|(?:setl|rfnd|pay|evt|ord)_[A-Za-z0-9]{6,})\b/g },
]

export function extractPatterns(text) {
  const out = []
  for (const { type, re } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      out.push({ surface: m[0].trim(), type })
    }
  }
  return out
}

function aggregate(list) {
  const byKey = new Map()
  for (const e of list) {
    const surface = sanitize(e.surface)
    if (!surface) continue
    const key = `${e.type}:${surface.toLowerCase()}`
    const hit = byKey.get(key)
    if (hit) hit.count += 1
    else byKey.set(key, { surface, type: e.type, count: 1 })
  }
  return [...byKey.values()]
}

/** Real-corpus NER emits fragments ("& Co .", "rs ,") — clean or drop them. */
function sanitize(surface) {
  const s = surface
    .replace(/\s+([.,;:!?'])/g, '$1') // no space before punctuation
    .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, (m) => (/[₹$]/.test(m) ? m : '')) // trim edge punctuation, keep currency
    .replace(/\s{2,}/g, ' ')
    .trim()
  const letters = (s.match(/[\p{L}\p{N}]/gu) ?? []).length
  // currency-marked surfaces ("₹4") are legitimate even when short
  if (letters < 3 && !/[₹$]|\bRs\b/.test(s)) return null
  return s
}

function titleCase(s) {
  // NER runs on lowercased WordPiece output — restore readable casing
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}
