import { appConfig } from '../config/app.config.js'
import { useStore } from '../state/store.js'
import { formatBytes, cn } from '../lib/format.js'
import {
  IconAsk,
  IconLibrary,
  IconGraph,
  IconRouting,
  IconCompare,
  IconSystem,
  IconOffline,
} from './icons.jsx'

const NAV = [
  { id: 'ask', label: 'Ask', Icon: IconAsk },
  { id: 'library', label: 'Library', Icon: IconLibrary },
  { id: 'workspace', label: 'Workspace', Icon: IconGraph },
  { id: 'routing', label: 'Routing', Icon: IconRouting },
  { id: 'compare', label: 'Compare', Icon: IconCompare },
  { id: 'system', label: 'System', Icon: IconSystem },
]

export function AppShell({ children }) {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const online = useStore((s) => s.online)
  const offlineDrill = useStore((s) => s.offlineDrill)

  return (
    <div className="shell">
      <header className="shell__header">
        <button className="wordmark" onClick={() => setView('ask')} aria-label="Attaché home">
          {appConfig.wordmark}
          <span className="wordmark__sub">on-device</span>
        </button>
        <div className="shell__header-right">
          {(offlineDrill || !online) && (
            <span className="pill pill--warn offline-pill">
              <IconOffline width={13} height={13} />
              {offlineDrill ? 'offline drill' : 'offline'}
            </span>
          )}
          <EngineStatusPill />
        </div>
      </header>

      <nav className="shell__nav" aria-label="Primary">
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={cn('nav__item', view === id && 'nav__item--active')}
            aria-current={view === id ? 'page' : undefined}
            onClick={() => setView(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <main className="shell__main">{children}</main>
    </div>
  )
}

function EngineStatusPill() {
  const engine = useStore((s) => s.engine)
  const indexing = useStore((s) => s.corpus.indexing)
  const setView = useStore((s) => s.setView)

  let tone = 'neutral'
  let text = 'engine idle'
  if (engine.status === 'loading') {
    tone = 'warn'
    const p = engine.progress
    text =
      p?.phase === 'weights' && p.total
        ? `downloading ${Math.round((p.loaded / p.total) * 100)}%`
        : (p?.phase ?? 'starting')
  } else if (engine.status === 'ready' && indexing.state !== 'done') {
    tone = 'warn'
    text = `indexing ${indexing.done}/${indexing.total}`
  } else if (engine.status === 'ready') {
    tone = 'ok'
    text = `${engine.label} · ${engine.backend}`
  } else if (engine.status === 'error') {
    tone = 'danger'
    text = 'engine error'
  }

  return (
    <button
      className={cn('pill', `pill--${tone}`, 'engine-pill')}
      onClick={() => setView('system')}
      title={
        engine.progress?.loaded
          ? `${formatBytes(engine.progress.loaded)} fetched`
          : 'Open System view'
      }
    >
      <span className={cn('dot', `dot--${tone}`)} />
      {text}
    </button>
  )
}
