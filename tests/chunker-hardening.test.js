import { describe, it, expect } from 'vitest'
import { chunkDocument } from '../src/ml/chunker.js'
import { retrievalConfig } from '../src/config/retrieval.config.js'

const cfg = retrievalConfig.chunking

/** Regressions found while indexing a real 344-doc corpus (github/docs). */
describe('chunkDocument hardening', () => {
  it('survives empty headings left behind by template stripping', () => {
    const doc = { id: 'tpl', title: 'T', body: '## \n\nreal paragraph text here\n\n### \n\nmore text' }
    expect(() => chunkDocument(doc, cfg)).not.toThrow()
    const chunks = chunkDocument(doc, cfg)
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0].heading).toBe('T')
  })

  it('survives documents that are only headings', () => {
    const doc = { id: 'h', title: 'H', body: '# One\n## Two\n### Three' }
    expect(chunkDocument(doc, cfg)).toHaveLength(0)
  })

  it('bounds chunks even when the source has no blank lines (PDF tables)', () => {
    const row = 'Director Name | $415,000 | $250,000 | $665,000'
    const doc = { id: 'tbl', title: 'T', body: Array.from({ length: 200 }, () => row).join('\n') }
    const chunks = chunkDocument(doc, cfg)
    expect(chunks.length).toBeGreaterThan(3)
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(cfg.targetChars + cfg.overlapChars + 100)
    }
  })

  it('survives empty and whitespace-only bodies', () => {
    expect(chunkDocument({ id: 'e', title: 'E', body: '' }, cfg)).toHaveLength(0)
    expect(chunkDocument({ id: 'w', title: 'W', body: '  \n\n  ' }, cfg)).toHaveLength(0)
  })
})
