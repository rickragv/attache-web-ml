/**
 * Embedding engine facade. Walks the provider chain and initialises each
 * provider in its declared execution context:
 *
 *   context: 'worker' — heavy runtimes (LiteRT) run off the main thread
 *   context: 'main'   — MediaPipe's WASM loader needs the DOM (its module
 *                       worker path fails with "ModuleFactory not set"), and
 *                       the lexical fallback is trivial anywhere
 *
 * Whatever wins, the caller gets one uniform handle:
 *   { meta, embed(texts, kind), setOffline(bool), dispose() }
 */
import { createLitertProvider } from './embedding/litertProvider.js'
import { createMediapipeProvider } from './embedding/mediapipeProvider.js'
import { createLexicalProvider } from './embedding/lexicalProvider.js'

const factories = {
  litert: createLitertProvider,
  mediapipe: createMediapipeProvider,
  lexical: createLexicalProvider,
}

export async function initEmbedEngine(embeddingConfig, { onStatus, offline = false } = {}) {
  const attempts = []
  const offlineRef = { value: offline }

  for (const key of embeddingConfig.providerChain) {
    const cfg = embeddingConfig[key]
    if (!cfg?.enabled) continue

    try {
      onStatus?.({ provider: key, phase: 'starting', detail: cfg.label })
      const handle =
        cfg.context === 'worker'
          ? await initInWorker(key, embeddingConfig, { onStatus, offlineRef })
          : await initOnMain(key, cfg, { onStatus, offlineRef })
      handle.meta.attempts = attempts
      return handle
    } catch (err) {
      attempts.push({ provider: key, error: String(err?.message ?? err) })
      onStatus?.({ provider: key, phase: 'failed', detail: String(err?.message ?? err) })
    }
  }
  throw new Error(
    'No embedding provider could start: ' +
      attempts.map((a) => `${a.provider} → ${a.error}`).join(' | '),
  )
}

/* ------------------------------------------------------------------ */

async function initOnMain(key, cfg, { onStatus, offlineRef }) {
  const provider = factories[key](cfg)
  const t0 = performance.now()
  const { backend, dims } = await provider.init({
    get offline() {
      return offlineRef.value
    },
    onStatus: (s) => onStatus?.({ provider: key, ...s }),
  })
  return {
    meta: {
      provider: key,
      label: cfg.label,
      runtime: cfg.runtime,
      quality: cfg.quality,
      execution: 'main thread',
      backend,
      dims,
      initMs: performance.now() - t0,
    },
    async embed(texts, kind) {
      const t = performance.now()
      const { vectors, dims: d } = await provider.embed(texts, kind)
      return { vectors, dims: d, count: texts.length, ms: performance.now() - t }
    },
    setOffline(v) {
      offlineRef.value = v
    },
    dispose() {},
  }
}

/* ------------------------------------------------------------------ */

async function initInWorker(key, embeddingConfig, { onStatus, offlineRef }) {
  const worker = new Worker(new URL('./workers/embed.worker.js', import.meta.url), {
    type: 'module',
  })
  const pending = new Map()
  let nextId = 1

  worker.onmessage = (e) => {
    const msg = e.data
    if (msg.type === 'status') {
      onStatus?.(msg)
      return
    }
    const entry = pending.get(msg.id)
    if (!entry) return
    pending.delete(msg.id)
    msg.ok ? entry.resolve(msg.result) : entry.reject(new Error(msg.error))
  }
  worker.onerror = (e) => {
    for (const { reject } of pending.values()) reject(new Error(e.message ?? 'worker crashed'))
    pending.clear()
  }

  const call = (type, payload) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      worker.postMessage({ id, type, payload })
    })

  try {
    await call('setOffline', { offline: offlineRef.value })
    const meta = await call('init', {
      embeddingConfig: { ...embeddingConfig, providerChain: [key] },
    })
    return {
      meta: { ...meta, execution: 'web worker' },
      async embed(texts, kind) {
        const r = await call('embed', { texts, kind })
        return { vectors: new Float32Array(r.buffer), dims: r.dims, count: r.count, ms: r.ms }
      },
      setOffline(v) {
        offlineRef.value = v
        call('setOffline', { offline: v }).catch(() => {})
      },
      dispose() {
        worker.terminate()
      },
    }
  } catch (err) {
    worker.terminate()
    throw err
  }
}
