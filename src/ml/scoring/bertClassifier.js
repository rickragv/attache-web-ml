/**
 * Shared LiteRT.js provider for BERT-family sequence-classification models —
 * the cross-encoder reranker (1 logit) and the NLI verifier (3 logits) are
 * the same architecture with different heads, so they share one loader.
 *
 * Runs on the main thread (LiteRT constraint — see models.config.js) with
 * lazy singleton init per config. Input signature is introspected at
 * runtime: exports vary in input order/naming (ids / mask / type_ids).
 */
import { cachedFetch } from '../modelCache.js'
import { ensureLiteRt } from '../litertRuntime.js'
import { createWordPiece } from '../tokenizer/wordpiece.js'

export function createBertClassifier(cfg) {
  let litert = null
  let model = null
  let wordpiece = null
  let backend = null
  let inputDetails = []

  return {
    id: cfg.id,
    label: cfg.label,

    get ready() {
      return Boolean(model)
    },
    get backend() {
      return backend
    },

    async init(ctx = {}) {
      if (model) return { backend }
      litert = await ensureLiteRt(cfg.wasmBase)

      ctx.onStatus?.({ phase: 'tokenizer', detail: 'vocab.txt' })
      const vocab = await cachedFetch(cfg.vocabUrl, { offline: ctx.offline })
      wordpiece = createWordPiece(new TextDecoder().decode(vocab.buffer))

      ctx.onStatus?.({ phase: 'weights', detail: cfg.label, totalBytes: cfg.approxBytes })
      const weights = await cachedFetch(cfg.modelUrl, {
        offline: ctx.offline,
        onProgress: (p) => ctx.onStatus?.({ phase: 'weights', detail: cfg.label, ...p }),
      })

      const url = URL.createObjectURL(new Blob([weights.buffer]))
      let lastErr = null
      try {
        for (const acc of cfg.accelerators ?? ['webgpu', 'wasm']) {
          try {
            model = await litert.loadAndCompile(url, { accelerator: acc })
            backend = acc
            break
          } catch (err) {
            lastErr = err
          }
        }
      } finally {
        URL.revokeObjectURL(url)
      }
      if (!model) throw lastErr ?? new Error(`${cfg.label}: compile failed on all accelerators`)
      inputDetails = model.getInputDetails()
      return { backend }
    },

    /**
     * Scores (textA, textB) pairs. Returns Float32Array rows of raw logits,
     * cfg.numLogits per pair.
     */
    async scorePairs(pairs) {
      if (!model) throw new Error(`${cfg.label} not initialised`)
      const out = new Float32Array(pairs.length * cfg.numLogits)
      for (let i = 0; i < pairs.length; i++) {
        const enc = wordpiece.encodePair(pairs[i][0], pairs[i][1], cfg.seqLen)
        const inputs = buildInputs(litert, inputDetails, enc, cfg)
        const outputs = await model.run(inputs)
        const logits = await readTensor(outputs[0])
        out.set(Array.from(logits).slice(0, cfg.numLogits), i * cfg.numLogits)
        for (const t of outputs) t.delete?.()
        for (const t of inputs) t.delete?.()
      }
      return out
    },
  }
}

function buildInputs(litert, details, enc, cfg) {
  return details.map((detail) => {
    const name = (detail.name ?? '').toLowerCase()
    let src
    if (name.includes('mask')) src = enc.attentionMask
    else if (name.includes('type') || name.includes('segment')) src = enc.tokenTypeIds
    else src = enc.inputIds
    const dtype = (detail.dtype ?? 'int32').toLowerCase()
    const typed = dtype.includes('float') ? Float32Array.from(src) : Int32Array.from(src)
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

export function softmax(logits) {
  const max = Math.max(...logits)
  const exps = logits.map((l) => Math.exp(l - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / sum)
}

export function sigmoid(x) {
  return 1 / (1 + Math.exp(-x))
}
