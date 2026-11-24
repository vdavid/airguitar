import { describe, expect, it } from 'vitest'
import { fitRange } from './range.ts'

describe('fitRange', () => {
  const range = { lo: 48, hi: 72 }

  it('leaves pitches in range alone', () => {
    expect(fitRange(60, range)).toBe(60)
    expect(fitRange(48, range)).toBe(48)
    expect(fitRange(72, range)).toBe(72)
  })

  it('folds by whole octaves, keeping the note', () => {
    expect(fitRange(86, range)).toBe(62)
    expect(fitRange(30, range)).toBe(54)
  })

  it('folds a fractional pitch with its nearest note', () => {
    // 72.4 rounds to 72, which is in range, so it stays (no jump down an octave for a hair).
    expect(fitRange(72.4, range)).toBeCloseTo(72.4)
    expect(fitRange(72.6, range)).toBeCloseTo(60.6)
  })
})
