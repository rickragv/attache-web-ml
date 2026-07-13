/**
 * Document scan geometry: perspective rectification of a photographed page.
 * The user (or a future detector model) supplies a quad; we solve the
 * homography with a direct linear transform and inverse-map the target
 * pixels with bilinear sampling. CPU is plenty: a 1400px page is ~2 M
 * pixels, well under 300 ms.
 */

/** Solves H (3x3, h9=1) such that dst ≈ H · src for 4 point pairs. */
export function computeHomography(src, dst) {
  // 8 equations in 8 unknowns (h1..h8)
  const A = []
  const b = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]
    const [u, v] = dst[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    b.push(v)
  }
  const h = solveLinear(A, b)
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]
}

function solveLinear(A, b) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    // partial pivot
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r
    }
    if (Math.abs(M[pivot][col]) < 1e-12) throw new Error('Degenerate quad — corners are collinear')
    ;[M[col], M[pivot]] = [M[pivot], M[col]]
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col] / M[col][col]
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
    }
  }
  return M.map((row, i) => row[n] / row[i])
}

export function applyHomography(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8]
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]
}

/**
 * Warps the quad region of srcCanvas onto a flat page canvas.
 * quad: [[x,y] topLeft, topRight, bottomRight, bottomLeft] in src pixels.
 */
export function warpPerspective(srcCanvas, quad, { maxWidth = 1400 } = {}) {
  const [tl, tr, br, bl] = quad
  const topW = dist(tl, tr)
  const botW = dist(bl, br)
  const leftH = dist(tl, bl)
  const rightH = dist(tr, br)
  const outW = Math.min(maxWidth, Math.round(Math.max(topW, botW)))
  const outH = Math.round(outW * (Math.max(leftH, rightH) / Math.max(topW, botW)))

  // inverse mapping: target corner -> source quad corner
  const H = computeHomography(
    [
      [0, 0],
      [outW, 0],
      [outW, outH],
      [0, outH],
    ],
    quad,
  )

  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })
  const src = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height)
  const out = new ImageData(outW, outH)
  const sw = src.width
  const sh = src.height
  const sdata = src.data
  const odata = out.data

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const [sx, sy] = applyHomography(H, x + 0.5, y + 0.5)
      const o = (y * outW + x) * 4
      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) {
        odata[o] = odata[o + 1] = odata[o + 2] = 245
        odata[o + 3] = 255
        continue
      }
      const x0 = Math.floor(sx)
      const y0 = Math.floor(sy)
      const fx = sx - x0
      const fy = sy - y0
      for (let c = 0; c < 3; c++) {
        const p00 = sdata[(y0 * sw + x0) * 4 + c]
        const p10 = sdata[(y0 * sw + x0 + 1) * 4 + c]
        const p01 = sdata[((y0 + 1) * sw + x0) * 4 + c]
        const p11 = sdata[((y0 + 1) * sw + x0 + 1) * 4 + c]
        odata[o + c] =
          p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy
      }
      odata[o + 3] = 255
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  canvas.getContext('2d').putImageData(out, 0, 0)
  return canvas
}

/** Default quad: slight inset — the drag handles do the fine alignment. */
export function defaultQuad(width, height, inset = 0.06) {
  const dx = width * inset
  const dy = height * inset
  return [
    [dx, dy],
    [width - dx, dy],
    [width - dx, height - dy],
    [dx, height - dy],
  ]
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}
