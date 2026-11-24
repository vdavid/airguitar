import { describe, expect, it } from 'vitest'
import { GUITAR, renderKarplus } from './karplus.ts'

/** Estimates the fundamental by autocorrelation over a window. */
function estimateFreq(data: Float32Array, sampleRate: number, lo = 60, hi = 1200): number {
  const start = Math.floor(sampleRate * 0.2)
  const size = 4096
  let bestLag = 0
  let best = -Infinity
  for (let lag = Math.floor(sampleRate / hi); lag <= Math.floor(sampleRate / lo); lag++) {
    let sum = 0
    for (let i = 0; i < size; i++) sum += (data[start + i] ?? 0) * (data[start + i + lag] ?? 0)
    if (sum > best) {
      best = sum
      bestLag = lag
    }
  }
  return sampleRate / bestLag
}

describe('renderKarplus', () => {
  const sr = 48000

  it('renders at the requested pitch', () => {
    for (const f of [110, 220, 440]) {
      const data = renderKarplus(sr, f, GUITAR)
      expect(estimateFreq(data, sr) / f).toBeCloseTo(1, 1)
    }
  })

  it('is normalized and decays', () => {
    const data = renderKarplus(sr, 220, GUITAR)
    const peak = data.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
    expect(peak).toBeCloseTo(0.85, 2)
    const tail = data.slice(-2000).reduce((m, v) => Math.max(m, Math.abs(v)), 0)
    expect(tail).toBeLessThan(0.1)
  })
})
