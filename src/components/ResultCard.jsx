import { Badge, ScoreBar, RankDelta } from './primitives.jsx'
import { formatDate } from '../lib/format.js'

export function ResultCard({ result, showDelta = true, onOpen }) {
  const { chunk, doc, score, keywordRank, semRank } = result
  return (
    <article className="result">
      <header className="result__head">
        <button className="result__title" onClick={() => onOpen?.(doc)}>
          {doc?.title ?? chunk.docId}
        </button>
        {showDelta && <RankDelta delta={keywordRank === null ? null : keywordRank - semRank} />}
      </header>
      <div className="result__meta">
        <Badge category={doc?.category} />
        <span className="mono dim">{doc?.collection}</span>
        {doc?.locale === 'hi' && <span className="pill pill--neutral">हिन्दी</span>}
        <span className="mono dim">{formatDate(doc?.updated)}</span>
      </div>
      {chunk.heading && chunk.heading !== doc?.title && (
        <p className="result__heading">{chunk.heading}</p>
      )}
      <p className="result__snippet">{snippet(chunk.text)}</p>
      <footer className="result__foot">
        <ScoreBar value={Math.max(0, score)} max={0.85} />
        <span className="mono dim">{score.toFixed(3)}</span>
      </footer>
    </article>
  )
}

function snippet(text, len = 260) {
  const clean = text.replace(/\s+/g, ' ').replace(/[#*|>`]/g, '').trim()
  return clean.length > len ? clean.slice(0, len).trimEnd() + '…' : clean
}
