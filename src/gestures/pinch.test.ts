import { describe, expect, it } from 'vitest'
import { OPEN, PINCH_OFF, PINCH_ON, updatePinch, type PinchState } from './pinch.ts'

function feed(ratios: number[], start: PinchState = OPEN, sens = 1): ('down' | 'up' | null)[] {
  let state = start
  return ratios.map((r) => {
    const next = updatePinch(state, r, sens)
    state = next.state
    return next.event
  })
}

describe('updatePinch', () => {
  it('closes after two frames below the on threshold', () => {
    expect(feed([0.2, 0.2])).toEqual([null, 'down'])
  })

  it('ignores a single noisy frame', () => {
    expect(feed([0.2, 0.9, 0.2, 0.9])).toEqual([null, null, null, null])
  })

  it('stays closed in the hysteresis band', () => {
    const mid = (PINCH_ON + PINCH_OFF) / 2
    expect(feed([0.1, 0.1, mid, mid, mid, mid])).toEqual([null, 'down', null, null, null, null])
  })

  it('opens after two frames above the off threshold', () => {
    expect(feed([0.1, 0.1, 0.6, 0.6])).toEqual([null, 'down', null, 'up'])
  })

  it('scales thresholds with sensitivity', () => {
    // 0.4 is open at 1×, but a pinch at 1.5× (on below 0.45)
    expect(feed([0.4, 0.4], OPEN, 1)).toEqual([null, null])
    expect(feed([0.4, 0.4], OPEN, 1.5)).toEqual([null, 'down'])
  })
})
