import { describe, expect, it } from 'vitest'
import { LATCH_BACK, PickerAim } from './picker-aim.ts'

/** Feeds 30 fps samples from `from` to `to` (seconds) with a point and ratio from `at(t)`. */
function feedRange(
  aim: PickerAim,
  id: string,
  from: number,
  to: number,
  at: (t: number) => { x: number; y: number; ratio: number },
): void {
  for (let t = from; t <= to + 1e-9; t += 1 / 30) {
    const s = at(t)
    aim.feed(id, t, { x: s.x, y: s.y }, s.ratio)
  }
}

describe('PickerAim', () => {
  it('starts at the first point and smooths later moves lightly', () => {
    const aim = new PickerAim()
    expect(aim.feed('h1', 0, { x: 100, y: 100 }, 1)).toEqual({ x: 100, y: 100 })
    const next = aim.feed('h1', 1 / 30, { x: 200, y: 100 }, 1)
    expect(next.x).toBeGreaterThan(150)
    expect(next.x).toBeLessThan(200)
    expect(aim.aim('h1')).toEqual(next)
  })

  it('catches up with a hand that holds still', () => {
    const aim = new PickerAim()
    aim.feed('h1', 0, { x: 0, y: 0 }, 1)
    feedRange(aim, 'h1', 1 / 30, 0.5, () => ({ x: 300, y: 0, ratio: 1 }))
    expect(aim.aim('h1')?.x).toBeCloseTo(300, 0)
  })

  it('latches where the hand aimed before the thumb–index gap started closing', () => {
    const aim = new PickerAim()
    // Steady over tile A at x=100 with an open hand, then from t=1 the gap closes over 0.2 s while
    // the pinch point slides right to x=200 (the neighbor tile).
    feedRange(aim, 'h1', 0, 1, () => ({ x: 100, y: 50, ratio: 1 }))
    feedRange(aim, 'h1', 1 + 1 / 30, 1.2, (t) => {
      const k = (t - 1) / 0.2
      return { x: 100 + 100 * k, y: 50, ratio: 1 - 0.8 * k }
    })
    expect(aim.aim('h1')?.x).toBeGreaterThan(170)
    expect(aim.latched('h1', 1.2)?.x).toBeCloseTo(100, 0)
  })

  it('looks back at least LATCH_BACK for a fast pinch', () => {
    const aim = new PickerAim()
    // Moving steadily right at 500 units/s with the gap closing only in the last frame.
    feedRange(aim, 'h1', 0, 1, (t) => ({ x: 500 * t, y: 0, ratio: t < 0.97 ? 1 : 0.2 }))
    const latched = aim.latched('h1', 1)?.x ?? 0
    expect(latched).toBeLessThanOrEqual(aim.aim('h1')?.x ?? 0)
    expect(latched).toBeLessThanOrEqual(500 * (1 - LATCH_BACK) + 1)
  })

  it('falls back to the oldest sample when the history is short', () => {
    const aim = new PickerAim()
    aim.feed('h1', 5, { x: 42, y: 7 }, 1)
    expect(aim.latched('h1', 5.01)).toEqual({ x: 42, y: 7 })
  })

  it('knows nothing about an unseen or forgotten hand', () => {
    const aim = new PickerAim()
    expect(aim.aim('h9')).toBeNull()
    expect(aim.latched('h9', 1)).toBeNull()
    aim.feed('h1', 0, { x: 1, y: 1 }, 1)
    aim.forget('h1')
    expect(aim.aim('h1')).toBeNull()
  })

  it('keeps only the hands it is told about', () => {
    const aim = new PickerAim()
    aim.feed('h1', 0, { x: 1, y: 1 }, 1)
    aim.feed('h2', 0, { x: 2, y: 2 }, 1)
    aim.retain(['h2'])
    expect(aim.aim('h1')).toBeNull()
    expect(aim.aim('h2')).toEqual({ x: 2, y: 2 })
  })
})
