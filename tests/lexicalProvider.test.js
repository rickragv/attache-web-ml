import { describe, it, expect } from 'vitest'
import { createLexicalProvider } from '../src/ml/embedding/lexicalProvider.js'

const cfg = { id: 'lexical', label: 'Lexical', runtime: 'JS', quality: 'degraded', dims: 512 }

describe('lexicalProvider', () => {
  it('initialises without any network access', async () => {
    const p = createLexicalProvider(cfg)
    const { backend, dims } = await p.init()
    expect(backend).toBe('js')
    expect(dims).toBe(512)
  })

  it('is deterministic and normalised', async () => {
    const p = createLexicalProvider(cfg)
    await p.init()
    const a = await p.embed(['refund settlement delay'])
    const b = await p.embed(['refund settlement delay'])
    expect([...a.vectors]).toEqual([...b.vectors])
    const norm = Math.hypot(...a.vectors)
    expect(norm).toBeCloseTo(1, 4)
  })

  it('scores overlapping text higher than unrelated text', async () => {
    const p = createLexicalProvider(cfg)
    await p.init()
    const { vectors, dims } = await p.embed([
      'refund settlement delay',
      'refund settlement arrived late',
      'webhook signature verification',
    ])
    const dot = (i, j) => {
      let s = 0
      for (let d = 0; d < dims; d++) s += vectors[i * dims + d] * vectors[j * dims + d]
      return s
    }
    expect(dot(0, 1)).toBeGreaterThan(dot(0, 2))
  })

  it('packs multiple texts contiguously', async () => {
    const p = createLexicalProvider(cfg)
    await p.init()
    const r = await p.embed(['one', 'two', 'three'])
    expect(r.vectors.length).toBe(3 * cfg.dims)
  })
})
