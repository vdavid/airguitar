import { describe, expect, it, vi } from 'vitest'
import type { Voice } from './instruments/types.ts'
import { VoicePool } from './voices.ts'

function voice(endsAt: number) {
  const setPitch = vi.fn<(midi: number) => void>()
  const bend = vi.fn<(cents: number) => void>()
  const release = vi.fn<() => void>()
  const v: Voice = { endsAt, setPitch, bend, release }
  return Object.assign(v, { mocks: { setPitch, bend, release } })
}

describe('VoicePool', () => {
  it('steals the oldest sounding voice when full', () => {
    const pool = new VoicePool(2)
    const a = voice(10)
    const b = voice(10)
    const c = voice(10)
    pool.add(a, 0)
    pool.add(b, 0)
    pool.add(c, 0)
    expect(a.mocks.release).toHaveBeenCalledOnce()
    expect(b.mocks.release).not.toHaveBeenCalled()
    expect(pool.size).toBe(2)
  })

  it('does not count voices that have died away', () => {
    const pool = new VoicePool(2)
    const a = voice(1)
    pool.add(a, 0)
    pool.add(voice(10), 0)
    pool.add(voice(10), 5)
    expect(a.mocks.release).not.toHaveBeenCalled()
    expect(pool.size).toBe(2)
  })

  it('forgets a voice once it is released, and passes calls through', () => {
    const pool = new VoicePool(2)
    const a = voice(10)
    const tracked = pool.add(a, 0)
    tracked.setPitch(60)
    tracked.bend(20)
    tracked.release()
    expect(a.mocks.setPitch).toHaveBeenCalledWith(60)
    expect(a.mocks.bend).toHaveBeenCalledWith(20)
    expect(a.mocks.release).toHaveBeenCalledOnce()
    expect(tracked.endsAt).toBe(10)
    expect(pool.size).toBe(0)
  })
})
