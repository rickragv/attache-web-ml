import { describe, it, expect } from 'vitest'
import { splitClaims } from '../src/services/answerService.js'
import { truncateAtRunaway } from '../src/services/workspaceService.js'

describe('truncateAtRunaway', () => {
  it('cuts hallucinated User:/Assistant: turns from chat output', () => {
    const runaway =
      'The directors received $415,000 each [1].\nUser: How is it determined? Assistant: made up'
    expect(truncateAtRunaway(runaway)).toBe('The directors received $415,000 each [1].')
  })
  it('leaves clean answers untouched', () => {
    expect(truncateAtRunaway('A clean answer [2].')).toBe('A clean answer [2].')
  })
  it('does not cut inline mentions of the word user', () => {
    expect(truncateAtRunaway('The user guide says X [1].')).toBe('The user guide says X [1].')
  })
})

describe('splitClaims', () => {
  it('splits sentences and extracts citation markers', () => {
    const claims = splitClaims(
      'Refunds are debited from the next settlement batch [1]. UPI refunds credit within a day [2][3].',
      true,
    )
    expect(claims).toHaveLength(2)
    expect(claims[0].cites).toEqual([1])
    expect(claims[1].cites).toEqual([2, 3])
  })

  it('marks the trailing fragment partial while streaming', () => {
    const claims = splitClaims('First sentence is done [1]. The second is still being', false)
    expect(claims[0].partial).toBeUndefined()
    expect(claims[claims.length - 1].partial).toBe(true)
  })

  it('does not mark anything partial once generation is done', () => {
    const claims = splitClaims('Only sentence, no terminal punctuation', true)
    expect(claims[0].partial).toBeUndefined()
  })

  it('deduplicates repeated citations within one claim', () => {
    const claims = splitClaims('Same source twice [1] and again [1].', true)
    expect(claims[0].cites).toEqual([1])
  })

  it('never splits inside code spans and restores their punctuation', () => {
    const claims = splitClaims(
      'Compute `HMAC("{t}.{raw_body}")` over the payload [1]. Then compare in constant time [1].',
      true,
    )
    expect(claims).toHaveLength(2)
    expect(claims[0].text).toContain('HMAC("{t}.{raw_body}")')
  })

  it('strips the Answer: prefix and handles empty input', () => {
    expect(splitClaims('', true)).toEqual([])
    const claims = splitClaims('Answer: The fee is ₹4 per refund [2].', true)
    expect(claims[0].text.startsWith('The fee')).toBe(true)
  })
})
