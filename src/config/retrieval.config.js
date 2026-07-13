/**
 * Retrieval pipeline tuning. Chunking is applied at corpus load; changing
 * chunk parameters invalidates the vector cache (the cache key includes
 * this signature).
 */
export const retrievalConfig = {
  chunking: {
    /** Target characters per chunk (~200 tokens). */
    targetChars: 1100,
    /** Overlap carried between adjacent chunks. */
    overlapChars: 180,
    /** Chunks smaller than this merge into their neighbour. */
    minChars: 240,
  },

  bm25: {
    k1: 1.4,
    b: 0.75,
  },

  search: {
    /** Semantic candidates pulled per query. */
    topK: 12,
    /** Per-document cap so one long doc can't fill the results. */
    perDocCap: 2,
    /** Score floor below which results are hidden as noise. */
    minScore: 0.08,
  },

  rerank: {
    /** Keyword candidates fed to the semantic re-scorer in Compare. */
    candidates: 10,
  },

  /**
   * Approximate-NN substrate. Brute-force scanning is exact and fast enough
   * below the threshold (measured ~7 ms at 3.3k chunks); past it, an
   * HNSW-style index takes over automatically. The System view reports
   * which mode is live.
   */
  ann: {
    enabled: true,
    threshold: 20000,
    params: { M: 12, efConstruction: 100, efSearch: 64 },
  },

  /** Cache signature — bump to force re-embedding of the corpus. */
  indexVersion: 1,
}
