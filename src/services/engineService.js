/**
 * Boot orchestrator: corpus → provider chain → chunk embeddings (with
 * IndexedDB reuse) → triage prototypes. Also the single place that owns the
 * worker client, the BM25 index and the vector stores.
 */
import { appConfig } from '../config/app.config.js'
import { modelsConfig } from '../config/models.config.js'
import { retrievalConfig } from '../config/retrieval.config.js'
import { initEmbedEngine } from '../ml/embedEngine.js'
import { chunkDocument } from '../ml/chunker.js'
import { BM25Index } from '../ml/bm25.js'
import { AnnIndex } from '../ml/index/annIndex.js'
import { VectorStore, meanVector } from '../ml/vectorStore.js'
import { persistence } from '../ml/persistence.js'
import { loadCorpus, corpusStats } from './corpusService.js'
import { useStore } from '../state/store.js'

const EMBED_BATCH = 8

/** Module singletons — engine internals, not UI state. */
export const engine = {
  client: null,
  bm25: new BM25Index(retrievalConfig.bm25),
  vectors: new VectorStore(),
  ann: null, // HNSW substrate, built automatically past the config threshold
  prototypes: new Map(), // routeId -> Float32Array
}

/**
 * Single vector-search entry point: exact brute-force below the ANN
 * threshold, HNSW above it. Callers never care which.
 */
export function searchVectors(queryVec, k, { minScore = -Infinity } = {}) {
  if (engine.ann) {
    return engine.ann.search(queryVec, k).filter((h) => h.score >= minScore)
  }
  return engine.vectors.topK(queryVec, k, { minScore })
}

function rebuildAnnIfNeeded() {
  const { ann } = retrievalConfig
  const active = ann.enabled && engine.vectors.count >= ann.threshold
  if (!active) {
    engine.ann = null
    useStore.getState().patchCorpus({ annActive: false })
    return
  }
  const t0 = performance.now()
  const idx = new AnnIndex({ dims: engine.vectors.dims, ...ann.params })
  const { matrix, dims, keys, count } = engine.vectors
  for (let i = 0; i < count; i++) {
    idx.add(keys[i], matrix.subarray(i * dims, (i + 1) * dims))
  }
  engine.ann = idx
  useStore.getState().patchCorpus({ annActive: true })
  useStore.getState().logEvent({ kind: 'ann-build', ms: performance.now() - t0, n: count })
}

export async function bootEngine() {
  const store = useStore.getState()

  // 1. corpus
  const docs = await loadCorpus()
  const chunks = docs.flatMap((d) => chunkDocument(d, retrievalConfig.chunking))
  engine.bm25.build(chunks)
  store.patchCorpus({ docs, chunks, stats: corpusStats(docs, chunks) })

  // 2. provider chain (each provider runs in its declared context)
  store.patchEngine({ status: 'loading', progress: { phase: 'starting' } })
  let meta
  try {
    engine.client = await initEmbedEngine(modelsConfig.embedding, {
      onStatus: (s) => useStore.getState().patchEngine({ progress: s }),
      offline: useStore.getState().offlineDrill,
    })
    meta = engine.client.meta
  } catch (err) {
    store.patchEngine({ status: 'error', error: String(err.message ?? err) })
    throw err
  }
  store.patchEngine({ status: 'ready', progress: null, error: null, ...meta })

  // 3. chunk embeddings (reuse persisted vectors when signature matches)
  await embedChunks(chunks, meta)

  // 4. ANN substrate (no-op below threshold) + triage prototypes
  rebuildAnnIfNeeded()
  await rebuildPrototypes()

  useStore.getState().patchCorpus({
    indexing: { ...useStore.getState().corpus.indexing, state: 'done' },
  })
}

function cacheKey(meta) {
  return [
    meta.provider,
    meta.dims,
    retrievalConfig.indexVersion,
    appConfig.version,
  ].join(':')
}

async function embedChunks(chunks, meta) {
  const store = useStore.getState()
  const key = cacheKey(meta)
  engine.vectors.reset(meta.dims)

  let cached = null
  try {
    cached = await persistence.getVectors(key)
  } catch {
    cached = null
  }
  const chunkKeys = chunks.map((c) => c.key)
  if (
    cached &&
    cached.count === chunks.length &&
    JSON.stringify(cached.keys) === JSON.stringify(chunkKeys)
  ) {
    engine.vectors = VectorStore.hydrate(cached)
    store.patchCorpus({
      indexing: { state: 'running', done: chunks.length, total: chunks.length, fromCache: true },
    })
    return
  }

  store.patchCorpus({
    indexing: { state: 'running', done: 0, total: chunks.length, fromCache: false },
  })

  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    // macrotask yield: main-context providers resolve in microtasks, and
    // without this the event loop starves and the UI freezes at scale
    await new Promise((resolve) => setTimeout(resolve, 0))
    const batch = chunks.slice(i, i + EMBED_BATCH)
    const texts = batch.map((c) => `${c.heading}\n${c.text}`)
    const { vectors, dims, ms } = await engine.client.embed(texts, 'document')
    engine.vectors.append(
      batch.map((c) => c.key),
      vectors,
      dims,
    )
    useStore.getState().logEvent({ kind: 'embed', ms, n: batch.length, scope: 'index' })
    useStore.getState().patchCorpus({
      indexing: {
        state: 'running',
        done: Math.min(i + EMBED_BATCH, chunks.length),
        total: chunks.length,
        fromCache: false,
      },
    })
  }

  try {
    await persistence.putVectors(key, engine.vectors.serialize())
  } catch {
    /* private browsing — vectors just rebuild next load */
  }
}

export async function rebuildPrototypes() {
  const { routes } = useStore.getState()
  const dims = engine.vectors.dims
  engine.prototypes.clear()
  for (const route of routes) {
    const { vectors } = await engine.client.embed(route.exemplars, 'query')
    const vecs = []
    for (let i = 0; i < route.exemplars.length; i++) {
      vecs.push(vectors.subarray(i * dims, (i + 1) * dims))
    }
    engine.prototypes.set(route.id, meanVector(vecs, dims))
  }
  useStore.getState().setPrototypesReady(true)
}

/** Adds a user document to every index without a full reboot. */
export async function indexUserDoc(doc) {
  if (!engine.client) {
    throw new Error('The on-device engine is not ready yet — wait for indexing to finish, or reload.')
  }
  const store = useStore.getState()
  const chunks = chunkDocument(doc, retrievalConfig.chunking)
  const texts = chunks.map((c) => `${c.heading}\n${c.text}`)
  const { vectors, dims, ms } = await engine.client.embed(texts, 'document')
  engine.vectors.append(
    chunks.map((c) => c.key),
    vectors,
    dims,
  )
  store.logEvent({ kind: 'embed', ms, n: chunks.length, scope: 'upload' })

  // keep the ANN substrate in sync incrementally (cheap single inserts)
  if (engine.ann) {
    const { matrix, dims: vd, count } = engine.vectors
    for (let i = count - chunks.length; i < count; i++) {
      engine.ann.add(engine.vectors.keys[i], matrix.subarray(i * vd, (i + 1) * vd))
    }
  } else {
    rebuildAnnIfNeeded()
  }

  const docs = [...store.corpus.docs, doc]
  const allChunks = [...store.corpus.chunks, ...chunks]
  engine.bm25.build(allChunks)
  store.patchCorpus({ docs, chunks: allChunks, stats: corpusStats(docs, allChunks) })
  try {
    await persistence.putUserDoc(doc)
  } catch {
    /* non-fatal */
  }
}

export async function setEngineOffline(offline) {
  useStore.getState().setOfflineDrill(offline)
  engine.client?.setOffline(offline)
}
