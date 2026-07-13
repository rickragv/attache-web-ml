/**
 * Top-level application configuration.
 * Every behavioural knob in the app should trace back to a config file in
 * this directory — components read config, they do not hardcode.
 */
export const appConfig = {
  name: 'Attaché',
  wordmark: 'Attaché',
  tagline: 'Your documents, answering. Fully on-device.',
  version: '0.1.0',
  corpusLabel: 'Meridian knowledge base',

  features: {
    /** Push-to-talk dictation on the Ask view. */
    dictation: true,
    /** Gemma answer synthesis (2 GB local weights; desktop-class hardware). */
    answer: true,
    /** NLI verification of generated claims (Track A capstone). */
    verifyClaims: true,
    /** Cross-encoder precision rerank stage. */
    rerank: true,
    /** Camera/photo document intake (Track B). */
    scan: true,
    /** Workspace: private doc set → entities → knowledge graph → chat. */
    workspace: true,
    /** Offline drill toggle in System — blocks all network from the app. */
    offlineDrill: true,
    /** Allow users to add their own documents in Library. */
    uploads: true,
  },

  ui: {
    /** Default view on load. */
    defaultView: 'ask',
    /** How many results the Ask view renders. */
    askResultCount: 8,
    /** Compare view candidate pool size (keyword hits that get reranked). */
    compareCandidates: 10,
    /** Telemetry ring buffer size. */
    maxTelemetryEvents: 240,
  },

  workspace: {
    /** Hard cap on documents in a workspace session. */
    maxDocs: 5,
    /** Retrieved chunks fed to each chat turn. */
    chatTopK: 5,
    /** Conversation turns kept in the prompt window. */
    historyTurns: 4,
    /** Entities below this mention count stay off the graph. */
    minMentions: 1,
    /**
     * Embedding covers (nearly) everything — retrieval quality collapses on
     * sampled indexes when the answer lives in one specific table.
     */
    maxChunksPerDoc: 500,
    /** NER is ~10x slower per chunk; the graph samples evenly instead. */
    nerChunksPerDoc: 100,
    /** Cap graph size so the canvas stays legible. */
    maxEntities: 40,
  },
}
