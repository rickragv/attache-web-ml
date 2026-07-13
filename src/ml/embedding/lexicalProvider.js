/**
 * Degraded-tier provider: hashed bag-of-words + bigrams. No download, no
 * semantics — exists so dev environments and CI always boot, and so the HUD
 * has something honest to display when neither model path is available.
 */
import { tokenize } from '../bm25.js'
import { l2normalize } from '../vectorStore.js'

export function createLexicalProvider(cfg) {
  return {
    id: cfg.id,
    label: cfg.label,
    runtime: cfg.runtime,
    quality: cfg.quality,

    async init() {
      return { backend: 'js', dims: cfg.dims }
    },

    async embed(texts) {
      const out = new Float32Array(texts.length * cfg.dims)
      for (let t = 0; t < texts.length; t++) {
        const vec = new Float32Array(cfg.dims)
        const tokens = tokenize(texts[t])
        for (let i = 0; i < tokens.length; i++) {
          vec[fnv1a(tokens[i]) % cfg.dims] += 1
          if (i > 0) vec[fnv1a(tokens[i - 1] + '_' + tokens[i]) % cfg.dims] += 0.5
        }
        out.set(l2normalize(vec), t * cfg.dims)
      }
      return { vectors: out, dims: cfg.dims }
    },
  }
}

function fnv1a(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
