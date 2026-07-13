/**
 * OCR provider chain, same honest-degradation pattern as embeddings:
 * a LiteRT detection/recognition pair is the target flagship (config-gated
 * until an export is validated), Tesseract.js (WASM) is the shipping
 * baseline. The UI reports which one ran.
 */
import { modelsConfig } from '../../config/models.config.js'

let tesseractWorker = null

export async function recognizeDocument(canvas, { onStatus } = {}) {
  const cfg = modelsConfig.ocr
  const attempts = []
  for (const key of cfg.providerChain) {
    const provider = cfg[key]
    if (!provider?.enabled) continue
    try {
      if (key === 'tesseract') return await recognizeTesseract(canvas, provider, onStatus)
      if (key === 'paddle') throw new Error('LiteRT OCR provider not yet validated')
    } catch (err) {
      attempts.push(`${key}: ${err.message}`)
    }
  }
  throw new Error(`No OCR provider available — ${attempts.join(' | ')}`)
}

async function recognizeTesseract(canvas, provider, onStatus) {
  onStatus?.({ phase: 'ocr-init', detail: 'Tesseract WASM engine' })
  if (!tesseractWorker) {
    const Tesseract = await import('tesseract.js')
    tesseractWorker = await Tesseract.createWorker(provider.langs, 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          onStatus?.({ phase: 'ocr', progress: m.progress })
        }
      },
    })
  }
  const t0 = performance.now()
  const { data } = await tesseractWorker.recognize(canvas)
  return {
    text: normalizeOcrText(data.text ?? ''),
    confidence: data.confidence ?? null,
    provider: 'Tesseract (WASM)',
    onDevice: true,
    ms: performance.now() - t0,
  }
}

/** Collapses OCR line noise into paragraph-shaped markdown-ish text. */
export function normalizeOcrText(text) {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/-\n(?=[a-z])/g, '') // de-hyphenate line wraps
    .replace(/([^\n.!?:])\n(?=[a-z(₹0-9])/g, '$1 ') // join wrapped lines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
