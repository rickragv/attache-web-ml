/**
 * Compact BM25 index over chunks. Unicode-aware tokenisation so Devanagari
 * documents index alongside English ones.
 */
/**
 * \p{M} is essential: Devanagari vowel signs, nukta and anusvara are
 * combining marks, and without it Hindi words shatter into single
 * consonants that the length filter then discards.
 */
const WORD_RE = /[\p{L}\p{M}\p{N}]+/gu

export function tokenize(text) {
  return (text.toLowerCase().match(WORD_RE) ?? []).filter((t) => t.length > 1)
}

export class BM25Index {
  constructor({ k1 = 1.4, b = 0.75 } = {}) {
    this.k1 = k1
    this.b = b
    this.docs = []
    this.df = new Map()
    this.avgLen = 0
  }

  build(chunks) {
    this.docs = chunks.map((c) => {
      const tf = new Map()
      const tokens = tokenize(`${c.heading} ${c.text}`)
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
      return { tf, len: tokens.length }
    })
    this.df = new Map()
    for (const d of this.docs) {
      for (const term of d.tf.keys()) this.df.set(term, (this.df.get(term) ?? 0) + 1)
    }
    this.avgLen = this.docs.reduce((s, d) => s + d.len, 0) / Math.max(1, this.docs.length)
  }

  search(query, k = 10) {
    const terms = tokenize(query)
    const N = this.docs.length
    const scores = new Float64Array(N)
    for (const term of terms) {
      const df = this.df.get(term)
      if (!df) continue
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))
      for (let i = 0; i < N; i++) {
        const tf = this.docs[i].tf.get(term)
        if (!tf) continue
        const norm = 1 - this.b + this.b * (this.docs[i].len / this.avgLen)
        scores[i] += idf * ((tf * (this.k1 + 1)) / (tf + this.k1 * norm))
      }
    }
    const hits = []
    for (let i = 0; i < N; i++) if (scores[i] > 0) hits.push({ idx: i, score: scores[i] })
    hits.sort((a, b) => b.score - a.score)
    return hits.slice(0, k)
  }
}
