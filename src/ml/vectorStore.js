/**
 * In-memory vector matrix with cosine top-k. All vectors are L2-normalised
 * at write time, so similarity is a dot product. Rows align with chunk
 * indices held by the corpus store.
 */
export class VectorStore {
  constructor() {
    this.dims = 0
    this.count = 0
    this.matrix = new Float32Array(0)
    this.keys = []
  }

  reset(dims) {
    this.dims = dims
    this.count = 0
    this.matrix = new Float32Array(0)
    this.keys = []
  }

  append(keys, flatVectors, dims) {
    if (this.dims === 0) this.dims = dims
    if (dims !== this.dims) throw new Error(`Vector dims mismatch: ${dims} vs ${this.dims}`)
    const added = keys.length
    const next = new Float32Array((this.count + added) * this.dims)
    next.set(this.matrix)
    next.set(flatVectors, this.count * this.dims)
    this.matrix = next
    this.keys.push(...keys)
    this.count += added
  }

  /** @returns [{idx, key, score}] sorted desc */
  topK(queryVec, k, { minScore = -Infinity } = {}) {
    const { dims, count, matrix } = this
    const hits = []
    for (let i = 0; i < count; i++) {
      let dot = 0
      const off = i * dims
      for (let d = 0; d < dims; d++) dot += matrix[off + d] * queryVec[d]
      if (dot >= minScore) hits.push({ idx: i, key: this.keys[i], score: dot })
    }
    hits.sort((a, b) => b.score - a.score)
    return hits.slice(0, k)
  }

  scoreIndices(queryVec, indices) {
    const { dims, matrix } = this
    return indices.map((i) => {
      let dot = 0
      const off = i * dims
      for (let d = 0; d < dims; d++) dot += matrix[off + d] * queryVec[d]
      return { idx: i, score: dot }
    })
  }

  serialize() {
    return { dims: this.dims, count: this.count, keys: this.keys, buffer: this.matrix.buffer }
  }

  static hydrate({ dims, count, keys, buffer }) {
    const vs = new VectorStore()
    vs.dims = dims
    vs.count = count
    vs.keys = keys
    vs.matrix = new Float32Array(buffer)
    return vs
  }
}

export function l2normalize(vec) {
  let sum = 0
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i]
  const inv = sum > 0 ? 1 / Math.sqrt(sum) : 0
  for (let i = 0; i < vec.length; i++) vec[i] *= inv
  return vec
}

export function meanVector(vectors, dims) {
  const out = new Float32Array(dims)
  for (const v of vectors) for (let d = 0; d < dims; d++) out[d] += v[d]
  for (let d = 0; d < dims; d++) out[d] /= vectors.length
  return l2normalize(out)
}
