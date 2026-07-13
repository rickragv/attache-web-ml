import { useState, useRef } from 'react'
import { useStore, selectReady } from '../state/store.js'
import { docFromUpload } from '../services/corpusService.js'
import { indexUserDoc } from '../services/engineService.js'
import { appConfig } from '../config/app.config.js'
import { Badge, EmptyState } from '../components/primitives.jsx'
import { DocSheet } from '../components/DocSheet.jsx'
import { ScanOverlay } from '../components/ScanOverlay.jsx'
import { IconUpload, IconScan } from '../components/icons.jsx'
import { formatDate, cn } from '../lib/format.js'

export function LibraryView() {
  const docs = useStore((s) => s.corpus.docs)
  const stats = useStore((s) => s.corpus.stats)
  const ready = useStore(selectReady)
  const [openDoc, setOpenDoc] = useState(null)
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [scanning, setScanning] = useState(false)
  const fileRef = useRef(null)

  const collections = [...new Set(docs.map((d) => d.collection))]
  const shown = filter === 'all' ? docs : docs.filter((d) => d.collection === filter)

  async function handleFiles(fileList) {
    if (!ready || busy) return
    setBusy(true)
    try {
      for (const file of fileList) {
        if (!/\.(md|txt|markdown)$/i.test(file.name)) continue
        const text = await file.text()
        await indexUserDoc(docFromUpload(file.name, text))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="view">
      <header className="view__head">
        <h2>Library</h2>
        <p className="view__sub">
          {stats
            ? `${stats.docCount} documents · ${stats.chunkCount} chunks · ${stats.words.toLocaleString('en-IN')} words · ${Object.keys(stats.byLocale).join(' + ')}`
            : 'loading corpus…'}
        </p>
      </header>

      {appConfig.features.uploads && (
        <div
          className={cn('dropzone', dragOver && 'dropzone--over', !ready && 'dropzone--disabled')}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFiles(e.dataTransfer.files)
          }}
        >
          <IconUpload />
          <p>
            {busy
              ? 'Embedding your documents on-device…'
              : 'Drop .md / .txt files — they are chunked and embedded locally, never uploaded.'}
          </p>
          <div className="scan__actions">
            <button className="btn" onClick={() => fileRef.current?.click()} disabled={!ready || busy}>
              Choose files
            </button>
            {appConfig.features.scan && (
              <button className="btn btn--accent" onClick={() => setScanning(true)} disabled={!ready || busy}>
                <IconScan width={16} height={16} /> Scan document
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.txt,.markdown"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      <div className="filterrow" role="tablist" aria-label="Collections">
        <button className={cn('chip', filter === 'all' && 'chip--on')} onClick={() => setFilter('all')}>
          all
        </button>
        {collections.map((c) => (
          <button key={c} className={cn('chip', filter === c && 'chip--on')} onClick={() => setFilter(c)}>
            {c}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No documents in this collection." />
      ) : (
        <div className="doclist">
          {shown.map((d) => (
            <button key={d.id} className="doccard" onClick={() => setOpenDoc(d)}>
              <span className="doccard__title">{d.title}</span>
              <span className="doccard__meta">
                <Badge category={d.category} />
                <span className="mono dim">{d.collection}</span>
                {d.locale === 'hi' && <span className="pill pill--neutral">हिन्दी</span>}
                {d.audience === 'internal' && <span className="pill pill--warn">internal</span>}
                <span className="mono dim">{formatDate(d.updated)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <DocSheet doc={openDoc} onClose={() => setOpenDoc(null)} />
      {scanning && (
        <ScanOverlay
          onClose={(doc) => {
            setScanning(false)
            if (doc) setOpenDoc(doc)
          }}
        />
      )}
    </div>
  )
}
