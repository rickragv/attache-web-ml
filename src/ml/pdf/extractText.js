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
    // group items into lines by their y position, then into paragraphs
    let lastY = null
    let line = []
    const lines = []
    for (const item of content.items) {
      const y = Math.round(item.transform[5])
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line.join(' '))
        line = []
      }
      if (item.str.trim()) line.push(item.str.trim())
      lastY = y
    }
    if (line.length) lines.push(line.join(' '))
    pages.push(lines.join('\n'))
    onProgress?.({ page: p, total: pdf.numPages })
  }
  await loadingTask.destroy()
  return {
    text: pages.join('\n\n').replace(/\n{3,}/g, '\n\n').trim(),
    numPages,
  }
}
