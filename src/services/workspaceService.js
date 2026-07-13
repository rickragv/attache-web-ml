/**
 * Workspace: a private, session-scoped document set (≤ maxDocs) with its own
 * vector store, entity table, knowledge graph and chat — fully on-device.
 * Deliberately separate from the main corpus: nothing here touches BM25,
 * the Library, or IndexedDB.
 */
import { appConfig } from '../config/app.config.js'
import { modelsConfig } from '../config/models.config.js'
import { retrievalConfig } from '../config/retrieval.config.js'
import { chunkDocument } from '../ml/chunker.js'
import { VectorStore } from '../ml/vectorStore.js'
import { extractEntities, nerActive } from '../ml/ner/entityExtractor.js'
import { initGemma, generateText } from '../ml/llm/gemmaProvider.js'
import { parseFrontmatter } from './frontmatter.js'
import { engine } from './engineService.js'
import { useStore } from '../state/store.js'

const ws = {
  vectors: new VectorStore(),
  chunks: [], // [{key, docId, heading, text}]
  entities: new Map(), // key -> {surface, type, count, docs:Set, chunkKeys:Set}
}

export async function ingestFiles(fileList) {
  const store = useStore.getState()
  const cfg = appConfig.workspace
  if (!engine.client) {
    store.patchWorkspace({ error: 'The on-device engine is not ready yet.' })
    return
  }

  const room = cfg.maxDocs - store.workspace.docs.length
  const files = [...fileList]
    .filter((f) => /\.(md|txt|markdown|pdf)$/i.test(f.name))
    .slice(0, Math.max(0, room))
  if (!files.length) {
    store.patchWorkspace({
      error: room <= 0 ? `Workspace is full (${cfg.maxDocs} documents max).` : 'No .md/.txt/.pdf files found.',
    })
    return
  }

  store.patchWorkspace({ status: 'ingesting', error: null })

  for (const file of files) {
    const t0 = performance.now()
    let raw
    if (/\.pdf$/i.test(file.name)) {
      useStore.getState().patchWorkspace({ progress: { docName: file.name, phase: 'extracting PDF text' } })
      const { extractPdfText } = await import('../ml/pdf/extractText.js')
      const { text, numPages } = await extractPdfText(file, {
        onProgress: (p) =>
          useStore.getState().patchWorkspace({
            progress: { docName: file.name, phase: `PDF page ${p.page}/${p.total}` },
          }),
      })
      raw = `---\ntitle: "${file.name.replace(/\.pdf$/i, '')} (${numPages} pages)"\n---\n\n${text}`
    } else {
      raw = await file.text()
    }
    const { meta, body } = parseFrontmatter(raw)
    const id = `ws-${file.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`
    const title = meta.title ?? file.name.replace(/\.(md|txt|markdown)$/i, '')
    const doc = { id, name: title, words: body.split(/\s+/).length, chunks: 0, entities: 0, status: 'embedding' }
    useStore.getState().patchWorkspace({ docs: [...useStore.getState().workspace.docs, doc] })

    const patchDoc = (patch) =>
      useStore.getState().patchWorkspace({
        docs: useStore.getState().workspace.docs.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      })

    // 1. chunk + embed into the workspace's own vector store. Very large
    // documents are sampled evenly across their length so the whole doc is
    // represented without minutes of embedding (cap is config-driven).
    let chunks = chunkDocument({ id, title, body }, retrievalConfig.chunking)
    let sampled = false
    if (chunks.length > cfg.maxChunksPerDoc) {
      const stride = chunks.length / cfg.maxChunksPerDoc
      chunks = Array.from({ length: cfg.maxChunksPerDoc }, (_, i) => chunks[Math.floor(i * stride)])
      sampled = true
    }
    patchDoc({ sampled })
    for (let i = 0; i < chunks.length; i += 8) {
      const batch = chunks.slice(i, i + 8)
      useStore.getState().patchWorkspace({
        progress: { docName: title, phase: `embedding ${Math.min(i + 8, chunks.length)}/${chunks.length}` },
      })
      const texts = batch.map((c) => `${c.heading}\n${c.text}`)
      const { vectors, dims, ms } = await engine.client.embed(texts, 'document')
      ws.vectors.append(batch.map((c) => c.key), vectors, dims)
      useStore.getState().logEvent({ kind: 'embed', ms, n: batch.length, scope: 'workspace' })
      await new Promise((r) => setTimeout(r, 0))
    }
    ws.chunks.push(...chunks.map((c) => ({ ...c, docTitle: title })))
    patchDoc({ chunks: chunks.length, status: 'extracting' })

    // 2. entity extraction per chunk (NER + patterns)
    let docEntities = 0
    let chunkIndex = 0
    for (const chunk of chunks) {
      chunkIndex += 1
      useStore.getState().patchWorkspace({
        progress: { docName: title, phase: `entities ${chunkIndex}/${chunks.length}` },
      })
      const found = await extractEntities(chunk.text)
      for (const e of found) {
        const key = `${e.type}:${e.surface.toLowerCase()}`
        const hit = ws.entities.get(key)
        if (hit) {
          hit.count += e.count
          hit.docs.add(id)
          hit.chunkKeys.add(chunk.key)
        } else {
          ws.entities.set(key, {
            key,
            surface: e.surface,
            type: e.type,
            count: e.count,
            docs: new Set([id]),
            chunkKeys: new Set([chunk.key]),
          })
        }
      }
      docEntities += found.length
      await new Promise((r) => setTimeout(r, 0)) // keep the UI alive
    }
    patchDoc({ entities: docEntities, status: 'done', ms: performance.now() - t0 })
  }

  rebuildGraph()
  useStore.getState().patchWorkspace({
    status: 'ready',
    progress: null,
    nerActive: nerActive(),
    entities: [...ws.entities.values()]
      .map((e) => ({ ...e, docs: [...e.docs], chunkKeys: [...e.chunkKeys] }))
      .sort((a, b) => b.count - a.count),
  })
}

export function resetWorkspace() {
  ws.vectors = new VectorStore()
  ws.chunks = []
  ws.entities = new Map()
  useStore.getState().patchWorkspace({
    docs: [],
    status: 'empty',
    entities: [],
    graph: null,
    selected: null,
    chat: [],
    chatStatus: 'idle',
    error: null,
  })
}

/* ------------------------------------------------------------------ */

function rebuildGraph() {
  const cfg = appConfig.workspace
  const state = useStore.getState()
  const docs = state.workspace.docs

  const top = [...ws.entities.values()]
    .filter((e) => e.count >= cfg.minMentions)
    .sort((a, b) => b.count - a.count)
    .slice(0, cfg.maxEntities)

  const nodes = [
    ...docs.map((d) => ({ id: d.id, label: d.name, type: 'DOC', weight: 3 + d.chunks })),
    ...top.map((e) => ({ id: e.key, label: e.surface, type: e.type, weight: 1 + Math.min(e.count, 8) })),
  ]

  const links = []
  // entity — document edges
  for (const e of top) {
    for (const docId of e.docs) {
      links.push({ source: e.key, target: docId, weight: Math.min(e.count, 6), kind: 'mention' })
    }
  }
  // entity — entity co-occurrence (shared chunks)
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      let shared = 0
      for (const ck of top[i].chunkKeys) if (top[j].chunkKeys.has(ck)) shared++
      if (shared > 0) {
        links.push({ source: top[i].key, target: top[j].key, weight: shared, kind: 'cooccur' })
      }
    }
  }

  state.patchWorkspace({ graph: { nodes, links } })
}

/** Chunks that mention the selected entity — for the graph side panel. */
export function chunksForEntity(entityKey) {
  const e = ws.entities.get(entityKey)
  if (!e) return []
  return ws.chunks.filter((c) => e.chunkKeys.has(c.key)).slice(0, 4)
}

/* ------------------------------------------------------------------ */

export async function askWorkspace(question) {
  const store = useStore.getState()
  const cfg = appConfig.workspace
  if (ws.chunks.length === 0) return

  const history = store.workspace.chat
  store.patchWorkspace({
    chat: [...history, { role: 'user', text: question }],
    chatStatus: 'thinking',
    error: null,
  })

  try {
    // retrieval scoped to the workspace store
    const { vectors, dims } = await engine.client.embed([question], 'query')
    const hits = ws.vectors.topK(vectors.subarray(0, dims), cfg.chatTopK)
    const passages = hits
      .map((h) => ws.chunks.find((c) => c.key === h.key))
      .filter(Boolean)

    await initGemma(modelsConfig.llm.gemma)
    const prompt = buildChatPrompt(question, passages, history.slice(-cfg.historyTurns * 2))

    store.patchWorkspace({
      chat: [...useStore.getState().workspace.chat, { role: 'assistant', text: '', streaming: true }],
      chatStatus: 'streaming',
    })
    const t0 = performance.now()
    await generateText(prompt, (text) => {
      const chat = [...useStore.getState().workspace.chat]
      chat[chat.length - 1] = {
        role: 'assistant',
        text,
        streaming: true,
        cites: citedDocs(text, passages),
      }
      useStore.getState().patchWorkspace({ chat })
    })
    const chat = [...useStore.getState().workspace.chat]
    const last = chat[chat.length - 1]
    chat[chat.length - 1] = { ...last, streaming: false }
    useStore.getState().patchWorkspace({ chat, chatStatus: 'idle' })
    useStore.getState().logEvent({ kind: 'chat', ms: performance.now() - t0, scope: 'workspace' })
  } catch (err) {
    useStore.getState().patchWorkspace({ chatStatus: 'idle', error: String(err.message ?? err) })
  }
}

function buildChatPrompt(question, passages, history) {
  const context = passages
    .map((p, i) => `[${i + 1}] ${p.docTitle} — ${p.heading}\n${p.text.slice(0, 900)}`)
    .join('\n\n')
  const turns = history
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
    .join('\n')
  return [
    'You are a document analyst. Answer using ONLY the numbered excerpts below.',
    'Cite excerpts as [1], [2]… after claims. If the excerpts do not contain the answer, say so plainly.',
    'Be concise. Never repeat a sentence.',
    '',
    context,
    '',
    turns ? `Conversation so far:\n${turns}\n` : '',
    `User: ${question}`,
    'Assistant:',
  ].join('\n')
}

function citedDocs(text, passages) {
  const nums = [...new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))]
  return nums
    .map((n) => passages[n - 1])
    .filter(Boolean)
    .map((p, i) => ({ n: nums[i], title: p.docTitle, heading: p.heading }))
}
