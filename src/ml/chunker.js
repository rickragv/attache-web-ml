/**
 * Markdown-aware chunker. Splits on headings/paragraphs and accumulates to a
 * target size with overlap, so a chunk never starts mid-sentence and always
 * carries its nearest heading as context.
 */
export function chunkDocument(doc, cfg) {
  const blocks = splitBlocks(doc.body)
  const chunks = []
  let buf = ''
  let heading = doc.title
  let overlapTail = ''

  const flush = () => {
    const text = buf.trim()
    if (!text) return
    chunks.push({
      key: `${doc.id}#${chunks.length}`,
      docId: doc.id,
      seq: chunks.length,
      heading,
      text,
    })
    overlapTail = text.slice(-cfg.overlapChars)
    buf = ''
  }

  for (const block of blocks) {
    if (block.heading) {
      // headings are hard section boundaries: always flush, never bleed
      // overlap from the previous section into the next
      if (buf.trim()) flush()
      overlapTail = ''
      heading = block.heading
      continue
    }
    // PDF table pages arrive as one giant blank-line-free block; split it
    // at line boundaries or the chunk exceeds the embedder's window and
    // gets silently truncated at inference time
    for (const piece of splitOversized(block.text, cfg.targetChars)) {
      if (buf.length + piece.length > cfg.targetChars && buf.length >= cfg.minChars) {
        flush()
        buf = overlapTail ? overlapTail + '\n' : ''
      }
      buf += (buf ? '\n\n' : '') + piece
    }
  }
  flush()

  // fold a runt final chunk into its predecessor
  if (chunks.length >= 2 && chunks[chunks.length - 1].text.length < cfg.minChars) {
    const runt = chunks.pop()
    chunks[chunks.length - 1].text += '\n\n' + runt.text
  }
  return chunks
}

function splitOversized(text, targetChars) {
  if (text.length <= targetChars) return [text]
  const pieces = []
  let buf = ''
  for (const line of text.split('\n')) {
    if (buf && buf.length + line.length + 1 > targetChars) {
      pieces.push(buf)
      buf = ''
    }
    // a single line longer than the target gets hard-wrapped as a last resort
    let rest = line
    while (rest.length > targetChars) {
      pieces.push(rest.slice(0, targetChars))
      rest = rest.slice(targetChars)
    }
    buf += (buf ? '\n' : '') + rest
  }
  if (buf) pieces.push(buf)
  return pieces
}

function splitBlocks(markdown) {
  const lines = markdown.split(/\r?\n/)
  const blocks = []
  let para = []
  const flushPara = () => {
    if (para.length) {
      blocks.push({ text: para.join('\n') })
      para = []
    }
  }
  for (const line of lines) {
    const h = line.match(/^#{1,4}\s+(.*)/)
    if (h) {
      flushPara()
      // headings emptied by upstream cleaning (e.g. stripped templating)
      // are dropped rather than emitted as falsy blocks
      if (h[1].trim()) blocks.push({ heading: h[1].trim() })
    } else if (line.trim() === '') {
      flushPara()
    } else {
      para.push(line)
    }
  }
  flushPara()
  return blocks
}
