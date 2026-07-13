/**
 * Model registry. Providers are attempted in chain order; the first one that
 * initialises wins. Every asset URL lives here â€” nothing in src/ml fetches
 * a hardcoded URL.
 *
 * Quality tiers (shown honestly in the HUD):
 *  - 'flagship'  full neural embedding via LiteRT.js (EmbeddingGemma)
 *  - 'standard'  compact neural embedding via MediaPipe (on-device TFLite)
 *  - 'degraded'  lexical hashing, no semantics â€” dev/CI fallback only
 */
/**
 * Runtime WASM location. Both LiteRT.js and MediaPipe pull their runtime via
 * dynamic import(); Vite dev mode refuses runtime imports from /public, so
 * dev uses the CDN while production serves the same files same-origin from
 * public/wasm/ (copied by scripts/copy-wasm.mjs) â€” which is what keeps the
 * offline drill honest in a deployed build.
 */
const DEV = typeof import.meta !== 'undefined' && import.meta.env?.DEV

const wasmBases = {
  litert: DEV ? 'https://cdn.jsdelivr.net/npm/@litertjs/core@2.5.2/wasm/' : '/wasm/litert/',
  mediapipeText: DEV
    ? 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-text@0.10.35/wasm'
    : '/wasm/mediapipe-text',
  mediapipeGenai: DEV
    ? 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@0.10.29/wasm'
    : '/wasm/mediapipe-genai',
}

export const modelsConfig = {
  embedding: {
    providerChain: ['litert', 'mediapipe', 'lexical'],

    litert: {
      id: 'litert',
      label: 'EmbeddingGemma 300M',
      runtime: 'LiteRT.js',
      quality: 'flagship',
      enabled: true,      /**
       * loadLiteRt() calls importScripts(), which module workers don't
       * support — the runtime is built for main-thread use (WebGPU compute
       * is async off-thread regardless). Revisit when LiteRT.js ships
       * module-worker support.
       */
      context: 'main',
      wasmBase: wasmBases.litert,
      /**
       * Served same-origin from public/models/ (downloaded once with the HF
       * token in .env — see README). Same-origin avoids shipping any token
       * to the browser and keeps the offline drill honest. To fetch from
       * Hugging Face directly instead, restore the resolve/main URLs and add
       * a read token in the System view.
       */
      modelUrl: '/models/embeddinggemma/embeddinggemma-300M_seq256_mixed-precision.tflite',
      tokenizerUrl: '/models/embeddinggemma/sentencepiece.model',
      approxBytes: 179 * 1024 * 1024,
      seqLen: 256,
      dims: 768,
      /** Trained on 100+ languages incl. Hindi — safe to triage Devanagari. */
      multilingual: true,
      /**
       * The repo is license-gated (Gemma terms). Accept the licence once at
       * huggingface.co/litert-community/embeddinggemma-300m, create a free
       * read token, and paste it in the System view. Stored in localStorage,
       * sent only to huggingface.co.
       */
      auth: { type: 'bearer', storageKey: 'attache.hfToken', host: 'huggingface.co' },
      accelerators: ['webgpu', 'wasm'],
      /** EmbeddingGemma is prompt-conditioned: prefixes matter for quality. */
      prompts: {
        query: 'task: search result | query: ',
        document: 'title: none | text: ',
      },
      special: { bosId: 2, eosId: 1, padId: 0 },
    },

    mediapipe: {
      id: 'mediapipe',
      label: 'Universal Sentence Encoder',
      runtime: 'MediaPipe Tasks (TFLite)',
      quality: 'standard',
      enabled: true,
      /** MediaPipe's WASM loader needs the DOM — module workers fail. */
      context: 'main',
      wasmBase: wasmBases.mediapipeText,
      modelUrl:
        'https://storage.googleapis.com/mediapipe-models/text_embedder/universal_sentence_encoder/float32/latest/universal_sentence_encoder.tflite',
      approxBytes: 6.9 * 1024 * 1024,
      dims: 100,
      /** English-centric — must never gate queries in languages it can't read. */
      multilingual: false,
      prompts: { query: '', document: '' },
    },

    lexical: {
      id: 'lexical',
      label: 'Lexical hash (no model)',
      runtime: 'Pure JS',
      quality: 'degraded',
      enabled: true,
      context: 'main',
      dims: 512,
      multilingual: false,
      prompts: { query: '', document: '' },
    },
  },

  /**
   * Stage-2 precision reranker: a cross-encoder reads (query, chunk)
   * JOINTLY — far more accurate than bi-encoder cosine, too slow for
   * recall, perfect for re-scoring a short candidate list.
   * Converted from cross-encoder/ms-marco-MiniLM-L-6-v2 via
   * scripts/convert-models.py; served same-origin.
   */
  rerank: {
    id: 'rerank',
    label: 'MiniLM cross-encoder',
    runtime: 'LiteRT.js',
    enabled: true,
    context: 'main',
    wasmBase: wasmBases.litert,
    modelUrl: '/models/rerank/ms-marco-minilm-l6.tflite',
    vocabUrl: '/models/rerank/vocab.txt',
    approxBytes: 91 * 1024 * 1024,
    seqLen: 256,
    numLogits: 1,
    /**
     * Dynamic-range int8 ops fall back to CPU inside the WebGPU delegate and
     * trip "Asyncify is not defined" — run these on XNNPACK directly.
     */
    accelerators: ['wasm'],
    /** How many semantic candidates get the expensive joint re-score. */
    candidates: 12,
    keep: 8,
  },

  /**
   * Citation verifier: 3-way NLI (contradiction / entailment / neutral)
   * over (evidence chunk, generated claim) pairs. A claim counts as
   * supported only if entailment wins with probability ≥ minEntailment.
   * Converted from cross-encoder/nli-MiniLM2-L6-H768.
   */
  nli: {
    id: 'nli',
    label: 'DistilBERT NLI verifier',
    runtime: 'LiteRT.js',
    enabled: true,
    context: 'main',
    wasmBase: wasmBases.litert,
    modelUrl: '/models/nli/nli-distilbert-mnli.tflite',
    vocabUrl: '/models/nli/vocab.txt',
    approxBytes: 68 * 1024 * 1024,
    seqLen: 256,
    numLogits: 3,
    /** Label order of typeform/distilbert-base-uncased-mnli (id2label). */
    labels: ['entailment', 'neutral', 'contradiction'],
    minEntailment: 0.5,
    accelerators: ['wasm'],
  },

  asr: {
    providerChain: ['whisper', 'webspeech'],

    whisper: {
      id: 'whisper',
      label: 'Whisper tiny',
      runtime: 'LiteRT.js',
      onDevice: true,
      /**
       * Experimental: the whisper .tflite exports vary in signature (mel
       * frontend in/out of graph, decoder loop). Enable after verifying with
       * @litertjs/model-tester against the target export.
       */
      enabled: false,
      wasmBase: wasmBases.litert,
      modelUrl: 'https://huggingface.co/litert-community/whisper-tiny/resolve/main/whisper-tiny.tflite',
      sampleRate: 16000,
      maxSeconds: 30,
    },

    webspeech: {
      id: 'webspeech',
      label: 'Browser speech engine',
      runtime: 'Web Speech API',
      /** Chrome routes this through Google servers â€” the HUD says so. */
      onDevice: false,
      enabled: true,
      languages: { en: 'en-IN', hi: 'hi-IN' },
    },
  },

  /**
   * Token-classification NER for the Workspace knowledge graph. Converted
   * from dslim/distilbert-NER (BIO tags over PER/ORG/LOC/MISC). Pattern
   * extraction (amounts, dates, emails, IDs) always runs alongside it and
   * doubles as the fallback when the model is unavailable.
   */
  ner: {
    id: 'ner',
    label: 'DistilBERT NER',
    runtime: 'LiteRT.js',
    enabled: true,
    context: 'main',
    task: 'token',
    wasmBase: wasmBases.litert,
    modelUrl: '/models/ner/ner-distilbert.tflite',
    vocabUrl: '/models/ner/vocab.txt',
    approxBytes: 66 * 1024 * 1024,
    seqLen: 256,
    /** BIO label order of dslim/distilbert-NER (verified id2label). */
    labels: ['O', 'B-PER', 'I-PER', 'B-ORG', 'I-ORG', 'B-LOC', 'I-LOC', 'B-MISC', 'I-MISC'],
    minScore: 0.6,
    accelerators: ['wasm'],
  },

  ocr: {
    providerChain: ['paddle', 'tesseract'],
    /** Target flagship — enable after validating a det/rec export on LiteRT. */
    paddle: {
      id: 'paddle',
      label: 'PaddleOCR (LiteRT)',
      enabled: false,
      wasmBase: wasmBases.litert,
      detUrl: '',
      recUrl: '',
    },
    /** Shipping baseline: WASM, on-device, language packs cached by its CDN. */
    tesseract: {
      id: 'tesseract',
      label: 'Tesseract.js',
      enabled: true,
      langs: 'eng',
    },
  },

  llm: {
    providerChain: ['gemma'],

    gemma: {
      id: 'gemma',
      label: 'Gemma (on-device)',
      runtime: 'MediaPipe GenAI (LiteRT)',
      enabled: true, // gated additionally by appConfig.features.answer
      wasmBase: wasmBases.mediapipeGenai,
      /**
       * gemma-4-E2B-it web bundle (2 GB), downloaded by
       * scripts/download-models.mjs and served same-origin. Desktop-class
       * hardware only — the answer stage stays feature-flagged.
       */
      modelUrl: '/models/gemma/gemma-4-E2B-it-web.task',
      /** input + output combined; RAG prompts with 4-5 passages need room */
      maxTokens: 4096,
      temperature: 0.6,
      topK: 40,
    },
  },
}
