/**
 * Client-side PDF text extraction via pdf.js — worker and WASM ship in the
 * bundle, so extraction is fully offline like everything else.
 */
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export async function extractPdfText(file, { onProgress } = {}) {
  const data = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data })
  const pdf = await loadingTask.promise
  const numPages = pdf.numPages
  const pages = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    // group items into lines by y position; wide x-gaps inside a line are
    // table column boundaries — mark them so amounts don't collide into
    // neighbouring cells when the text is linearized
    let lastY = null
    let lastEndX = null
    let line = []
    const lines = []
    const flushLine = () => {
      if (line.length) lines.push(line.join(''))
      line = []
      lastEndX = null
    }
    for (const item of content.items) {
      const y = Math.round(item.transform[5])
      const x = item.transform[4]
      if (lastY !== null && Math.abs(y - lastY) > 2) flushLine()
      const str = item.str.trim()
      if (str) {
        const gap = lastEndX !== null ? x - lastEndX : 0
        line.push(line.length === 0 ? str : (gap > 14 ? ' | ' : ' ') + str)
      }
      lastEndX = x + (item.width ?? 0)
      lastY = y
    }
    flushLine()
    pages.push(lines.join('\n'))
    onProgress?.({ page: p, total: pdf.numPages })
  }
  await loadingTask.destroy()
  return {
    text: pages.join('\n\n').replace(/\n{3,}/g, '\n\n').trim(),
    numPages,
  }
}
