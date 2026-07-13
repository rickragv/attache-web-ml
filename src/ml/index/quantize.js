/**
 * Int8 scalar quantization for L2-normalised embedding vectors.
 *
 * Convention (kept consistent across this module): each vector stores a
 * per-vector symmetric scale `scale = maxAbs(v)` alongside int8 codes
 * `q[d] = round(v[d] * 127 / scale)`, so the dequantised value is
 * `v[d] ≈ q[d] * scale / 127`. The approximate dot product of two vectors
 * is therefore `Σ qa[d]*qb[d] * scaleA * scaleB / (127 * 127)`.
 *
 * WHY: int8 codes quarter the memory footprint versus Float32Array and keep
 * cosine ranking close enough for candidate generation on large corpora;
 * exact float rescoring can always refine the shortlist afterwards.
 */

const LEVELS = 127

/**
 * Quantize `count` row-major vectors of `dims` floats each.
 * @returns {{ data: Int8Array, scales: Float32Array }} quantized rows
 *   (row-major, same layout as the input) plus one scale per vector.
 */
export function quantizeVectors(flatF32, count, dims) {
  const data = new Int8Array(count * dims)
  const scales = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const off = i * dims
    let maxAbs = 0
    for (let d = 0; d < dims; d++) {
      const abs = Math.abs(flatF32[off + d])
      if (abs > maxAbs) maxAbs = abs
    }
    scales[i] = maxAbs
    if (maxAbs === 0) continue // zero vector encodes as all-zero codes
    const gain = LEVELS / maxAbs
    for (let d = 0; d < dims; d++) {
      // Rounding maps back into [-127, 127] exactly because |v| <= maxAbs.
      data[off + d] = Math.round(flatF32[off + d] * gain)
    }
  }
  return { data, scales }
}

/**
 * Approximate dot product of two quantized rows (Int8Array subarrays).
 * With v ≈ q * scale / 127 per vector, dot(a, b) ≈ Σ qa*qb * scaleA*scaleB / 127².
 */
export function dotQuantized(dataARow, scaleA, dataBRow, scaleB, dims) {
  let acc = 0
  for (let d = 0; d < dims; d++) acc += dataARow[d] * dataBRow[d]
  return (acc * scaleA * scaleB) / (LEVELS * LEVELS)
}

/**
 * Top-k by approximate cosine (vectors are L2-normalised, so dot = cosine).
 * The float query is quantized once with the same convention, then scored
 * against every stored row in the int8 domain.
 * @param {Float32Array} query
 * @param {{ data: Int8Array, scales: Float32Array, count: number, dims: number }} store
 * @returns [{idx, score}] sorted desc
 */
export function quantizedTopK(query, store, k) {
  const { data, scales, count, dims } = store
  const q = quantizeVectors(query, 1, dims)
  const qRow = q.data
  const qScale = q.scales[0]
  const hits = []
  for (let i = 0; i < count; i++) {
    const row = data.subarray(i * dims, (i + 1) * dims)
    hits.push({ idx: i, score: dotQuantized(qRow, qScale, row, scales[i], dims) })
  }
  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, k)
}
