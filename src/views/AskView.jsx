import { useState, useRef, useCallback } from 'react'
import { useStore, selectReady } from '../state/store.js'
import { runAsk } from '../services/searchService.js'
import { startDictation, stopDictation, dictationCapability } from '../services/dictationService.js'
import { appConfig } from '../config/app.config.js'
import { ResultCard } from '../components/ResultCard.jsx'
import { DocSheet } from '../components/DocSheet.jsx'
import { PipelineInspector } from '../components/PipelineInspector.jsx'
import { Pill, ProgressBar, EmptyState } from '../components/primitives.jsx'
import { IconMic, IconArrowUp, IconShield } from '../components/icons.jsx'
import { formatMs, formatBytes, cn } from '../lib/format.js'

const SUGGESTIONS = [
  'refund initiated but customer not credited after 5 days',
  'webhook signature verification failing intermittently',
  'settlement batch delayed this morning — runbook?',
  'रिफ़ंड की स्थिति कैसे देखें',
  'how long do we keep cardholder PII',
]

export function AskView() {
  const ready = useStore(selectReady)
  const ask = useStore((s) => s.ask)
  const dictation = useStore((s) => s.dictation)
  const [text, setText] = useState('')
  const [openDoc, setOpenDoc] = useState(null)
  const inputRef = useRef(null)

  const submit = useCallback(
    (q) => {
      const query = (q ?? text).trim()
      if (!query || !ready) return
      setText(query)
      runAsk(query)
    },
    [text, ready],
  )

  const micCap = appConfig.features.dictation ? dictationCapability() : null
  const toggleMic = () => {
    if (dictation.listening) {
      stopDictation()
    } else {
      startDictation({
        locale: 'en',
        onFinal: (t) => {
          setText((prev) => (prev ? prev + ' ' : '') + t)
          inputRef.current?.focus()
        },
      })
    }
  }

  return (
    <div className="view view--ask">
      <section className="hero">
        <h1 className="hero__title">Ask the {appConfig.corpusLabel}.</h1>
        <p className="hero__sub">
          <IconShield width={14} height={14} /> Every keystroke is processed on this device. Nothing
          is uploaded — ask about anything in the corpus, in English or हिन्दी.
        </p>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <textarea
            ref={inputRef}
            className="composer__input"
            rows={2}
            placeholder={ready ? 'e.g. why was the customer debited but the payment failed?' : 'Preparing the on-device engine…'}
            value={dictation.listening && dictation.interim ? `${text} ${dictation.interim}` : text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            disabled={!ready}
          />
          <div className="composer__actions">
            {micCap && (
              <button
                type="button"
                className={cn('iconbtn composer__mic', dictation.listening && 'composer__mic--live')}
                onClick={toggleMic}
                disabled={!ready}
                aria-pressed={dictation.listening}
                aria-label={dictation.listening ? 'Stop dictation' : 'Start dictation'}
                title={micCap.onDevice ? 'On-device transcription' : 'Browser speech engine (may use cloud on Chrome)'}
              >
                <IconMic />
              </button>
            )}
            <button type="submit" className="iconbtn composer__go" disabled={!ready || !text.trim()} aria-label="Ask">
              <IconArrowUp />
            </button>
          </div>
        </form>

        {dictation.listening && (
          <p className="mic-note">
            <span className="mic-pulse" /> listening via {dictation.label}
            {!dictation.onDevice && ' — browser engine, may leave device'}
          </p>
        )}

        {!ready && <BootStatus />}

        {ready && ask.status === 'idle' && (
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="suggestion" onClick={() => submit(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </section>

      {ask.triage && <TriageStrip triage={ask.triage} />}

      {ask.status === 'gated' && (
        <EmptyState title="Gated before the pipeline.">
          Triage classified this as “{ask.triage.label}” in {formatMs(ask.triage.ms)} — in
          production this query would never spend a credit or touch a server.
        </EmptyState>
      )}

      {ask.status === 'done' && ask.results.length === 0 && (
        <EmptyState title="Nothing scored above the noise floor.">
          Try rephrasing, or lower <code>search.minScore</code> in retrieval.config.js.
        </EmptyState>
      )}

      {ask.results.length > 0 && (
        <>
          {appConfig.features.answer && <AnswerPanel query={ask.query} results={ask.results} />}
          <section className="results">
            {ask.results.map((r) => (
              <ResultCard key={r.chunk.key} result={r} onOpen={setOpenDoc} />
            ))}
          </section>
        </>
      )}

      {ask.trace.length > 0 && ask.status !== 'running' && (
        <PipelineInspector trace={ask.trace} totalMs={ask.timings?.totalMs} />
      )}

      <DocSheet doc={openDoc} onClose={() => setOpenDoc(null)} />
    </div>
  )
}

function AnswerPanel({ query, results }) {
  const answer = useStore((s) => s.answer)

  return (
    <div className="answer" aria-live="polite">
      {answer.status === 'idle' && (
        <button
          className="btn btn--accent"
          onClick={async () => {
            const { runAnswer } = await import('../services/answerService.js')
            runAnswer(query, results)
          }}
        >
          Synthesize verified answer — Gemma + NLI, on-device
        </button>
      )}

      {answer.status === 'loading-model' && (
        <p className="boot__line">
          Loading Gemma ({answer.modelPhase ?? 'weights'}) — 2 GB, one-time, cached after…
        </p>
      )}

      {answer.claims.length > 0 && (
        <div className="answer__claims">
          {answer.claims.map((c, i) => (
            <p key={i} className={cn('claim', `claim--${c.partial ? 'pending' : c.status}`)}>
              {c.text}
              {!c.partial && <ClaimBadge claim={c} />}
            </p>
          ))}
        </div>
      )}

      {(answer.status === 'generating' || answer.status === 'verifying') && (
        <p className="mono dim">
          {answer.status === 'generating' ? 'generating' : 'verifying claims'} ·{' '}
          {answer.tokensPerSec} tok/s ·{' '}
          {answer.verifier === 'active'
            ? 'NLI verifier active'
            : answer.verifier === 'unavailable'
              ? 'verifier unavailable — claims render unverified'
              : 'verifier warming up'}
        </p>
      )}

      {answer.status === 'done' && (
        <p className="mono dim">
          {answer.verifier === 'active'
            ? `${answer.supported}/${answer.total} claims supported by retrieved passages`
            : 'verifier unavailable — claims are unverified'}{' '}
          · {answer.tokensPerSec} tok/s · server calls: 0
        </p>
      )}

      {answer.error && <p className="error">{answer.error}</p>}
    </div>
  )
}

function ClaimBadge({ claim }) {
  if (claim.status === 'supported') {
    return (
      <span className="claim__badge claim__badge--ok" title={`entailment ${(claim.entailment * 100).toFixed(0)}%`}>
        ✓ {claim.cites.length ? claim.cites.map((c) => `[${c}]`).join('') : 'supported'}
      </span>
    )
  }
  if (claim.status === 'contradicted') {
    return (
      <span className="claim__badge claim__badge--bad">
        ⚠ contradicts the retrieved passages
      </span>
    )
  }
  if (claim.status === 'uncertain') {
    return (
      <span className="claim__badge claim__badge--warn" title="NLI could not entail this claim from the cited passage — verify manually">
        ~ could not confirm
      </span>
    )
  }
  if (claim.status === 'unverified') {
    return <span className="claim__badge">unverified</span>
  }
  return <span className="claim__badge">…</span>
}

function TriageStrip({ triage }) {
  return (
    <div className="triage" role="status">
      <Pill tone={triage.gate ? 'warn' : 'ok'}>{triage.label}</Pill>
      <span className="mono dim">{(triage.confidence * 100).toFixed(0)}% match</span>
      <Pill tone="neutral">{triage.locale === 'hi' ? 'हिन्दी' : 'English'}</Pill>
      <span className="mono dim">{formatMs(triage.ms)}</span>
    </div>
  )
}

function BootStatus() {
  const engine = useStore((s) => s.engine)
  const indexing = useStore((s) => s.corpus.indexing)

  if (engine.status === 'error') {
    return (
      <div className="boot boot--error">
        <p>Engine failed to start: {engine.error}</p>
      </div>
    )
  }

  const p = engine.progress
  return (
    <div className="boot">
      {engine.status === 'loading' && (
        <>
          <p className="boot__line">
            {p?.phase === 'weights'
              ? `Fetching ${p.detail ?? 'model weights'} — cached after first load`
              : `Starting on-device engine ${p?.detail ? `· ${p.detail}` : ''}`}
          </p>
          <ProgressBar
            loaded={p?.loaded ?? 0}
            total={p?.total ?? p?.totalBytes ?? 0}
            indeterminate={!p?.total && !p?.loaded}
          />
          {p?.loaded > 0 && <span className="mono dim">{formatBytes(p.loaded)}</span>}
        </>
      )}
      {engine.status === 'ready' && indexing.state !== 'done' && (
        <>
          <p className="boot__line">
            Embedding the corpus on-device · {indexing.done}/{indexing.total} chunks
            {indexing.fromCache && ' (from cache)'}
          </p>
          <ProgressBar loaded={indexing.done} total={indexing.total} unit="count" />
        </>
      )}
    </div>
  )
}
