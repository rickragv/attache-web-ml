/**
 * WordPiece tokenizer faithful to BERT-uncased: basic tokenization
 * (lowercase, NFD accent stripping, punctuation and CJK splitting) followed
 * by greedy longest-match-first subword segmentation with the '##' prefix.
 */
const MAX_WORD_CHARS = 200

const ZS_RE = /\p{Zs}/u
const CONTROL_RE = /[\p{Cc}\p{Cf}]/u
const PUNCT_RE = /\p{P}/u
const MN_RE = /\p{Mn}/gu

function isWhitespace(ch) {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ZS_RE.test(ch)
}

function isControl(ch) {
  if (ch === '\t' || ch === '\n' || ch === '\r') return false
  return CONTROL_RE.test(ch)
}

/**
 * BERT treats all non-alphanumeric ASCII as punctuation (e.g. $, +, ~)
 * even though Unicode does not class them as \p{P}.
 */
function isPunct(ch) {
  const cp = ch.codePointAt(0)
  if (
    (cp >= 33 && cp <= 47) ||
    (cp >= 58 && cp <= 64) ||
    (cp >= 91 && cp <= 96) ||
    (cp >= 123 && cp <= 126)
  ) {
    return true
  }
  return PUNCT_RE.test(ch)
}

function isCjk(cp) {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x20000 && cp <= 0x2a6df) ||
    (cp >= 0x2a700 && cp <= 0x2b73f) ||
    (cp >= 0x2b740 && cp <= 0x2b81f) ||
    (cp >= 0x2b820 && cp <= 0x2ceaf) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0x2f800 && cp <= 0x2fa1f)
  )
}

function cleanText(text) {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (cp === 0 || cp === 0xfffd || isControl(ch)) continue
    out += isWhitespace(ch) ? ' ' : ch
  }
  return out
}

function spaceOutCjk(text) {
  let out = ''
  for (const ch of text) {
    out += isCjk(ch.codePointAt(0)) ? ` ${ch} ` : ch
  }
  return out
}

function stripAccents(text) {
  return text.normalize('NFD').replace(MN_RE, '')
}

function basicTokenize(text) {
  const tokens = []
  for (const word of spaceOutCjk(cleanText(text)).split(' ')) {
    if (!word) continue
    const lowered = stripAccents(word.toLowerCase())
    let current = ''
    for (const ch of lowered) {
      if (isPunct(ch)) {
        if (current) tokens.push(current)
        tokens.push(ch)
        current = ''
      } else {
        current += ch
      }
    }
    if (current) tokens.push(current)
  }
  return tokens
}

export function createWordPiece(vocabText) {
  const vocab = new Map()
  const lines = vocabText.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const token = lines[i].endsWith('\r') ? lines[i].slice(0, -1) : lines[i]
    if (token) vocab.set(token, i)
  }

  const specialId = (token) => {
    const id = vocab.get(token)
    if (id === undefined) throw new Error(`vocab is missing required token ${token}`)
    return id
  }
  const padId = specialId('[PAD]')
  const unkId = specialId('[UNK]')
  const clsId = specialId('[CLS]')
  const sepId = specialId('[SEP]')

  function wordpiece(word) {
    if (word.length > MAX_WORD_CHARS) return [unkId]
    const ids = []
    let start = 0
    while (start < word.length) {
      let end = word.length
      let id
      while (start < end) {
        const sub = start > 0 ? `##${word.slice(start, end)}` : word.slice(start, end)
        id = vocab.get(sub)
        if (id !== undefined) break
        end--
      }
      if (id === undefined) return [unkId]
      ids.push(id)
      start = end
    }
    return ids
  }

  function tokenize(text) {
    const ids = []
    for (const word of basicTokenize(text)) ids.push(...wordpiece(word))
    return ids
  }

  function assemble(idsA, idsB, maxLen) {
    const inputIds = new Int32Array(maxLen).fill(padId)
    const attentionMask = new Int32Array(maxLen)
    const tokenTypeIds = new Int32Array(maxLen)
    let pos = 0
    inputIds[pos++] = clsId
    for (const id of idsA) inputIds[pos++] = id
    inputIds[pos++] = sepId
    if (idsB) {
      const segmentBStart = pos
      for (const id of idsB) inputIds[pos++] = id
      inputIds[pos++] = sepId
      tokenTypeIds.fill(1, segmentBStart, pos)
    }
    attentionMask.fill(1, 0, pos)
    return { inputIds, attentionMask, tokenTypeIds }
  }

  function encodePair(textA, textB, maxLen) {
    const idsA = tokenize(textA)
    const idsB = tokenize(textB)
    const budget = maxLen - 3
    while (idsA.length + idsB.length > budget) {
      if (idsA.length > idsB.length) idsA.pop()
      else idsB.pop()
    }
    return assemble(idsA, idsB, maxLen)
  }

  function encodeSingle(text, maxLen) {
    const ids = tokenize(text)
    ids.length = Math.min(ids.length, maxLen - 2)
    return assemble(ids, null, maxLen)
  }

  return { tokenize, encodePair, encodeSingle }
}
