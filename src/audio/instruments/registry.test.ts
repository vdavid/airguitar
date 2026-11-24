import { describe, expect, it } from 'vitest'
import { INSTRUMENT_IDS } from './catalog.ts'
import { getInstrument, soundingPitch } from './registry.ts'

describe('soundingPitch', () => {
  it('is the pitch after folding into the instrument range', () => {
    expect(soundingPitch('bells', 108)).toBe(96)
    expect(soundingPitch('bass', 12)).toBe(24)
    expect(soundingPitch('guitar', 64.3)).toBeCloseTo(64.3)
  })

  it('gives every instrument an id that matches its catalog id', () => {
    for (const id of INSTRUMENT_IDS) expect(getInstrument(id).id).toBe(id)
  })
})
