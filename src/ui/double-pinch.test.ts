import { describe, expect, it } from 'vitest'
import { DoublePinch } from './double-pinch.ts'

/** Milliseconds → the seconds the clock runs in. */
const ms = (n: number): number => n / 1000

function armedAt(start: number): DoublePinch<string> {
  const d = new DoublePinch<string>()
  expect(d.pinch('h1', 'harp', start)).toBe('armed')
  d.release('h1', start + ms(80))
  return d
}

describe('DoublePinch', () => {
  it('arms on the first pinch and shows the armed tile', () => {
    const d = new DoublePinch<string>()
    expect(d.pinch('h1', 'harp', 1)).toBe('armed')
    expect(d.armed).toEqual({ tile: 'harp', at: 1 })
  })

  it('ignores a second pinch 199 ms after the first, and keeps the arm', () => {
    const d = armedAt(1)
    expect(d.pinch('h1', 'harp', 1 + ms(199))).toBe('ignored')
    expect(d.armed).toEqual({ tile: 'harp', at: 1 })
  })

  it('chooses at exactly 200 ms and at exactly 800 ms', () => {
    expect(armedAt(1).pinch('h1', 'harp', 1 + ms(200))).toBe('chosen')
    expect(armedAt(1.1).pinch('h1', 'harp', 1.1 + ms(800))).toBe('chosen')
  })

  it('clears the arm once chosen', () => {
    const d = armedAt(1)
    d.pinch('h1', 'harp', 1.4)
    expect(d.armed).toBeNull()
  })

  it('re-arms (does not choose) 801 ms after the first', () => {
    const d = armedAt(1)
    expect(d.pinch('h1', 'harp', 1 + ms(801))).toBe('armed')
    expect(d.armed).toEqual({ tile: 'harp', at: 1 + ms(801) })
  })

  it('re-arms on a different tile instead of choosing', () => {
    const d = armedAt(1)
    expect(d.pinch('h1', 'oud', 1.4)).toBe('armed')
    expect(d.armed?.tile).toBe('oud')
  })

  it('accepts the second pinch from another hand on the same tile', () => {
    const d = armedAt(1)
    expect(d.pinch('h2', 'harp', 1.3)).toBe('chosen')
  })

  it('ignores release jitter: a re-close soon after the same hand let go', () => {
    const d = new DoublePinch<string>()
    d.pinch('h1', 'harp', 1)
    // Held for 300 ms, a tracker flicker opens it for 60 ms, then it closes again.
    d.release('h1', 1.3)
    expect(d.pinch('h1', 'harp', 1.36)).toBe('ignored')
    expect(d.armed).toEqual({ tile: 'harp', at: 1 })
  })

  it('counts a re-close after a real release', () => {
    const d = new DoublePinch<string>()
    d.pinch('h1', 'harp', 1)
    d.release('h1', 1.15)
    expect(d.pinch('h1', 'harp', 1.3)).toBe('chosen')
  })

  it('expires the arm after 800 ms', () => {
    const d = armedAt(1)
    expect(d.update(1 + ms(800), [])).toEqual({ tile: 'harp', at: 1 })
    expect(d.update(1 + ms(801), [])).toBeNull()
  })

  it('clears the arm when a hand moves onto another tile', () => {
    const d = armedAt(1)
    expect(d.update(1.1, ['harp'])?.tile).toBe('harp')
    // Off every tile (a gap, the header) keeps it.
    expect(d.update(1.15, [null])?.tile).toBe('harp')
    // Another hand elsewhere while one stays on the armed tile keeps it.
    expect(d.update(1.2, ['harp', 'oud'])?.tile).toBe('harp')
    expect(d.update(1.25, ['oud'])).toBeNull()
  })

  it('forgets the arm on reset but keeps release times', () => {
    const d = new DoublePinch<string>()
    d.pinch('h1', 'harp', 1)
    d.release('h1', 1.3)
    d.reset()
    expect(d.armed).toBeNull()
    expect(d.pinch('h1', 'harp', 1.35)).toBe('ignored')
  })
})
