import { describe, it, expect } from 'vitest'
import { quantizeVectors, dotQuantized, quantizedTopK } from '../src/ml/index/quantize.js'
import { l2normalize } from '../src/ml/vectorStore.js'

/** Deterministic RNG (mulberry32) so error bounds never flake in CI. */
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

function floatDot(a, b) {
  let dot = 0
  for (let d = 0; d < a.length; d++) dot += a[d] * b[d]
  return dot
}

describe('quantizeVectors + dotQuantized', () => {
  it('approximates the float dot within 0.03 for normalized 256-d vectors', () => {
    const rng = mulberry32(1234)
    const dims = 256
    for (let trial = 0; trial < 100; trial++) {
      const a = randomUnitVector(rng, dims)
      const b = randomUnitVector(rng, dims)
      const qa = quantizeVectors(a, 1, dims)
      const qb = quantizeVectors(b, 1, dims)
      const approx = dotQuantized(qa.data, qa.scales[0], qb.data, qb.scales[0], dims)
      expect(Math.abs(approx - floatDot(a, b))).toBeLessThan(0.03)
    }
  })

  it('encodes the zero vector as all-zero codes with zero scale', () => {
    const { data, scales } = quantizeVectors(new Float32Array(8), 1, 8)
    expect(scales[0]).toBe(0)
    expect([...data].every((q) => q === 0)).toBe(true)
    expect(dotQuantized(data, scales[0], data, scales[0], 8)).toBe(0)
  })
})

describe('quantizedTopK', () => {
  it('recovers >= 4 of the exact top-5 on a 1000-vector set', () => {
    const rng = mulberry32(2026)
    const dims = 64
    const count = 1000
    const query = randomUnitVector(rng, dims)

    // Plant a handful of query-correlated vectors amid random noise so the
    // exact top-5 is meaningful, then check the int8 shortlist matches it.
    const vectors = Array.from({ length: count }, () => randomUnitVector(rng, dims))
    for (let i = 0; i < 12; i++) {
      const idx = Math.floor(rng() * count)
      const mixed = new Float32Array(dims)
      const noise = randomUnitVector(rng, dims)
      const blend = 0.3 + 0.5 * rng()
      for (let d = 0; d < dims; d++) mixed[d] = blend * query[d] + (1 - blend) * noise[d]
      vectors[idx] = l2normalize(mixed)
    }

    const flat = new Float32Array(count * dims)
    vectors.forEach((v, i) => flat.set(v, i * dims))
    const { data, scales } = quantizeVectors(flat, count, dims)

    const exact = vectors
      .map((v, idx) => ({ idx, score: floatDot(v, query) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
    const approx = quantizedTopK(query, { data, scales, count, dims }, 5)

    const exactSet = new Set(exact.map((h) => h.idx))
    const overlap = approx.filter((h) => exactSet.has(h.idx)).length
    expect(overlap).toBeGreaterThanOrEqual(4)
  })
})
