import { describe, it, expect } from 'vitest'
import { extractPatterns } from '../src/ml/ner/entityExtractor.js'

describe('extractPatterns', () => {
  it('finds INR amounts in ₹ and Rs forms', () => {
    const found = extractPatterns('Net settlement of Rs 4,61,249.38 and a fee of ₹4 per refund.')
    const amounts = found.filter((e) => e.type === 'AMOUNT').map((e) => e.surface)
    expect(amounts.length).toBe(2)
  })

  it('finds dates in prose and ISO form', () => {
    const found = extractPatterns('Effective 12 July 2026, replacing the 2026-03-12 policy.')
    expect(found.filter((e) => e.type === 'DATE')).toHaveLength(2)
  })

  it('finds reference IDs and emails', () => {
    const found = extractPatterns('Quote UTR AXISN52026071209871234 or write to ops@meridianpay.in about setl_9K2mNQ84LxPw.')
    const types = found.map((e) => e.type)
    expect(types).toContain('ID')
    expect(types).toContain('EMAIL')
    expect(found.filter((e) => e.type === 'ID')).toHaveLength(2)
  })

  it('returns nothing on entity-free prose', () => {
    expect(extractPatterns('the quick brown fox jumps over the lazy dog')).toHaveLength(0)
  })
})
