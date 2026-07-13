/**
 * Small HNSW-style approximate nearest neighbour index in pure JS.
 *
 * WHY: brute-force cosine over the whole corpus is O(n·dims) per query and
 * starts to hurt beyond a few tens of thousands of chunks. HNSW gives
 * near-logarithmic search by descending a layered proximity graph: greedy
 * hops on the sparse upper layers to land near the target, then a beam
 * search on the dense bottom layer. This is a deliberately simplified but
 * faithful implementation — random geometric level assignment (p = 1/e),
 * bidirectional links pruned to M (2M on layer 0), correctness over exotic
 * heuristics. Vectors must be L2-normalised so dot product = cosine.
 */

const MAX_LEVEL = 16

/** Keep `arr` sorted descending by score (best first). */
function insertDesc(arr, item) {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid].score >= item.score) lo = mid + 1
    else hi = mid
  }
  arr.splice(lo, 0, item)
}

/** Keep `arr` sorted ascending by score (best last, so pop() is O(1)). */
function insertAsc(arr, item) {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid].score <= item.score) lo = mid + 1
    else hi = mid
  }
  arr.splice(lo, 0, item)
}

export class AnnIndex {
  constructor({ dims, M = 12, efConstruction = 100, efSearch = 48 }) {
    this.dims = dims
    this.M = M
    this.efConstruction = efConstruction
    this.efSearch = efSearch
    this.count = 0
    this.keys = []
    this.levels = []
    // links[idx][layer] = array of neighbour indices present on that layer.
    this.links = []
    this.entryPoint = -1
    this.maxLevel = -1
    // One growable row-major matrix (doubling) so vectors stay cache-friendly
    // and serialization is a single buffer copy.
    this.matrix = new Float32Array(0)
  }

  get size() {
    return this.count
  }

  /** Incremental insert. `vector` must be an L2-normalised Float32Array. */
  add(key, vector) {
    if (vector.length !== this.dims) {
      throw new Error(`Vector dims mismatch: ${vector.length} vs ${this.dims}`)
    }
    const idx = this.count
    this.#ensureCapacity(idx + 1)
    this.matrix.set(vector, idx * this.dims)
    this.keys.push(key)
    const level = this.#randomLevel()
    this.levels.push(level)
    const nodeLinks = []
    for (let l = 0; l <= level; l++) nodeLinks.push([])
    this.links.push(nodeLinks)
    this.count += 1

    if (this.entryPoint === -1) {
      this.entryPoint = idx
      this.maxLevel = level
      return
    }

    // Greedy descent through the layers above the new node's top level.
    let ep = this.entryPoint
    for (let l = this.maxLevel; l > level; l--) ep = this.#greedyDescend(vector, ep, l)

    // Beam search + bidirectional linking on every layer the node lives on.
    for (let l = Math.min(level, this.maxLevel); l >= 0; l--) {
      const found = this.#searchLayer(vector, ep, this.efConstruction, l)
      const maxLinks = l === 0 ? this.M * 2 : this.M
      const neighbours = this.#selectNeighbours(found, this.M)
      nodeLinks[l] = neighbours.map((n) => n.idx)
      for (const n of neighbours) {
        const theirs = this.links[n.idx][l]
        theirs.push(idx)
        if (theirs.length > maxLinks) this.#prune(n.idx, l, maxLinks)
      }
      ep = found[0].idx
    }

    if (level > this.maxLevel) {
      this.maxLevel = level
      this.entryPoint = idx
    }
  }

  /** @returns [{key, idx, score}] sorted desc by cosine (= dot) */
  search(query, k) {
    if (this.count === 0) return []
    let ep = this.entryPoint
    for (let l = this.maxLevel; l > 0; l--) ep = this.#greedyDescend(query, ep, l)
    const ef = Math.max(this.efSearch, k)
    const found = this.#searchLayer(query, ep, ef, 0)
    return found.slice(0, k).map(({ idx, score }) => ({ key: this.keys[idx], idx, score }))
  }

  /** Plain JSON-able graph metadata plus one Float32Array buffer of vectors. */
  serialize() {
    return {
      dims: this.dims,
      M: this.M,
      efConstruction: this.efConstruction,
      efSearch: this.efSearch,
      count: this.count,
      keys: [...this.keys],
      levels: [...this.levels],
      links: this.links.map((layers) => layers.map((l) => [...l])),
      entryPoint: this.entryPoint,
      maxLevel: this.maxLevel,
      buffer: this.matrix.slice(0, this.count * this.dims).buffer,
    }
  }

  static hydrate(obj) {
    const index = new AnnIndex({
      dims: obj.dims,
      M: obj.M,
      efConstruction: obj.efConstruction,
      efSearch: obj.efSearch,
    })
    index.count = obj.count
    index.keys = [...obj.keys]
    index.levels = [...obj.levels]
    index.links = obj.links.map((layers) => layers.map((l) => [...l]))
    index.entryPoint = obj.entryPoint
    index.maxLevel = obj.maxLevel
    index.matrix = new Float32Array(obj.buffer)
    return index
  }

  #ensureCapacity(rows) {
    const needed = rows * this.dims
    if (this.matrix.length >= needed) return
    const grown = Math.max(needed, this.matrix.length * 2, this.dims * 16)
    const next = new Float32Array(grown)
    next.set(this.matrix)
    this.matrix = next
  }

  /** Geometric level with p = 1/e — expected list length stays O(1) per layer. */
  #randomLevel() {
    let level = 0
    while (Math.random() < 1 / Math.E && level < MAX_LEVEL) level++
    return level
  }

  #dot(query, idx) {
    const off = idx * this.dims
    let dot = 0
    for (let d = 0; d < this.dims; d++) dot += this.matrix[off + d] * query[d]
    return dot
  }

  /** Follow the best outgoing link until no neighbour improves the score. */
  #greedyDescend(query, entry, layer) {
    let best = entry
    let bestScore = this.#dot(query, entry)
    let improved = true
    while (improved) {
      improved = false
      for (const nb of this.links[best][layer]) {
        const score = this.#dot(query, nb)
        if (score > bestScore) {
          best = nb
          bestScore = score
          improved = true
        }
      }
    }
    return best
  }

  /**
   * Beam search on one layer: expand the best unexplored candidate until it
   * cannot beat the worst of the `ef` best results found so far.
   * @returns [{idx, score}] sorted desc, at most ef entries
   */
  #searchLayer(query, entry, ef, layer) {
    const start = { idx: entry, score: this.#dot(query, entry) }
    const visited = new Set([entry])
    const candidates = [start] // ascending, best at the end
    const results = [start] // descending, worst at the end
    while (candidates.length > 0) {
      const current = candidates.pop()
      if (results.length >= ef && current.score < results[results.length - 1].score) break
      for (const nb of this.links[current.idx][layer]) {
        if (visited.has(nb)) continue
        visited.add(nb)
        const score = this.#dot(query, nb)
        if (results.length < ef || score > results[results.length - 1].score) {
          const item = { idx: nb, score }
          insertDesc(results, item)
          if (results.length > ef) results.pop()
          insertAsc(candidates, item)
        }
      }
    }
    return results
  }

  /**
   * HNSW neighbour-selection heuristic: walk candidates best-first and keep
   * one only if it is closer to the base point than to anything already
   * kept. This spends the link budget on diverse directions instead of a
   * tight clique, which is what keeps recall high on isotropic data. Any
   * budget the heuristic leaves unused is backfilled with the closest
   * rejected candidates (keepPrunedConnections) so nodes never end up
   * under-connected.
   * @param candidates [{idx, score}] sorted desc by similarity to the base
   */
  #selectNeighbours(candidates, max) {
    const selected = []
    const rejected = []
    for (const c of candidates) {
      if (selected.length >= max) break
      const off = c.idx * this.dims
      const cVec = this.matrix.subarray(off, off + this.dims)
      let diverse = true
      for (const s of selected) {
        if (this.#dot(cVec, s.idx) > c.score) {
          diverse = false
          break
        }
      }
      if (diverse) selected.push(c)
      else rejected.push(c)
    }
    for (const c of rejected) {
      if (selected.length >= max) break
      selected.push(c)
    }
    return selected
  }

  /** Re-apply the selection heuristic when a node's list overflows `maxLinks`. */
  #prune(node, layer, maxLinks) {
    const off = node * this.dims
    const own = this.matrix.subarray(off, off + this.dims)
    const scored = this.links[node][layer].map((idx) => ({ idx, score: this.#dot(own, idx) }))
    scored.sort((a, b) => b.score - a.score)
    this.links[node][layer] = this.#selectNeighbours(scored, maxLinks).map((n) => n.idx)
  }
}
