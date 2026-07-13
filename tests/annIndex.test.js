import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AnnIndex } from '../src/ml/index/annIndex.js'
import { l2normalize } from '../src/ml/vectorStore.js'

/** Deterministic RNG (mulberry32) so recall numbers never flake in CI. */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomUnitVector(rng, dims) {
  const v = new Float32Array(dims)
  for (let d = 0; d < dims; d++) {
    // Box-Muller gaussian keeps directions uniform on the unit sphere.
    v[d] = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng())
  }
  return l2normalize(v)
}

function bruteForceTopK(vectors, query, k) {
  const hits = vectors.map((v, idx) => {
    let dot = 0
    for (let d = 0; d < v.length; d++) dot += v[d] * query[d]
    return { idx, score: dot }
  })
  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, k)
}

function buildIndex(vectors, dims, options = {}) {
  const index = new AnnIndex({ dims, ...options })
  vectors.forEach((v, i) => index.add(`v${i}`, v))
  return index
}

describe('AnnIndex', () => {
  beforeEach(() => {
    // add() uses Math.random for level assignment; pin it so graph shape
    // (and therefore recall) is identical on every run.
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(0xc0ffee))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('achieves >= 0.9 average top-10 recall vs brute force on 2000 vectors', () => {
    const rng = mulberry32(42)
    const dims = 64
    const vectors = Array.from({ length: 2000 }, () => randomUnitVector(rng, dims))
    // Random isotropic vectors are the adversarial case for ANN; per standard
    // HNSW practice we widen the search beam to ~10x k for high-recall top-10.
    const index = buildIndex(vectors, dims, { efSearch: 96 })
    expect(index.size).toBe(2000)

    let recallSum = 0
    const queries = 20
    for (let q = 0; q < queries; q++) {
      const query = randomUnitVector(rng, dims)
      const exact = new Set(bruteForceTopK(vectors, query, 10).map((h) => h.idx))
      const approx = index.search(query, 10)
      const found = approx.filter((h) => exact.has(h.idx)).length
      recallSum += found / 10
    }
    expect(recallSum / queries).toBeGreaterThanOrEqual(0.9)
  })

  it('round-trips through serialize/hydrate with identical search results', () => {
    const rng = mulberry32(7)
    const dims = 32
    const vectors = Array.from({ length: 300 }, () => randomUnitVector(rng, dims))
    const index = buildIndex(vectors, dims)
    const clone = AnnIndex.hydrate(index.serialize())

    expect(clone.size).toBe(index.size)
    for (let q = 0; q < 5; q++) {
      const query = randomUnitVector(rng, dims)
      const original = index.search(query, 5)
      const restored = clone.search(query, 5)
      expect(restored.map((h) => h.key)).toEqual(original.map((h) => h.key))
      restored.forEach((h, i) => expect(h.score).toBeCloseTo(original[i].score, 6))
    }
  })

  it('supports incremental add after hydrate', () => {
    const rng = mulberry32(99)
    const dims = 32
    const vectors = Array.from({ length: 200 }, () => randomUnitVector(rng, dims))
    const clone = AnnIndex.hydrate(buildIndex(vectors, dims).serialize())

    const target = randomUnitVector(rng, dims)
    clone.add('needle', target)
    for (let i = 0; i < 49; i++) clone.add(`extra${i}`, randomUnitVector(rng, dims))

    expect(clone.size).toBe(250)
    const hits = clone.search(target, 3)
    expect(hits[0].key).toBe('needle')
    expect(hits[0].score).toBeCloseTo(1, 4)
  })
})
