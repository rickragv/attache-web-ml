import { create } from 'zustand'
import { appConfig } from '../config/app.config.js'
import { routingConfig } from '../config/routing.config.js'

/**
 * Single zustand store. Services mutate it through actions; views subscribe
 * through selectors. No component talks to a worker directly.
 */
export const useStore = create((set, get) => ({
  // ---- ui ----
  view: appConfig.ui.defaultView,
  setView: (view) => set({ view }),

  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (online) => set({ online }),
  offlineDrill: false,
  setOfflineDrill: (offlineDrill) => set({ offlineDrill }),

  // ---- engine ----
  engine: {
    status: 'idle', // idle | loading | ready | error
    provider: null,
    label: '',
    runtime: '',
    quality: null,
    backend: null,
    dims: 0,
    initMs: 0,
    attempts: [],
    progress: null, // {phase, detail, loaded, total}
    error: null,
  },
  patchEngine: (patch) => set((s) => ({ engine: { ...s.engine, ...patch } })),

  // ---- corpus ----
  corpus: {
    docs: [],
    chunks: [],
    stats: null,
    indexing: { state: 'idle', done: 0, total: 0, fromCache: false }, // idle | running | done
  },
  patchCorpus: (patch) => set((s) => ({ corpus: { ...s.corpus, ...patch } })),

  // ---- routing (runtime-editable copy of routing.config) ----
  routes: routingConfig.routes.map((r) => ({ ...r, exemplars: [...r.exemplars] })),
  minConfidence: routingConfig.minConfidence,
  setRoutes: (routes) => set({ routes }),
  setMinConfidence: (minConfidence) => set({ minConfidence }),
  prototypesReady: false,
  setPrototypesReady: (prototypesReady) => set({ prototypesReady }),

  // ---- ask ----
  ask: {
    query: '',
    status: 'idle', // idle | running | done | gated | error
    triage: null, // {routeId, label, confidence, gate, locale, ms}
    results: [],
    rerankApplied: false,
    trace: [], // pipeline stage trace for the inspector
    timings: null,
    error: null,
  },
  patchAsk: (patch) => set((s) => ({ ask: { ...s.ask, ...patch } })),

  // ---- answer (Track A capstone) ----
  answer: {
    status: 'idle', // idle | loading-model | generating | verifying | done | error
    claims: [], // [{text, cites[], status, entailment, partial}]
    verifier: 'pending', // pending | active | unavailable
    tokensPerSec: 0,
    supported: 0,
    total: 0,
    modelPhase: null,
    error: null,
  },
  patchAnswer: (patch) => set((s) => ({ answer: { ...s.answer, ...patch } })),

  // ---- compare ----
  compare: {
    query: '',
    status: 'idle',
    keyword: [],
    reranked: [],
    timings: null,
  },
  patchCompare: (patch) => set((s) => ({ compare: { ...s.compare, ...patch } })),

  // ---- dictation ----
  dictation: {
    available: false,
    provider: null,
    onDevice: false,
    listening: false,
    interim: '',
    error: null,
  },
  patchDictation: (patch) => set((s) => ({ dictation: { ...s.dictation, ...patch } })),

  // ---- telemetry ----
  telemetry: {
    events: [],
    inferenceCalls: 0,
    serverInferenceCalls: 0, // stays 0 — the point of the demo
    embedMsSamples: [],
  },
  logEvent: (event) =>
    set((s) => {
      const events = [
        { t: Date.now(), ...event },
        ...s.telemetry.events.slice(0, appConfig.ui.maxTelemetryEvents - 1),
      ]
      const embedMsSamples =
        event.kind === 'embed'
          ? [...s.telemetry.embedMsSamples.slice(-59), event.ms]
          : s.telemetry.embedMsSamples
      return {
        telemetry: {
          ...s.telemetry,
          events,
          embedMsSamples,
          inferenceCalls: s.telemetry.inferenceCalls + (event.kind === 'embed' ? 1 : 0),
        },
      }
    }),
}))

export const selectReady = (s) =>
  s.engine.status === 'ready' && s.corpus.indexing.state === 'done'
