import { useEffect } from 'react'
import { Badge } from './primitives.jsx'
import { IconClose } from './icons.jsx'
import { formatDate } from '../lib/format.js'

/** Mobile-first bottom sheet (dialog on desktop) showing a full document. */
export function DocSheet({ doc, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!doc) return null
  return (
    <div className="sheet__backdrop" onClick={onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={doc.title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet__head">
          <div>
            <h3>{doc.title}</h3>
            <div className="result__meta" style={{ marginTop: 6 }}>
              <Badge category={doc.category} />
              <span className="mono dim">{doc.collection}</span>
              <span className="mono dim">{formatDate(doc.updated)}</span>
              {doc.owner && <span className="mono dim">@{doc.owner}</span>}
            </div>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </header>
        <div className="sheet__body">
          {doc.body.split(/\n{2,}/).map((block, i) => (
            <BodyBlock key={i} block={block} />
          ))}
        </div>
      </section>
    </div>
  )
}

function BodyBlock({ block }) {
  const h = block.match(/^(#{1,4})\s+(.*)/)
  if (h) {
    return <h4 className="sheet__h">{h[2]}</h4>
  }
  if (/^([-*]|\d+\.)\s/.test(block) || block.includes('\n- ') || block.startsWith('|')) {
    return <pre className="sheet__pre">{block.replace(/^[-*]\s/gm, '• ')}</pre>
  }
  return <p className="sheet__p">{block}</p>
}
