import { describe, expect, it } from 'vitest'
import { sweep, speedToVelocity, type SideMemory } from './pluck.ts'

const A = { x: 100, y: 300 }
const B = { x: 500, y: 300 }
const W = 1280

/** Feeds a path of points 1/60 s apart and returns every crossing. */
function run(points: { x: number; y: number }[]): ReturnType<typeof sweep>['crossing'][] {
  let memory: SideMemory | undefined
  return points.map((p, i) => {
    const r = sweep(memory, A, B, p, i / 60, W)
    memory = r.memory
    return r.crossing
  })
}

describe('sweep', () => {
  it('plucks when a pointer crosses between the ends', () => {
    const hits = run([
      { x: 300, y: 280 },
      { x: 300, y: 320 },
    ]).filter(Boolean)
    expect(hits).toHaveLength(1)
    expect(hits[0]?.u).toBeCloseTo(0.5)
    expect(hits[0]?.point.y).toBeCloseTo(300)
  })

  it('ignores jitter inside the dead zone', () => {
    expect(run([300, 301, 299, 302, 298, 301].map((y) => ({ x: 300, y }))).every((c) => c === null)).toBe(true)
  })

  it('still plucks a slow crossing that lingers on the string', () => {
    const hits = run([280, 290, 299, 300, 301, 300, 310].map((y) => ({ x: 300, y }))).filter(Boolean)
    expect(hits).toHaveLength(1)
  })

  it('does not pluck when crossing the line beyond an end', () => {
    expect(
      run([
        { x: 600, y: 280 },
        { x: 600, y: 320 },
      ]).every((c) => c === null),
    ).toBe(true)
  })

  it('forgets a stale memory', () => {
    const first = sweep(undefined, A, B, { x: 300, y: 280 }, 0, W)
    const later = sweep(first.memory, A, B, { x: 300, y: 320 }, 2, W)
    expect(later.crossing).toBeNull()
  })

  it('ignores a huge jump (tracking glitch)', () => {
    const first = sweep(undefined, A, B, { x: 110, y: 280 }, 0, W)
    const jump = sweep(first.memory, A, B, { x: 495, y: 340 }, 0.016, W)
    expect(jump.crossing).toBeNull()
  })

  it('reports which side the pointer came from', () => {
    const [, down] = run([
      { x: 300, y: 280 },
      { x: 300, y: 320 },
    ])
    const [, up] = run([
      { x: 300, y: 320 },
      { x: 300, y: 280 },
    ])
    expect(down?.from).not.toBe(up?.from)
  })
})

describe('speedToVelocity', () => {
  it('is never silent and caps at 1', () => {
    expect(speedToVelocity(0)).toBe(0.3)
    expect(speedToVelocity(100000)).toBe(1)
  })
})
