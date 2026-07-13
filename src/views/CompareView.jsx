import { useState } from 'react'
import { useStore, selectReady } from '../state/store.js'
import { runCompare } from '../services/searchService.js'
import { RankDelta, EmptyState } from '../components/primitives.jsx'
import { formatMs } from '../lib/format.js'

/** Queries chosen so keyword search visibly fails (paraphrase, synonym, Hindi). */
const HARD_QUERIES = [
  'money left the account but the order shows unpaid',
  'stop charging my customer every month',
  'prove the webhook actually came from you',
  'ग्राहक का पैसा वापस कब आएगा',
]

export function CompareView() {
  const ready = useStore(selectReady)
  const compare = useStore((s) => s.compare)
  const [text, setText] = useState('')

  const go = (q) => {
    const query = (q ?? text).trim()
    if (!query || !ready) return
    setText(query)
    runCompare(query)
  }

  return (
    <div className="view">
      <header className="view__head">
        <h2>Compare</h2>
        <p className="view__sub">
          The same candidate pool, ordered two ways: keyword relevance (BM25) versus on-device
          semantic reranking. Server-side, this re-score is a paid API call — here it costs
          milliseconds.
        </p>
      </header>

      <div className="tester">
        <input
          className="tester__input"
          placeholder="Try a paraphrase keyword search can't handle…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          disabled={!ready}
        />
        <button className="btn btn--accent" onClick={() => go()} disabled={!ready || !text.trim()}>
          Compare
        </button>
      </div>

      <div className="suggestions">
        {HARD_QUERIES.map((q) => (
          <button key={q} className="suggestion" onClick={() => go(q)}>
            {q}
          </button>
        ))}
      </div>

      {compare.status === 'idle' && <EmptyState title="Run a query to see both orderings." />}

      {compare.status === 'done' && (
        <>
          <div className="columns">
            <section className="column">
              <h3 className="column__title">
                Keyword <span className="mono dim">BM25 · {formatMs(compare.timings.keywordMs)}</span>
              </h3>
              {compare.keyword.map((r) => (
                <CompareRow key={r.chunk.key} rank={r.rank} title={r.doc?.title} heading={r.chunk.heading} />
              ))}
              {compare.keyword.length === 0 && <p className="dim">No keyword hits at all.</p>}
            </section>
            <section className="column column--accent">
              <h3 className="column__title">
                Semantic rerank{' '}
                <span className="mono dim">
                  on-device · {formatMs(compare.timings.embedMs + compare.timings.rerankMs)}
                </span>
              </h3>
              {compare.reranked.map((r) => (
                <CompareRow
                  key={r.chunk.key}
                  rank={r.rank}
                  title={r.doc?.title}
                  heading={r.chunk.heading}
                  delta={r.delta}
                  score={r.semScore}
                />
              ))}
            </section>
          </div>
          <p className="timings mono">
            candidates {compare.keyword.length} · query embed {formatMs(compare.timings.embedMs)} ·
            re-score {formatMs(compare.timings.rerankMs)} · server calls: 0
          </p>
        </>
      )}
    </div>
  )
}

function CompareRow({ rank, title, heading, delta, score }) {
  return (
    <div className="crow">
      <span className="crow__rank mono">{rank}</span>
      <span className="crow__body">
        <span className="crow__title">{title}</span>
        <span className="crow__heading dim">{heading}</span>
      </span>
      {typeof score === 'number' && <span className="mono dim">{score.toFixed(2)}</span>}
      {delta !== undefined && <RankDelta delta={delta} />}
    </div>
  )
}
