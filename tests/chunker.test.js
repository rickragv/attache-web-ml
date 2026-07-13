import { describe, it, expect } from 'vitest'
import { chunkDocument } from '../src/ml/chunker.js'
import { retrievalConfig } from '../src/config/retrieval.config.js'

const cfg = retrievalConfig.chunking

const para = (n, marker) => `${marker} sentence ${'word '.repeat(n)}.`.trim()

describe('chunkDocument', () => {
  it('produces stable keys and sequential seq numbers', () => {
    const doc = {
      id: 'doc-a',
      title: 'Doc A',
      body: [para(80, 'p1'), para(80, 'p2'), para(80, 'p3'), para(80, 'p4')].join('\n\n'),
    }
    const chunks = chunkDocument(doc, cfg)
    expect(chunks.length).toBeGreaterThan(1)
    chunks.forEach((c, i) => {
      expect(c.key).toBe(`doc-a#${i}`)
      expect(c.seq).toBe(i)
      expect(c.docId).toBe('doc-a')
    })
  })

  it('carries the nearest heading into each chunk', () => {
    const doc = {
      id: 'doc-h',
      title: 'Doc H',
      body: `intro paragraph with enough words ${'x '.repeat(60)}\n\n## Refund timelines\n\n${para(120, 'about refunds')}\n\n${para(120, 'more refunds')}`,
    }
    const chunks = chunkDocument(doc, cfg)
    const last = chunks[chunks.length - 1]
    expect(last.heading).toBe('Refund timelines')
    expect(chunks[0].heading).toBe('Doc H')
  })

  it('keeps every chunk within a sane size envelope', () => {
    const doc = { id: 'big', title: 'Big', body: para(30, 'a') + ('\n\n' + para(90, 'b')).repeat(30) }
    const chunks = chunkDocument(doc, cfg)
    for (const c of chunks) {
      expect(c.text.length).toBeLessThan(cfg.targetChars + cfg.overlapChars + 800)
    }
  })

  it('merges a runt final chunk into its predecessor', () => {
    const doc = { id: 'runt', title: 'R', body: `${para(200, 'main')}\n\ntiny tail.` }
    const chunks = chunkDocument(doc, cfg)
    expect(chunks[chunks.length - 1].text).toContain('tiny tail.')
    expect(chunks[chunks.length - 1].text.length).toBeGreaterThanOrEqual(cfg.minChars)
  })

  it('never returns empty chunks for a non-empty document', () => {
    const chunks = chunkDocument({ id: 'e', title: 'E', body: 'one short line' }, cfg)
    expect(chunks.length).toBe(1)
    expect(chunks[0].text).toBe('one short line')
  })
})
