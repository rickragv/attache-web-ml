import { describe, it, expect } from 'vitest'
import { createWordPiece } from '../src/ml/tokenizer/wordpiece.js'

const VOCAB = [
  '[PAD]',
  '[UNK]',
  '[CLS]',
  '[SEP]',
  'the',
  'un',
  '##aff',
  '##able',
  'want',
  '##ed',
  'refund',
  'settlement',
  'cafe',
  ',',
  '.',
  '!',
  '?',
].join('\n')

const tk = createWordPiece(VOCAB)
const id = (token) => VOCAB.split('\n').indexOf(token)

describe('createWordPiece', () => {
  it('throws when a required special token is missing', () => {
    expect(() => createWordPiece('foo\nbar')).toThrow(/\[PAD\]/)
  })

  it('splits into greedy longest-match subwords with ## continuations', () => {
    expect(tk.tokenize('unaffable')).toEqual([id('un'), id('##aff'), id('##able')])
    expect(tk.tokenize('wanted')).toEqual([id('want'), id('##ed')])
  })

  it('maps unknown words to [UNK]', () => {
    expect(tk.tokenize('xyzzy')).toEqual([id('[UNK]')])
    expect(tk.tokenize('the xyzzy refund')).toEqual([id('the'), id('[UNK]'), id('refund')])
  })

  it('splits punctuation into separate tokens', () => {
    expect(tk.tokenize('refund, settlement!')).toEqual([
      id('refund'),
      id(','),
      id('settlement'),
      id('!'),
    ])
  })

  it('lowercases and strips accents', () => {
    expect(tk.tokenize('Café')).toEqual([id('cafe')])
    expect(tk.tokenize('CAFÉ?')).toEqual([id('cafe'), id('?')])
  })

  it('builds [CLS] A [SEP] B [SEP] with masks, segments and padding', () => {
    const maxLen = 12
    const { inputIds, attentionMask, tokenTypeIds } = tk.encodePair('the refund', 'cafe', maxLen)
    expect(inputIds).toHaveLength(maxLen)
    expect(Array.from(inputIds)).toEqual([
      id('[CLS]'),
      id('the'),
      id('refund'),
      id('[SEP]'),
      id('cafe'),
      id('[SEP]'),
      id('[PAD]'),
      id('[PAD]'),
      id('[PAD]'),
      id('[PAD]'),
      id('[PAD]'),
      id('[PAD]'),
    ])
    expect(Array.from(attentionMask)).toEqual([1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0])
    expect(Array.from(tokenTypeIds)).toEqual([0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0])
  })

  it('truncates the longer segment first when maxLen is tight', () => {
    const { inputIds, attentionMask } = tk.encodePair(
      'the the the the the the',
      'refund settlement',
      8,
    )
    expect(Array.from(inputIds)).toEqual([
      id('[CLS]'),
      id('the'),
      id('the'),
      id('the'),
      id('[SEP]'),
      id('refund'),
      id('settlement'),
      id('[SEP]'),
    ])
    expect(Array.from(attentionMask)).toEqual([1, 1, 1, 1, 1, 1, 1, 1])
  })

  it('builds [CLS] A [SEP] for single inputs and truncates to fit', () => {
    const { inputIds, attentionMask, tokenTypeIds } = tk.encodeSingle('refund settlement', 6)
    expect(Array.from(inputIds)).toEqual([
      id('[CLS]'),
      id('refund'),
      id('settlement'),
      id('[SEP]'),
      id('[PAD]'),
      id('[PAD]'),
    ])
    expect(Array.from(attentionMask)).toEqual([1, 1, 1, 1, 0, 0])
    expect(Array.from(tokenTypeIds)).toEqual([0, 0, 0, 0, 0, 0])

    const tight = tk.encodeSingle('the refund settlement cafe', 4)
    expect(Array.from(tight.inputIds)).toEqual([id('[CLS]'), id('the'), id('refund'), id('[SEP]')])
  })
})
