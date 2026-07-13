import { useState } from 'react'
import { formatMs, cn } from '../lib/format.js'

const STATUS_GLYPH = {
  done: '●',
  skipped: '○',
  'failed-skipped': '◌',
  failed: '✕',
}

/**
 * Collapsible per-stage trace of the last query — which stages ran, on
 * what, how long. The System view's honesty, inlined into the flow.
 */
export function PipelineInspector({ trace, totalMs }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="inspector">
      <button className="inspector__summary mono" onClick={() => setOpen(!open)} aria-expanded={open}>
        {trace
          .filter((s) => s.status === 'done')
          .map((s) => `${s.id} ${formatMs(s.ms)}`)
          .join(' · ')}
        {totalMs != null && ` · total ${formatMs(totalMs)}`} · server calls: 0 {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="inspector__detail">
          {trace.map((s) => (
            <p key={s.id} className={cn('inspector__row mono', `inspector__row--${s.status}`)}>
              <span className="inspector__glyph">{STATUS_GLYPH[s.status] ?? '·'}</span>
              <span className="inspector__label">{s.label}</span>
              <span className="inspector__status">{s.status}</span>
              <span>{formatMs(s.ms)}</span>
              {s.detail && <span className="inspector__note">{s.detail}</span>}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
