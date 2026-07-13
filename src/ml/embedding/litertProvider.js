/**
 * Flagship embedding provider: EmbeddingGemma 300M on LiteRT.js.
 * WebGPU first, WASM (XNNPACK) fallback. Input signature is introspected at
 * runtime via getInputDetails() because tflite exports differ in whether
 * they take (ids), (ids, mask) or (ids, mask, positions).
 */
import { cachedFetch } from '../modelCache.js'
import { ensureLiteRt } from '../litertRuntime.js'
import { l2normalize } from '../vectorStore.js'
import { loadSentencePiece } from '../tokenizer/sentencepiece.js'

export function createLitertProvider(cfg) {
  let litert = null
  let model = null
  let tokenizer = null
  let backend = null
  let inputDetails = []

  return {
    id: cfg.id,
    label: cfg.label,
    runtime: cfg.runtime,
    quality: cfg.quality,

    async init(ctx) {
      ctx.onStatus({ phase: 'runtime', detail: 'LiteRT.js WASM runtime' })
      litert = await ensureLiteRt(cfg.wasmBase)

      const headers = authHeaders(cfg)
      ctx.onStatus({ phase: 'tokenizer', detail: 'sentencepiece.model' })
      const tok = await cachedFetch(cfg.tokenizerUrl, { offline: ctx.offline, headers })
      tokenizer = await loadSentencePiece(tok.buffer)

      ctx.onStatus({ phase: 'weights', detail: cfg.label, totalBytes: cfg.approxBytes })
      const weights = await cachedFetch(cfg.modelUrl, {
        offline: ctx.offline,
        headers,
        onProgress: (p) => ctx.onStatus({ phase: 'weights', detail: cfg.label, ...p }),
      })

      const modelUrl = URL.createObjectURL(
        new Blob([weights.buffer], { type: 'application/octet-stream' }),
      )
      let lastErr = null
      try {
        for (const acc of cfg.accelerators) {
          try {
            ctx.onStatus({ phase: 'compile', detail: `compiling for ${acc}` })
            model = await litert.loadAndCompile(modelUrl, { accelerator: acc })
            backend = acc
            break
          } catch (err) {
            lastErr = err
          }
        }
      } finally {
        URL.revokeObjectURL(modelUrl)
      }
      if (!model) throw lastErr ?? new Error('LiteRT compile failed on all accelerators')

      inputDetails = model.getInputDetails()
      return { backend, dims: cfg.dims }
    },

    async embed(texts, kind) {
      const prefix = cfg.prompts[kind] ?? ''
      const out = new Float32Array(texts.length * cfg.dims)

      for (let t = 0; t < texts.length; t++) {
        const ids = encodeWindow(tokenizer, prefix + texts[t], cfg)
        const inputs = buildInputs(litert, inputDetails, ids, cfg)
        const outputs = await model.run(inputs)
        const data = await readTensor(outputs[0])
        const vec = l2normalize(Float32Array.from(data.slice(0, cfg.dims)))
        out.set(vec, t * cfg.dims)
        for (const tensor of outputs) tensor.delete?.()
        for (const tensor of inputs) tensor.delete?.()
      }
      return { vectors: out, dims: cfg.dims }
    },
  }
}

function authHeaders(cfg) {
  if (!cfg.auth || typeof localStorage === 'undefined') return {}
  try {
    const token = localStorage.getItem(cfg.auth.storageKey)
    if (token && cfg.modelUrl.includes(cfg.auth.host)) {
      return { Authorization: `Bearer ${token.trim()}` }
    }
  } catch {
    /* storage unavailable */
  }
  return {}
}

function encodeWindow(tokenizer, text, cfg) {
  const raw = tokenizer.encodeIds(text)
  const ids = [cfg.special.bosId, ...raw].slice(0, cfg.seqLen)
  while (ids.length < cfg.seqLen) ids.push(cfg.special.padId)
  return ids
}

function buildInputs(litert, details, ids, cfg) {
  const realLen = ids.filter((id, i) => i === 0 || id !== cfg.special.padId).length
  return details.map((detail) => {
    const name = (detail.name ?? '').toLowerCase()
    const size = (detail.shape ?? [1, cfg.seqLen]).reduce((a, b) => a * b, 1)
    let values
    if (name.includes('mask')) {
      values = ids.map((_, i) => (i < realLen ? 1 : 0))
    } else if (name.includes('position')) {
      values = ids.map((_, i) => i)
    } else {
      values = ids
    }
    while (values.length < size) values = values.concat(0)
    const dtype = (detail.dtype ?? 'int32').toLowerCase()
    const typed = dtype.includes('float') ? Float32Array.from(values) : Int32Array.from(values)
    return new litert.Tensor(typed, detail.shape ?? [1, cfg.seqLen])
  })
}

async function readTensor(tensor) {
  if (typeof tensor.data === 'function') return await tensor.data()
  if (typeof tensor.moveTo === 'function') {
    const moved = await tensor.moveTo('wasm')
    return moved.toTypedArray()
  }
  if (typeof tensor.toTypedArray === 'function') return tensor.toTypedArray()
  throw new Error('Cannot read output tensor: unknown LiteRT tensor API surface')
}
