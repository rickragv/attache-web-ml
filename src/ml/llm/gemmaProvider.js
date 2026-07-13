/**
 * Answer-synthesis capstone: Gemma on-device via MediaPipe GenAI (LiteRT
 * runtime underneath). Main-thread context for the same reason as the text
 * tasks — the WASM loader wants the DOM.
 *
 * Enable via appConfig.features.answer + llm.gemma.modelUrl (a .task /
 * .litertlm bundle, multi-GB — see the System view for guidance).
 */
let llm = null

export async function initGemma(cfg, { onStatus } = {}) {
  if (llm) return llm
  if (!cfg.modelUrl) {
    throw new Error('llm.gemma.modelUrl is not configured — see the System view.')
  }
  const { FilesetResolver, LlmInference } = await import('@mediapipe/tasks-genai')
  onStatus?.({ phase: 'runtime', detail: 'MediaPipe GenAI runtime' })
  const fileset = await FilesetResolver.forGenAiTasks(cfg.wasmBase)
  onStatus?.({ phase: 'weights', detail: cfg.label })
  llm = await LlmInference.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: cfg.modelUrl },
    maxTokens: cfg.maxTokens,
    topK: cfg.topK,
    temperature: cfg.temperature,
  })
  return llm
}

export function buildGroundedPrompt(query, passages) {
  const context = passages
    .map((p, i) => `[${i + 1}] ${p.doc?.title ?? p.chunk.docId} — ${p.chunk.heading}\n${p.chunk.text.slice(0, 900)}`)
    .join('\n\n')
  return [
    'You are a support analyst. Answer the question using ONLY the numbered passages below.',
    'Cite passages as [1], [2]… after each claim. If the passages do not answer it, say so.',
    'Be concise (2–5 sentences). Never repeat a sentence.',
    '',
    context,
    '',
    `Question: ${query}`,
    'Answer:',
  ].join('\n')
}

/** Generic streaming generation for arbitrary prompts (Workspace chat). */
export function generateText(prompt, onToken) {
  if (!llm) throw new Error('Gemma is not initialised')
  let acc = ''
  return new Promise((resolve, reject) => {
    try {
      llm.generateResponse(prompt, (partial, done) => {
        acc += partial
        onToken?.(acc, done)
        if (done) resolve(acc)
      })
    } catch (err) {
      reject(err)
    }
  })
}

/** Streams tokens via onToken(partialText, done). */
export function generateAnswer(query, passages, onToken) {
  if (!llm) throw new Error('Gemma is not initialised')
  const prompt = buildGroundedPrompt(query, passages)
  let acc = ''
  return new Promise((resolve, reject) => {
    try {
      llm.generateResponse(prompt, (partial, done) => {
        acc += partial
        onToken?.(acc, done)
        if (done) resolve(acc)
      })
    } catch (err) {
      reject(err)
    }
  })
}
