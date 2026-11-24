import { describe, expect, it } from 'vitest'
import { REST_AFTER, REST_LOST, RestTracker, type RestGeometry } from './rest.ts'

const on = (u = 0.3, d = 2): RestGeometry => ({ d, u, length: 400 })

describe('RestTracker', () => {
  it('starts a hold once a pointer stays on the string', () => {
    const r = new RestTracker()
    expect(r.feed('p', on(), 0, true)).toBeNull()
    expect(r.feed('p', on(), 0.05, true)).toBeNull()
    expect(r.feed('p', on(), REST_AFTER + 0.01, true)).toEqual({ type: 'start', u: 0.3 })
    expect(r.isHolding('p')).toBe(true)
  })

  it('does not start when the string is not ready, near the badge, or off the ends', () => {
    for (const [g, ok] of [
      [on(), false],
      [on(0.5), true],
      [on(0.02), true],
      [on(0.3, 15), true],
    ] as const) {
      const r = new RestTracker()
      for (let t = 0; t < 1; t += 0.05) expect(r.feed('p', g, t, ok)).toBeNull()
    }
  })

  it('starts over when the pointer leaves and comes back', () => {
    const r = new RestTracker()
    r.feed('p', on(), 0, true)
    expect(r.feed('p', on(), REST_AFTER + 0.3, true)).toBeNull()
  })

  it('follows the pointer along the string and ends when it moves off', () => {
    const r = new RestTracker()
    r.feed('p', on(), 0, true)
    r.feed('p', on(), 0.15, true)
    expect(r.feed('p', on(0.7, 18), 0.2, true)).toEqual({ type: 'move', u: 0.7 })
    expect(r.feed('p', on(0.7, 25), 0.25, true)).toEqual({ type: 'end' })
    expect(r.isHolding('p')).toBe(false)
  })

  it('expires holds whose pointer vanished, and forgets by prefix', () => {
    const r = new RestTracker()
    for (const p of ['h1-8', 'h2-8']) {
      r.feed(p, on(), 0, true)
      r.feed(p, on(), 0.15, true)
    }
    r.feed('h2-8', on(), 0.3, true)
    expect(r.expire(0.15 + REST_LOST + 0.01)).toEqual(['h1-8'])
    expect(r.forget('h2-')).toEqual(['h2-8'])
    expect(r.current()).toEqual([])
  })
})
