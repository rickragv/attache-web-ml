import { describe, it, expect } from 'vitest'
import { VectorStore, l2normalize, meanVector } from '../src/ml/vectorStore.js'

const vec = (...vals) => l2normalize(Float32Array.from(vals))

describe('l2normalize', () => {
  it('produces unit vectors and tolerates the zero vector', () => {
    const v = l2normalize(Float32Array.from([3, 4]))
    expect(Math.hypot(...v)).toBeCloseTo(1, 5)
    expect([...l2normalize(Float32Array.from([0, 0]))]).toEqual([0, 0])
  })
})

describe('VectorStore', () => {
  it('appends batches and retrieves nearest by dot product', () => {
    const vs = new VectorStore()
    const a = vec(1, 0, 0)
    const b = vec(0, 1, 0)
    const c = vec(0.9, 0.1, 0)
    const flat = new Float32Array([...a, ...b, ...c])
    vs.append(['a', 'b', 'c'], flat, 3)

    const hits = vs.topK(vec(1, 0.05, 0), 2)
    expect(hits[0].key).toBe('a')
    expect(hits[1].key).toBe('c')
  })

  it('rejects mismatched dimensions', () => {
    const vs = new VectorStore()
    vs.append(['a'], vec(1, 0, 0), 3)
    expect(() => vs.append(['b'], vec(1, 0), 2)).toThrow(/dims/i)
  })

  it('applies minScore as a floor', () => {
    const vs = new VectorStore()
    vs.append(['a', 'b'], new Float32Array([...vec(1, 0), ...vec(-1, 0)]), 2)
    const hits = vs.topK(vec(1, 0), 5, { minScore: 0 })
    expect(hits.map((h) => h.key)).toEqual(['a'])
  })

  it('round-trips through serialize/hydrate', () => {
    const vs = new VectorStore()
    vs.append(['a', 'b'], new Float32Array([...vec(1, 0), ...vec(0, 1)]), 2)
    const clone = VectorStore.hydrate(vs.serialize())
    expect(clone.count).toBe(2)
    expect(clone.topK(vec(0, 1), 1)[0].key).toBe('b')
  })

  it('scoreIndices matches topK scoring', () => {
    const vs = new VectorStore()
    vs.append(['a', 'b'], new Float32Array([...vec(1, 0), ...vec(0, 1)]), 2)
    const q = vec(0.6, 0.8)
    const scored = vs.scoreIndices(q, [0, 1])
    expect(scored[1].score).toBeGreaterThan(scored[0].score)
  })
})

describe('meanVector', () => {
  it('returns the normalised centroid', () => {
    const m = meanVector([vec(1, 0), vec(0, 1)], 2)
    expect(m[0]).toBeCloseTo(m[1], 5)
    expect(Math.hypot(...m)).toBeCloseTo(1, 5)
  })
})
