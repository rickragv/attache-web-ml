import { describe, it, expect } from 'vitest'
import { computeHomography, applyHomography, defaultQuad } from '../src/services/scanService.js'

describe('computeHomography', () => {
  it('maps the four defining corners exactly', () => {
    const src = [
      [0, 0],
      [1056, 0],
      [1056, 1408],
      [0, 1408],
    ]
    const dst = [
      [72, 96],
      [1128, 140],
      [1180, 1504],
      [40, 1460],
    ]
    const H = computeHomography(src, dst)
    for (let i = 0; i < 4; i++) {
      const [u, v] = applyHomography(H, src[i][0], src[i][1])
      expect(u).toBeCloseTo(dst[i][0], 4)
      expect(v).toBeCloseTo(dst[i][1], 4)
    }
  })

  it('is identity for identical quads', () => {
    const q = defaultQuad(1200, 1600)
    const H = computeHomography(q, q)
    const [u, v] = applyHomography(H, 600, 800)
    expect(u).toBeCloseTo(600, 3)
    expect(v).toBeCloseTo(800, 3)
  })

  it('interpolates interior points sensibly for a pure translation', () => {
    const src = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ]
    const dst = src.map(([x, y]) => [x + 50, y + 20])
    const H = computeHomography(src, dst)
    const [u, v] = applyHomography(H, 50, 50)
    expect(u).toBeCloseTo(100, 4)
    expect(v).toBeCloseTo(70, 4)
  })

  it('throws on a degenerate (collinear) quad', () => {
    const src = [
      [0, 0],
      [10, 0],
      [20, 0],
      [30, 0],
    ]
    const dst = defaultQuad(100, 100)
    expect(() => computeHomography(src, dst)).toThrow(/quad|singular|Degenerate/i)
  })
})
