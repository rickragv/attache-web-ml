/**
 * Model asset cache built on the Cache API. Works on the main thread and in
 * workers. Every network byte the app ever pulls goes through here, which is
 * what makes the offline drill enforceable and the HUD's download telemetry
 * truthful.
 */
const CACHE_NAME = 'attache-models-v1'

export async function cachedFetch(url, { onProgress, offline = false, headers = {} } = {}) {
  const cache = await caches.open(CACHE_NAME)
  const hit = await cache.match(url)
  if (hit) {
    const buffer = await hit.arrayBuffer()
    onProgress?.({ loaded: buffer.byteLength, total: buffer.byteLength, fromCache: true })
    return { buffer, fromCache: true }
  }

  if (offline) {
    throw new Error(`Offline drill is active and this asset is not cached yet: ${url}`)
  }

  const res = await fetch(url, { headers })
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Access denied (${res.status}) — this model is license-gated. Accept its licence on huggingface.co and add a read token in the System view.`,
    )
  }
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`)
  // SPA servers answer missing files with 200 + index.html — caching that
  // as model bytes poisons the cache permanently. Refuse it.
  if ((res.headers.get('content-type') ?? '').includes('text/html')) {
    throw new Error(`Asset missing at ${url} (server returned an HTML fallback page)`)
  }

  const total = Number(res.headers.get('content-length')) || 0
  const reader = res.body.getReader()
  const parts = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
    loaded += value.byteLength
    onProgress?.({ loaded, total, fromCache: false })
  }

  const blob = new Blob(parts)
  await cache.put(url, new Response(blob, { headers: { 'content-type': 'application/octet-stream' } }))
  const buffer = await blob.arrayBuffer()
  return { buffer, fromCache: false }
}

export async function cacheStatus(urls) {
  const cache = await caches.open(CACHE_NAME)
  const out = {}
  for (const url of urls) {
    if (!url) continue
    const hit = await cache.match(url)
    out[url] = hit ? Number(hit.headers.get('content-length')) || (await hit.blob()).size : null
  }
  return out
}

export async function clearModelCache() {
  await caches.delete(CACHE_NAME)
}
