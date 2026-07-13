import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from '../src/services/frontmatter.js'

describe('parseFrontmatter', () => {
  it('parses scalars, quoted strings and inline arrays', () => {
    const { meta, body } = parseFrontmatter(
      `---\nid: kb-1\ntitle: "Refund timelines"\ntags: [refunds, "settlements"]\nlocale: en\n---\n\nBody text.`,
    )
    expect(meta.id).toBe('kb-1')
    expect(meta.title).toBe('Refund timelines')
    expect(meta.tags).toEqual(['refunds', 'settlements'])
    expect(body).toBe('Body text.')
  })

  it('returns raw body when no frontmatter present', () => {
    const { meta, body } = parseFrontmatter('Just text, no fences.')
    expect(meta).toEqual({})
    expect(body).toBe('Just text, no fences.')
  })

  it('handles CRLF line endings', () => {
    const { meta, body } = parseFrontmatter('---\r\nid: x\r\n---\r\ncontent')
    expect(meta.id).toBe('x')
    expect(body).toBe('content')
  })

  it('ignores malformed lines instead of throwing', () => {
    const { meta } = parseFrontmatter('---\nid: ok\n:::garbage:::\n---\nbody')
    expect(meta.id).toBe('ok')
  })
})
