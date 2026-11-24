import { describe, expect, it } from 'vitest'
import { orient, parseSnapshot, StageStore, MAX_STRINGS } from '../state/stage.ts'
import {
  HAND_REACH,
  isMerged,
  keepApart,
  MIN_KEPT_LENGTH,
  nearestBody,
  nearestEndpoint,
  nearestMiddle,
} from './model.ts'

const s1 = { id: 1, a: { x: 100, y: 100 }, b: { x: 500, y: 100 }, instrument: 'guitar' as const }
const s2 = { id: 2, a: { x: 100, y: 400 }, b: { x: 500, y: 400 }, instrument: 'harp' as const }

describe('hit tests', () => {
  it('grabs the nearest endpoint within reach', () => {
    expect(nearestEndpoint([s1, s2], { x: 495, y: 110 }, HAND_REACH.endpoint)).toEqual({ string: s1, end: 'b' })
    expect(nearestEndpoint([s1, s2], { x: 300, y: 250 }, HAND_REACH.endpoint)).toBeNull()
  })

  it('finds the middle badge', () => {
    expect(nearestMiddle([s1, s2], { x: 305, y: 395 }, HAND_REACH.middle)).toBe(s2)
    expect(nearestMiddle([s1, s2], { x: 150, y: 395 }, HAND_REACH.middle)).toBeNull()
  })

  it('finds the body away from the ends', () => {
    expect(nearestBody([s1], { x: 200, y: 110 }, HAND_REACH.body)?.u).toBeCloseTo(0.25)
    expect(nearestBody([s1], { x: 102, y: 105 }, HAND_REACH.body)).toBeNull()
  })
})

describe('orient', () => {
  it('puts the low end on the left', () => {
    expect(orient({ a: { x: 500, y: 0 }, b: { x: 100, y: 0 } }).a.x).toBe(100)
  })

  it('puts the low end at the bottom of a steep string', () => {
    expect(orient({ a: { x: 0, y: 100 }, b: { x: 10, y: 600 } }).a.y).toBe(600)
  })
})

describe('endpoint grab, move, and merge-delete', () => {
  it('moves an end and settles orientation on release', () => {
    const store = new StageStore()
    const s = store.addString({ x: 100, y: 100 }, { x: 500, y: 100 })
    if (!s) throw new Error('no string')
    store.moveEnd(s.id, 'a', { x: 900, y: 100 })
    expect(store.find(s.id)?.a.x).toBe(900)
    store.settle(s.id)
    expect(store.find(s.id)?.a.x).toBe(500)
  })

  it('counts ends dropped on each other as merged', () => {
    const store = new StageStore()
    const s = store.addString({ x: 100, y: 100 }, { x: 500, y: 100 })
    if (!s) throw new Error('no string')
    store.moveEnd(s.id, 'b', { x: 120, y: 110 })
    const moved = store.find(s.id)
    expect(moved && isMerged(moved)).toBe(true)
    store.moveEnd(s.id, 'b', { x: 300, y: 110 })
    const apart = store.find(s.id)
    expect(apart && isMerged(apart)).toBe(false)
  })

  it('emits a removal with its reason', () => {
    const store = new StageStore()
    const s = store.addString({ x: 100, y: 100 }, { x: 500, y: 100 })
    const reasons: string[] = []
    store.changes.subscribe((c) => {
      if (c.type === 'string-removed') reasons.push(c.reason)
    })
    if (s) store.removeString(s.id, 'merged')
    expect(reasons).toEqual(['merged'])
    expect(store.state.strings).toHaveLength(0)
  })

  it('caps the number of strings', () => {
    const store = new StageStore()
    for (let i = 0; i < MAX_STRINGS + 3; i++) store.addString({ x: 0, y: i * 10 }, { x: 200, y: i * 10 })
    expect(store.state.strings).toHaveLength(MAX_STRINGS)
  })

  it('holds 32 strings', () => {
    expect(MAX_STRINGS).toBe(32)
  })
})

describe('keepApart (Mixed mode: moving an end never deletes)', () => {
  it('leaves a far enough end alone', () => {
    expect(keepApart({ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 300, y: 100 })).toEqual({ x: 400, y: 100 })
  })

  it('pushes a too-close end out to the minimum length, on its side', () => {
    const p = keepApart({ x: 100, y: 100 }, { x: 110, y: 100 }, { x: 300, y: 100 })
    expect(p.x).toBeCloseTo(100 + MIN_KEPT_LENGTH)
    expect(p.y).toBeCloseTo(100)
  })

  it('uses the previous direction when the end lands exactly on the other end', () => {
    const p = keepApart({ x: 100, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 400 })
    expect(p.x).toBeCloseTo(100)
    expect(p.y).toBeCloseTo(100 + MIN_KEPT_LENGTH)
  })

  it('keeps a string out of the merge zone', () => {
    const s = { ...s1, b: keepApart(s1.a, { x: 101, y: 101 }, s1.b) }
    expect(isMerged(s)).toBe(false)
  })
})

describe('snapshots', () => {
  it('round-trips through JSON', () => {
    const store = new StageStore()
    store.addString({ x: 100, y: 100 }, { x: 500, y: 100 }, 'harp')
    store.setTone('free')
    const json = JSON.parse(JSON.stringify(store.snapshot())) as unknown
    const other = new StageStore()
    other.load(json)
    expect(other.state).toEqual(store.state)
    expect(other.addString({ x: 0, y: 0 }, { x: 300, y: 0 })?.id).toBe(2)
  })

  it('accepts a full stage of 32 strings', () => {
    const strings = Array.from({ length: 32 }, (_, i) => ({
      id: i + 1,
      a: { x: 100, y: 20 + i * 20 },
      b: { x: 900, y: 20 + i * 20 },
      instrument: 'guitar',
    }))
    expect(parseSnapshot({ ...new StageStore().snapshot(), strings }).strings).toHaveLength(32)
  })

  it('rejects malformed data', () => {
    expect(() => parseSnapshot(null)).toThrow()
    expect(() => parseSnapshot({ ...new StageStore().snapshot(), tone: 'jazz' })).toThrow()
    expect(() =>
      parseSnapshot({ ...new StageStore().snapshot(), strings: [{ id: 1, a: { x: 0, y: 0 }, instrument: 'guitar' }] }),
    ).toThrow()
    expect(() =>
      parseSnapshot({
        ...new StageStore().snapshot(),
        strings: [{ id: 1, a: { x: 0, y: 0 }, b: { x: 1, y: 1 }, instrument: '__proto__' }],
      }),
    ).toThrow()
  })
})
