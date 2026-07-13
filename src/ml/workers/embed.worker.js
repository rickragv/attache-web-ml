/**
 * Inference worker. Owns the embedding provider chain so model compilation
 * and tensor work never block a keystroke on the main thread.
 *
 * Protocol: { id, type, payload } request → { id, ok, result | error } reply,
 * plus unsolicited { type: 'status', ... } progress events during init.
 */
import { createLitertProvider } from '../embedding/litertProvider.js'
import { createMediapipeProvider } from '../embedding/mediapipeProvider.js'
import { createLexicalProvider } from '../embedding/lexicalProvider.js'

const factories = {
  litert: createLitertProvider,
  mediapipe: createMediapipeProvider,
  lexical: createLexicalProvider,
}

let provider = null
let providerMeta = null
let offline = false

self.onmessage = async (e) => {
  const { id, type, payload } = e.data
  try {
    if (type === 'setOffline') {
      offline = Boolean(payload.offline)
      post({ id, ok: true, result: { offline } })
      return
    }

    if (type === 'init') {
      const { embeddingConfig } = payload
      const attempts = []
      for (const key of embeddingConfig.providerChain) {
        const cfg = embeddingConfig[key]
        if (!cfg?.enabled) continue
        const candidate = factories[key](cfg)
        try {
          post({ type: 'status', provider: key, phase: 'starting', detail: cfg.label })
          const t0 = performance.now()
          const { backend, dims } = await candidate.init({
            offline,
            onStatus: (s) => post({ type: 'status', provider: key, ...s }),
          })
          provider = candidate
          providerMeta = {
            provider: key,
            label: cfg.label,
            runtime: cfg.runtime,
            quality: cfg.quality,
            backend,
            dims,
            initMs: performance.now() - t0,
            attempts,
          }
          post({ id, ok: true, result: providerMeta })
          return
        } catch (err) {
          attempts.push({ provider: key, error: String(err?.message ?? err) })
          post({ type: 'status', provider: key, phase: 'failed', detail: String(err?.message ?? err) })
        }
      }
      throw new Error(
        'No embedding provider could start: ' +
          attempts.map((a) => `${a.provider} → ${a.error}`).join(' | '),
      )
    }

    if (type === 'embed') {
      if (!provider) throw new Error('Embedding provider not initialised')
      const { texts, kind } = payload
      const t0 = performance.now()
      const { vectors, dims } = await provider.embed(texts, kind)
      const ms = performance.now() - t0
      post(
        { id, ok: true, result: { buffer: vectors.buffer, dims, count: texts.length, ms } },
        [vectors.buffer],
      )
      return
    }

    throw new Error(`Unknown worker message type: ${type}`)
  } catch (err) {
    post({ id, ok: false, error: String(err?.message ?? err) })
  }
}

function post(msg, transfer) {
  self.postMessage(msg, transfer ?? [])
}
