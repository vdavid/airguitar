import { describe, expect, it } from 'vitest'
import { BEND_CENTS, PULL_MAX, pullString, snapVelocity, sweepAmounts } from './shapes.ts'

describe('pullString', () => {
  const a = { x: 100, y: 300 }
  const b = { x: 500, y: 300 }

  it('does nothing on the string, and bends up either way off it', () => {
    expect(pullString(a, b, 0.5, { x: 300, y: 303 }).cents).toBe(0)
    const up = pullString(a, b, 0.5, { x: 300, y: 250 })
    const down = pullString(a, b, 0.5, { x: 300, y: 350 })
    expect(up.cents).toBeGreaterThan(0)
    expect(down.cents).toBeCloseTo(up.cents)
  })

  it('pulls the string to the pinch, capped at the maximum', () => {
    expect(pullString(a, b, 0.25, { x: 210, y: 260 }).point).toEqual({ x: 200, y: 260 })
    const far = pullString(a, b, 0.5, { x: 300, y: 0 })
    expect(far.point).toEqual({ x: 300, y: 300 - PULL_MAX })
    expect(far.depth).toBe(PULL_MAX)
    expect(far.cents).toBeCloseTo(BEND_CENTS)
  })

  it('snaps harder the deeper the pull', () => {
    expect(snapVelocity(14)).toBeLessThan(snapVelocity(60))
    expect(snapVelocity(PULL_MAX)).toBe(1)
  })
})

describe('sweepAmounts', () => {
  const o = { x: 600, y: 400 }

  it('is neutral near the start', () => {
    expect(sweepAmounts(o, { x: 610, y: 410 })).toEqual({ dark: 0, thin: 0, echo: 0 })
  })

  it('darkens down, thins up, and echoes sideways', () => {
    expect(sweepAmounts(o, { x: 600, y: 700 }).dark).toBe(1)
    expect(sweepAmounts(o, { x: 600, y: 100 }).thin).toBe(1)
    const side = sweepAmounts(o, { x: 300, y: 400 })
    expect(side.echo).toBe(1)
    expect(side.dark + side.thin).toBe(0)
  })
})
