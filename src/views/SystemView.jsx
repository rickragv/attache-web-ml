import { useEffect, useState } from 'react'
import { useStore } from '../state/store.js'
import { setEngineOffline } from '../services/engineService.js'
import { modelsConfig } from '../config/models.config.js'
import { appConfig } from '../config/app.config.js'
import { cacheStatus, clearModelCache } from '../ml/modelCache.js'
import { persistence } from '../ml/persistence.js'
import { Pill, Sparkline } from '../components/primitives.jsx'
import { formatBytes, formatMs, cn } from '../lib/format.js'

export function SystemView() {
  const engine = useStore((s) => s.engine)
  const corpus = useStore((s) => s.corpus)
  const telemetry = useStore((s) => s.telemetry)
  const offlineDrill = useStore((s) => s.offlineDrill)
  const online = useStore((s) => s.online)

  const [cache, setCache] = useState({})
  const [clearing, setClearing] = useState(false)

  const modelUrls = [
    modelsConfig.embedding.litert.modelUrl,
    modelsConfig.embedding.litert.tokenizerUrl,
    modelsConfig.embedding.mediapipe.modelUrl,
    modelsConfig.asr.whisper.modelUrl,
  ]

  useEffect(() => {
    cacheStatus(modelUrls).then(setCache).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.status, clearing])

  const avgEmbed =
    telemetry.embedMsSamples.length > 0
      ? telemetry.embedMsSamples.reduce((a, b) => a + b, 0) / telemetry.embedMsSamples.length
      : null

  return (
    <div className="view">
      <header className="view__head">
        <h2>System</h2>
        <p className="view__sub">
          The proof panel: what is running, where, and how fast. Everything here executes in this
          browser tab.
        </p>
      </header>

      <div className="syspanels">
        <section className="panel">
          <h3 className="panel__title">Inference engine</h3>
          <dl className="kv">
            <dt>Status</dt>
            <dd>
              <Pill tone={engine.status === 'ready' ? 'ok' : engine.status === 'error' ? 'danger' : 'warn'}>
                {engine.status}
              </Pill>
            </dd>
            <dt>Provider</dt>
            <dd>
              {engine.label || '—'}
              {engine.quality && (
                <Pill tone={engine.quality === 'flagship' ? 'ok' : engine.quality === 'standard' ? 'neutral' : 'warn'}>
                  {engine.quality}
                </Pill>
              )}
            </dd>
            <dt>Runtime</dt>
            <dd>{engine.runtime || '—'}</dd>
            <dt>Backend</dt>
            <dd className="mono">{engine.backend ?? '—'}</dd>
            <dt>Execution</dt>
            <dd className="mono">{engine.execution ?? '—'}</dd>
            <dt>Dimensions</dt>
            <dd className="mono">{engine.dims || '—'}</dd>
            <dt>Init time</dt>
            <dd className="mono">{engine.initMs ? formatMs(engine.initMs) : '—'}</dd>
          </dl>
          {engine.attempts?.length > 0 && (
            <div className="attempts">
              {engine.attempts.map((a) => (
                <p key={a.provider} className="dim">
                  <Pill tone="danger">{a.provider}</Pill> {a.error}
                </p>
              ))}
            </div>
          )}
          {engine.error && <p className="error">{engine.error}</p>}
        </section>

        <section className="panel">
          <h3 className="panel__title">Telemetry</h3>
          <dl className="kv">
            <dt>On-device inference calls</dt>
            <dd className="mono">{telemetry.inferenceCalls}</dd>
            <dt>Server inference calls</dt>
            <dd className="mono accent">{telemetry.serverInferenceCalls} — and it will stay that way</dd>
            <dt>Avg embed latency</dt>
            <dd className="mono">{avgEmbed ? formatMs(avgEmbed) : '—'}</dd>
            <dt>Recent embeds</dt>
            <dd>
              <Sparkline values={telemetry.embedMsSamples} />
            </dd>
          </dl>
          <div className="eventlog">
            {telemetry.events.slice(0, 8).map((e, i) => (
              <p key={i} className="mono dim">
                {e.kind} · {formatMs(e.ms)} {e.detail ? `· ${e.detail}` : ''} {e.scope ? `(${e.scope})` : ''}
              </p>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3 className="panel__title">Network posture</h3>
          <dl className="kv">
            <dt>Browser connectivity</dt>
            <dd>
              <Pill tone={online ? 'ok' : 'warn'}>{online ? 'online' : 'offline'}</Pill>
            </dd>
            <dt>Offline drill</dt>
            <dd>
              <button
                className={cn('switch', offlineDrill && 'switch--on')}
                role="switch"
                aria-checked={offlineDrill}
                onClick={() => setEngineOffline(!offlineDrill)}
                disabled={!appConfig.features.offlineDrill}
              >
                <span className="switch__thumb" />
              </button>
              <span className="dim">
                {offlineDrill
                  ? ' Network blocked in-app. Search, triage and rerank keep working.'
                  : ' Flip it, then keep searching — nothing breaks.'}
              </span>
            </dd>
          </dl>
        </section>

        <section className="panel">
          <h3 className="panel__title">Model cache</h3>
          <div className="cachelist">
            <CacheRow label="EmbeddingGemma 300M (LiteRT)" size={cache[modelsConfig.embedding.litert.modelUrl]} />
            <CacheRow label="SentencePiece tokenizer" size={cache[modelsConfig.embedding.litert.tokenizerUrl]} />
            <CacheRow label="Universal Sentence Encoder (MediaPipe)" size={cache[modelsConfig.embedding.mediapipe.modelUrl]} />
            <CacheRow label="Whisper tiny (LiteRT, gated)" size={cache[modelsConfig.asr.whisper.modelUrl]} />
          </div>
          <button
            className="btn btn--danger"
            disabled={clearing}
            onClick={async () => {
              setClearing(true)
              await clearModelCache()
              await persistence.clearVectors().catch(() => {})
              setClearing(false)
            }}
          >
            {clearing ? 'Clearing…' : 'Clear model & vector caches'}
          </button>
          <p className="dim">Reload after clearing to watch the full first-run download again.</p>
        </section>

        <section className="panel">
          <h3 className="panel__title">Corpus index</h3>
          <dl className="kv">
            <dt>Documents</dt>
            <dd className="mono">{corpus.stats?.docCount ?? '—'}</dd>
            <dt>Chunks</dt>
            <dd className="mono">{corpus.stats?.chunkCount ?? '—'}</dd>
            <dt>Words</dt>
            <dd className="mono">{corpus.stats?.words?.toLocaleString('en-IN') ?? '—'}</dd>
            <dt>Vectors</dt>
            <dd className="mono">
              {corpus.indexing.state === 'done'
                ? `${corpus.indexing.total} × ${engine.dims}${corpus.indexing.fromCache ? ' (restored from IndexedDB)' : ''}`
                : `${corpus.indexing.done}/${corpus.indexing.total}`}
            </dd>
          </dl>
        </section>

        <FlagshipPanel active={engine.provider === 'litert'} />

        <section className="panel">
          <h3 className="panel__title">Answer synthesis (Gemma)</h3>
          <p className="dim">
            The capstone stage streams a grounded answer from the top reranked passages using Gemma
            on-device via MediaPipe GenAI (LiteRT runtime). It ships disabled because the weights
            are multi-GB: set <code>features.answer = true</code> in app.config.js and point{' '}
            <code>llm.gemma.modelUrl</code> at a <code>.task</code>/<code>.litertlm</code> bundle
            (e.g. gemma-4-E2B-it-litert-lm) to enable it.
          </p>
        </section>
      </div>
    </div>
  )
}

function FlagshipPanel({ active }) {
  const storageKey = modelsConfig.embedding.litert.auth?.storageKey ?? 'attache.hfToken'
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(storageKey) ?? ''
    } catch {
      return ''
    }
  })
  const [saved, setSaved] = useState(false)

  return (
    <section className="panel">
      <h3 className="panel__title">Flagship access (EmbeddingGemma · LiteRT.js)</h3>
      {active ? (
        <p className="dim">
          <Pill tone="ok">active</Pill> The flagship tier is running on LiteRT.js.
        </p>
      ) : (
        <>
          <p className="dim">
            EmbeddingGemma is license-gated on Hugging Face. One-time setup: accept the Gemma
            licence at{' '}
            <a
              href="https://huggingface.co/litert-community/embeddinggemma-300m"
              target="_blank"
              rel="noreferrer"
            >
              litert-community/embeddinggemma-300m
            </a>
            , create a free <em>read</em> token, paste it below, then reload. The token lives in
            this browser's localStorage and is sent only to huggingface.co.
          </p>
          <div className="tester">
            <input
              className="tester__input"
              type="password"
              placeholder="hf_…"
              value={token}
              onChange={(e) => {
                setToken(e.target.value)
                setSaved(false)
              }}
              aria-label="Hugging Face read token"
            />
            <button
              className="btn btn--accent"
              disabled={!token.trim()}
              onClick={() => {
                try {
                  localStorage.setItem(storageKey, token.trim())
                  setSaved(true)
                } catch {
                  /* storage unavailable */
                }
              }}
            >
              {saved ? 'Saved — reload' : 'Save token'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

function CacheRow({ label, size }) {
  return (
    <p className="cacherow">
      <span className={cn('dot', size ? 'dot--ok' : 'dot--neutral')} />
      <span className="cacherow__label">{label}</span>
      <span className="mono dim">{size ? formatBytes(size) : 'not cached'}</span>
    </p>
  )
}
