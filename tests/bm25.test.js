import { describe, it, expect } from 'vitest'
import { BM25Index, tokenize } from '../src/ml/bm25.js'

const chunks = [
  { heading: 'Refunds', text: 'Refunds are debited from your next settlement batch. Refund timelines depend on the bank.' },
  { heading: 'Webhooks', text: 'Verify the webhook signature using the shared secret. Retry with exponential backoff.' },
  { heading: 'KYC', text: 'Upload PAN and bank proof for KYC verification. Verification completes in two days.' },
  { heading: 'रिफ़ंड', text: 'रिफ़ंड की स्थिति डैशबोर्ड में देखें। बैंक तीन दिन में क्रेडिट करता है।' },
]

describe('tokenize', () => {
  it('handles Devanagari alongside Latin', () => {
    const tokens = tokenize('रिफ़ंड status UPI 123')
    expect(tokens).toContain('status')
    expect(tokens).toContain('123')
    expect(tokens.some((t) => /[ऀ-ॿ]/.test(t))).toBe(true)
  })
})

describe('BM25Index', () => {
  const idx = new BM25Index()
  idx.build(chunks)

  it('ranks the on-topic chunk first', () => {
    const hits = idx.search('refund settlement timelines', 4)
    expect(hits[0].idx).toBe(0)
  })

  it('finds Hindi content with a Hindi query', () => {
    const hits = idx.search('रिफ़ंड स्थिति', 4)
    expect(hits.map((h) => h.idx)).toContain(3)
  })

  it('returns no hits for out-of-vocabulary queries', () => {
    expect(idx.search('zzzz qqqq', 4)).toHaveLength(0)
  })

  it('respects the k limit and sorts descending', () => {
    const hits = idx.search('verification bank refund', 2)
    expect(hits.length).toBeLessThanOrEqual(2)
    for (let i = 1; i < hits.length; i++) expect(hits[i].score).toBeLessThanOrEqual(hits[i - 1].score)
  })
})
