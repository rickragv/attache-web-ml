import { cn, formatBytes } from '../lib/format.js'

export function Badge({ category, children }) {
  return (
    <span className="badge" data-cat={category}>
      {children ?? category}
    </span>
  )
}

export function Pill({ tone = 'neutral', children, className, ...rest }) {
  return (
    <span className={cn('pill', `pill--${tone}`, className)} {...rest}>
      {children}
    </span>
  )
}

export function ScoreBar({ value, max = 1 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <span className="scorebar" role="img" aria-label={`similarity ${value.toFixed(3)}`}>
      <span className="scorebar__fill" style={{ width: `${pct}%` }} />
    </span>
  )
}

export function ProgressBar({ loaded, total, indeterminate, unit = 'bytes' }) {
  const pct = total > 0 ? Math.min(100, (loaded / total) * 100) : 0
  const label =
    unit === 'bytes' ? `${formatBytes(loaded)} / ${formatBytes(total)}` : `${loaded} / ${total}`
  return (
    <div className={cn('progress', indeterminate && 'progress--indeterminate')}>
      <div className="progress__fill" style={indeterminate ? undefined : { width: `${pct}%` }} />
      {!indeterminate && total > 0 && <span className="progress__label mono">{label}</span>}
    </div>
  )
}

export function RankDelta({ delta }) {
  if (delta === null || delta === undefined) {
    return (
      <span className="rankdelta rankdelta--new mono" title="Not in keyword results at all">
        new
      </span>
    )
  }
  if (delta === 0) return <span className="rankdelta mono">·</span>
  const up = delta > 0
  return (
    <span
      className={cn('rankdelta mono', up ? 'rankdelta--up' : 'rankdelta--down')}
      title={`Moved ${up ? 'up' : 'down'} ${Math.abs(delta)} place(s) vs keyword search`}
    >
      {up ? '▲' : '▼'}
      {Math.abs(delta)}
    </span>
  )
}

export function EmptyState({ title, children }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  )
}

export function Sparkline({ values, width = 120, height = 28 }) {
  if (!values?.length) return <span className="mono dim">no samples</span>
  const max = Math.max(...values, 1)
  const pts = values
    .map((v, i) => `${(i / Math.max(1, values.length - 1)) * width},${height - (v / max) * (height - 4) - 2}`)
    .join(' ')
  return (
    <svg width={width} height={height} className="sparkline" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
