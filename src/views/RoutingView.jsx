import { useState } from 'react'
import { useStore, selectReady } from '../state/store.js'
import { rebuildPrototypes } from '../services/engineService.js'
import { engine } from '../services/engineService.js'
import { classifyQuery } from '../services/searchService.js'
import { Pill, EmptyState } from '../components/primitives.jsx'
import { IconPlus, IconTrash } from '../components/icons.jsx'
import { formatMs, cn } from '../lib/format.js'

export function RoutingView() {
  const ready = useStore(selectReady)
  const routes = useStore((s) => s.routes)
  const setRoutes = useStore((s) => s.setRoutes)
  const prototypesReady = useStore((s) => s.prototypesReady)
  const setPrototypesReady = useStore((s) => s.setPrototypesReady)
  const [dirty, setDirty] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [test, setTest] = useState('')
  const [verdict, setVerdict] = useState(null)

  const mutate = (fn) => {
    setRoutes(fn(routes))
    setDirty(true)
    setPrototypesReady(false)
  }

  async function apply() {
    setRebuilding(true)
    try {
      await rebuildPrototypes()
      setDirty(false)
    } finally {
      setRebuilding(false)
    }
  }

  async function runTest(q) {
    const query = (q ?? test).trim()
    if (!query || !ready || !prototypesReady) return
    const t0 = performance.now()
    const { vectors, dims } = await engine.client.embed([query], 'query')
    const result = await classifyQuery(vectors.subarray(0, dims))
    setVerdict({ ...result, ms: performance.now() - t0, query })
  }

  return (
    <div className="view">
      <header className="view__head">
        <h2>Routing</h2>
        <p className="view__sub">
          Zero-shot triage from embedding prototypes. Edit any route and rebuild — a new classifier
          in milliseconds, no training, no server.
        </p>
      </header>

      <div className="tester">
        <input
          className="tester__input"
          placeholder="Type a query to classify…"
          value={test}
          onChange={(e) => setTest(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runTest()}
          disabled={!ready || !prototypesReady}
        />
        <button className="btn btn--accent" onClick={() => runTest()} disabled={!ready || !prototypesReady || !test.trim()}>
          Classify
        </button>
      </div>

      {!prototypesReady && !dirty && <p className="mono dim">building prototypes…</p>}
      {dirty && (
        <div className="applybar">
          <span>Routes changed — prototypes are stale.</span>
          <button className="btn btn--accent" onClick={apply} disabled={rebuilding || !ready}>
            {rebuilding ? 'Rebuilding…' : 'Apply & rebuild prototypes'}
          </button>
        </div>
      )}

      {verdict && (
        <div className="verdict">
          <p className="verdict__query">“{verdict.query}”</p>
          <div className="verdict__bars">
            {verdict.scores.map((s) => (
              <div key={s.routeId} className="verdict__row">
                <span className={cn('verdict__label', s.routeId === verdict.routeId && 'verdict__label--top')}>
                  {s.label}
                  {s.gate && <Pill tone="warn">gate</Pill>}
                </span>
                <span className="verdict__bar">
                  <span
                    className={cn('verdict__fill', s.routeId === verdict.routeId && 'verdict__fill--top')}
                    style={{ width: `${Math.max(2, s.score * 100)}%` }}
                  />
                </span>
                <span className="mono dim">{(s.score * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <p className="mono dim">
            classified in {formatMs(verdict.ms)} — {verdict.gate ? 'would be GATED' : 'passes to retrieval'}
          </p>
        </div>
      )}

      {!ready && <EmptyState title="Waiting for the engine." />}

      <div className="routes">
        {routes.map((route, ri) => (
          <section key={route.id} className="route">
            <header className="route__head">
              <input
                className="route__label"
                value={route.label}
                onChange={(e) => mutate((rs) => rs.map((r, i) => (i === ri ? { ...r, label: e.target.value } : r)))}
                aria-label="Route label"
              />
              <label className="route__gate">
                <input
                  type="checkbox"
                  checked={route.gate}
                  onChange={(e) => mutate((rs) => rs.map((r, i) => (i === ri ? { ...r, gate: e.target.checked } : r)))}
                />
                gate
              </label>
              <button
                className="iconbtn iconbtn--danger"
                onClick={() => mutate((rs) => rs.filter((_, i) => i !== ri))}
                aria-label={`Delete route ${route.label}`}
              >
                <IconTrash width={16} height={16} />
              </button>
            </header>
            <p className="route__desc">{route.description}</p>
            <div className="route__exemplars">
              {route.exemplars.map((ex, ei) => (
                <span key={ei} className="exemplar">
                  {ex}
                  <button
                    onClick={() =>
                      mutate((rs) =>
                        rs.map((r, i) =>
                          i === ri ? { ...r, exemplars: r.exemplars.filter((_, j) => j !== ei) } : r,
                        ),
                      )
                    }
                    aria-label="Remove exemplar"
                  >
                    ×
                  </button>
                </span>
              ))}
              <ExemplarAdder
                onAdd={(txt) =>
                  mutate((rs) =>
                    rs.map((r, i) => (i === ri ? { ...r, exemplars: [...r.exemplars, txt] } : r)),
                  )
                }
              />
            </div>
          </section>
        ))}
        <button
          className="btn route__add"
          onClick={() =>
            mutate((rs) => [
              ...rs,
              {
                id: `route-${Date.now().toString(36)}`,
                label: 'New route',
                description: '',
                gate: false,
                exemplars: [],
              },
            ])
          }
        >
          <IconPlus width={16} height={16} /> Add route
        </button>
      </div>
    </div>
  )
}

function ExemplarAdder({ onAdd }) {
  const [val, setVal] = useState('')
  return (
    <input
      className="exemplar exemplar--input"
      placeholder="+ add example phrase"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && val.trim()) {
          onAdd(val.trim())
          setVal('')
        }
      }}
    />
  )
}
