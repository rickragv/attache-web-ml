/**
 * Standard-tier embedding provider: Universal Sentence Encoder via MediaPipe
 * Tasks (which runs TFLite/XNNPACK under the hood). ~7 MB download, reliable
 * everywhere WASM runs — the safety net under the LiteRT flagship path.
 */
import { cachedFetch } from '../modelCache.js'
import { l2normalize } from '../vectorStore.js'

export function createMediapipeProvider(cfg) {
  let embedder = null

  return {
    id: cfg.id,
    label: cfg.label,
    runtime: cfg.runtime,
    quality: cfg.quality,

    async init(ctx) {
      const { FilesetResolver, TextEmbedder } = await import('@mediapipe/tasks-text')
      ctx.onStatus({ phase: 'runtime', detail: 'MediaPipe text runtime' })
      const fileset = await FilesetResolver.forTextTasks(cfg.wasmBase)

      ctx.onStatus({ phase: 'weights', detail: cfg.label, totalBytes: cfg.approxBytes })
      const weights = await cachedFetch(cfg.modelUrl, {
        offline: ctx.offline,
        onProgress: (p) => ctx.onStatus({ phase: 'weights', detail: cfg.label, ...p }),
      })

      ctx.onStatus({ phase: 'compile', detail: 'creating embedder' })
      embedder = await TextEmbedder.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: new Uint8Array(weights.buffer) },
      })
      return { backend: 'wasm (xnnpack)', dims: cfg.dims }
    },

    async embed(texts) {
      const out = new Float32Array(texts.length * cfg.dims)
      for (let t = 0; t < texts.length; t++) {
        const result = embedder.embed(texts[t])
        const emb = result.embeddings?.[0]?.floatEmbedding
        if (!emb) throw new Error('MediaPipe returned no embedding')
        const vec = l2normalize(Float32Array.from(emb.slice(0, cfg.dims)))
        out.set(vec, t * cfg.dims)
      }
      return { vectors: out, dims: cfg.dims }
    },
  }
}
