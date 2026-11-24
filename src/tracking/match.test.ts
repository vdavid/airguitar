import { describe, expect, it } from 'vitest'
import { dedupeHands, matchHands } from './match.ts'

describe('matchHands', () => {
  it('keeps hands with their closest previous position', () => {
    const prev = [
      { x: 100, y: 100 },
      { x: 800, y: 100 },
    ]
    expect(
      matchHands(prev, [
        { x: 790, y: 110 },
        { x: 110, y: 90 },
      ]),
    ).toEqual([1, 0])
  })

  it('marks far detections as new hands', () => {
    expect(matchHands([{ x: 0, y: 0 }], [{ x: 1000, y: 0 }])).toEqual([-1])
  })

  it('handles eight hands', () => {
    const prev = Array.from({ length: 8 }, (_, i) => ({ x: i * 150, y: 300 }))
    const dets = [...prev].reverse().map((p) => ({ x: p.x + 5, y: p.y - 5 }))
    expect(matchHands(prev, dets)).toEqual([7, 6, 5, 4, 3, 2, 1, 0])
  })
})

describe('dedupeHands', () => {
  it('drops a hand reported twice', () => {
    const hand = Array.from({ length: 21 }, (_, i) => ({ x: 100 + i, y: 100 }))
    const twin = hand.map((p) => ({ x: p.x + 4, y: p.y + 4 }))
    const other = hand.map((p) => ({ x: p.x + 500, y: p.y }))
    expect(dedupeHands([hand, twin, other])).toHaveLength(2)
  })
})
