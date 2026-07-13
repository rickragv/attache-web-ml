export function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  return `${n >= 100 ? Math.round(n) : n.toFixed(1)} ${units[i]}`
}

export function formatMs(ms) {
  if (!Number.isFinite(ms)) return '—'
  if (ms < 1) return '<1 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}
