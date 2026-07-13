import { useRef, useState, useEffect } from 'react'
import { useStore, selectReady } from '../state/store.js'
import { appConfig } from '../config/app.config.js'
import { ingestFiles, resetWorkspace, askWorkspace, chunksForEntity } from '../services/workspaceService.js'
import { GraphCanvas, GRAPH_TYPE_COLORS } from '../components/GraphCanvas.jsx'
import { Pill, EmptyState } from '../components/primitives.jsx'
import { IconUpload, IconTrash, IconArrowUp } from '../components/icons.jsx'
import { cn } from '../lib/format.js'

export function WorkspaceView() {
  const ready = useStore(selectReady)
  const workspace = useStore((s) => s.workspace)
  const patchWorkspace = useStore((s) => s.patchWorkspace)
  const fileRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const cfg = appConfig.workspace

  return (
    <div className="view">
      <header className="view__head">
        <h2>Workspace</h2>
        <p className="view__sub">
          A private analysis room: drop up to {cfg.maxDocs} documents — they are embedded, entities
          are extracted, a knowledge graph is built, and you chat with the set. Nothing leaves this
          tab.
        </p>
      </header>

      {workspace.error && <p className="error">{workspace.error}</p>}

      {/* ---- intake ---- */}
      <div
        className={cn('dropzone', dragOver && 'dropzone--over', (!ready || workspace.status === 'ingesting') && 'dropzone--disabled')}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (ready) ingestFiles(e.dataTransfer.files)
        }}
      >
        <IconUpload />
        <p>
          {workspace.status === 'ingesting'
            ? `Processing ${workspace.progress?.docName ?? '…'} — ${workspace.progress?.phase ?? ''} on-device`
            : `Drop .md / .txt files (${workspace.docs.length}/${cfg.maxDocs}) — embedding, entity extraction and the graph all run locally.`}
        </p>
        <div className="scan__actions">
          <button
            className="btn btn--accent"
            onClick={() => fileRef.current?.click()}
            disabled={!ready || workspace.status === 'ingesting' || workspace.docs.length >= cfg.maxDocs}
          >
            Choose files
          </button>
          {workspace.docs.length > 0 && (
            <button className="btn btn--danger" onClick={resetWorkspace} disabled={workspace.status === 'ingesting'}>
              <IconTrash width={15} height={15} /> Clear workspace
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".md,.txt,.markdown"
          multiple
          hidden
          onChange={(e) => {
            ingestFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {workspace.docs.length > 0 && (
        <div className="wsdocs">
          {workspace.docs.map((d) => (
            <span key={d.id} className="wsdoc">
              <span className={cn('dot', d.status === 'done' ? 'dot--ok' : 'dot--warn')} />
              {d.name}
              <span className="mono dim">
                {d.status === 'done' ? `${d.chunks} chunks · ${d.entities} entities` : d.status}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* ---- graph ---- */}
      {workspace.graph && workspace.status === 'ready' && (
        <section className="panel">
          <h3 className="panel__title">
            Knowledge graph{' '}
            <span className="mono dim">
              {workspace.graph.nodes.length} nodes ·{' '}
              {workspace.nerActive ? 'DistilBERT NER + patterns' : 'pattern extraction (NER unavailable)'}
            </span>
          </h3>
          <GraphCanvas
            graph={workspace.graph}
            selected={workspace.selected}
            onSelect={(id) => patchWorkspace({ selected: id })}
          />
          <div className="wslegend">
            {Object.entries(GRAPH_TYPE_COLORS).map(([type, color]) => (
              <span key={type} className="wslegend__item mono">
                <span className="dot" style={{ background: color }} /> {type}
              </span>
            ))}
          </div>
          {workspace.selected && <EntityDetail entityKey={workspace.selected} />}
        </section>
      )}

      {/* ---- chat ---- */}
      {workspace.status === 'ready' && <WorkspaceChat />}

      {workspace.status === 'empty' && (
        <EmptyState title="No documents yet.">
          Drop a contract, a report, meeting notes — anything text. The graph shows who and what
          they talk about; the chat answers from them alone.
        </EmptyState>
      )}
    </div>
  )
}

function EntityDetail({ entityKey }) {
  const [chunks, setChunks] = useState([])
  const entities = useStore((s) => s.workspace.entities)
  const entity = entities.find((e) => e.key === entityKey)
  useEffect(() => {
    setChunks(chunksForEntity(entityKey))
  }, [entityKey])
  if (!entity) return null
  return (
    <div className="wsentity">
      <p>
        <Pill tone="ok">{entity.type}</Pill> <strong>{entity.surface}</strong>{' '}
        <span className="mono dim">
          {entity.count} mention{entity.count > 1 ? 's' : ''} · {entity.docs.length} doc
          {entity.docs.length > 1 ? 's' : ''}
        </span>
      </p>
      {chunks.map((c) => (
        <p key={c.key} className="wsentity__chunk dim">
          <span className="mono">{c.docTitle} · {c.heading}</span> — {c.text.replace(/\s+/g, ' ').slice(0, 180)}…
        </p>
      ))}
    </div>
  )
}

function WorkspaceChat() {
  const workspace = useStore((s) => s.workspace)
  const [text, setText] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [workspace.chat])

  const send = () => {
    const q = text.trim()
    if (!q || workspace.chatStatus !== 'idle') return
    setText('')
    askWorkspace(q)
  }

  return (
    <section className="panel wschat">
      <h3 className="panel__title">
        Chat with these documents{' '}
        <span className="mono dim">Gemma · retrieval scoped to this workspace · offline</span>
      </h3>

      <div className="wschat__list" ref={listRef}>
        {workspace.chat.length === 0 && (
          <p className="dim">
            Ask anything about the uploaded set — e.g. “who is mentioned in more than one
            document?” or “summarize the payment terms”.
          </p>
        )}
        {workspace.chat.map((m, i) => (
          <div key={i} className={cn('msg', `msg--${m.role}`)}>
            <p className="msg__text">{m.text || '…'}</p>
            {m.cites?.length > 0 && !m.streaming && (
              <p className="msg__cites mono dim">
                {m.cites.map((c) => `[${c.n}] ${c.title} · ${c.heading}`).join('   ')}
              </p>
            )}
          </div>
        ))}
        {workspace.chatStatus === 'thinking' && <p className="mono dim">retrieving + loading Gemma…</p>}
      </div>

      <div className="composer wschat__composer">
        <textarea
          className="composer__input"
          rows={1}
          placeholder="Ask about the uploaded documents…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button
          className="iconbtn composer__go"
          onClick={send}
          disabled={!text.trim() || workspace.chatStatus !== 'idle'}
          aria-label="Send"
        >
          <IconArrowUp />
        </button>
      </div>
    </section>
  )
}
