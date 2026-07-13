/**
 * LiteRT.js runtime singleton. loadLiteRt() throws if called twice in one
 * page, and multiple providers (embedder, reranker, NLI) share the runtime —
 * so every provider goes through here instead of calling loadLiteRt itself.
 */
let loadPromise = null

export async function ensureLiteRt(wasmBase) {
  const litert = await import('@litertjs/core')
  if (!loadPromise) {
    loadPromise = litert.loadLiteRt(wasmBase)
  }
  await loadPromise
  return litert
}
