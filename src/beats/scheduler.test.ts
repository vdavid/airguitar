import { describe, expect, it } from 'vitest'
import { clampBpm, LookaheadScheduler, stepDuration, swingDelay } from './scheduler.ts'

describe('timing math', () => {
  it('has four steps to a beat', () => {
    expect(stepDuration(120)).toBeCloseTo(0.125)
    expect(stepDuration(60)).toBeCloseTo(0.25)
  })

  it('swings only the off sixteenths', () => {
    expect(swingDelay(0, 0.2, 120)).toBe(0)
    expect(swingDelay(1, 0.2, 120)).toBeCloseTo(0.025)
    expect(swingDelay(2, 0.2, 120)).toBe(0)
  })

  it('clamps and rounds the tempo', () => {
    expect(clampBpm(10)).toBe(50)
    expect(clampBpm(999)).toBe(200)
    expect(clampBpm(99.6)).toBe(100)
  })
})

describe('LookaheadScheduler', () => {
  const make = (): { s: LookaheadScheduler; got: [number, number][] } => {
    const got: [number, number][] = []
    const s = new LookaheadScheduler(
      (step, time) => {
        got.push([step, time])
      },
      { lookahead: 0.1, startDelay: 0.05 },
    )
    return { s, got }
  }

  it('schedules the steps inside the look-ahead window at exact times', () => {
    const { s, got } = make()
    s.start(10, 120) // steps every 0.125 s from 10.05
    expect(got).toEqual([[0, 10.05]])
    s.pump(10.1, 120) // window ends at 10.2: step 1 at 10.175
    expect(got.map(([n]) => n)).toEqual([0, 1])
    expect(got[1]?.[1]).toBeCloseTo(10.175)
    s.pump(10.1, 120) // nothing new
    expect(got).toHaveLength(2)
  })

  it('applies a tempo change from the next step', () => {
    const { s, got } = make()
    s.start(0, 120)
    s.pump(0.1, 60) // step 1 at 0.175 (already due at the old spacing), next spacing 0.25
    s.pump(0.4, 60)
    expect(got.map(([, t]) => Number(t.toFixed(3)))).toEqual([0.05, 0.175, 0.425])
  })

  it('skips missed steps after a stall, keeping the grid', () => {
    const { s, got } = make()
    s.start(0, 120)
    s.pump(5, 120)
    const [step, time] = got.at(-1) ?? [0, 0]
    expect(time).toBeGreaterThanOrEqual(5)
    expect(time).toBeLessThan(5.1)
    expect(time).toBeCloseTo(0.05 + step * 0.125)
    expect(got.length).toBeLessThan(4)
  })

  it('stops scheduling when stopped', () => {
    const { s, got } = make()
    s.start(0, 120)
    s.stop()
    s.pump(1, 120)
    expect(got).toHaveLength(1)
    expect(s.playing).toBe(false)
  })
})
