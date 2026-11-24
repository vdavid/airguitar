import { describe, expect, it } from 'vitest'
import { stringPitch } from '../../music/pitch.ts'
import { baseMidi } from './catalog.ts'
import { DRUM_KIT, drumIndex, drums, handDrums, HAND_DRUMS } from './drums.ts'

describe('drumIndex', () => {
  const base = baseMidi('drums')
  const diagonal = Math.hypot(1280, 720)
  const drumFor = (length: number): string =>
    DRUM_KIT[drumIndex(stringPitch(length, diagonal, base, 0, 'free'), base, DRUM_KIT.length)]?.id ?? '?'

  it('gives long strings low drums and short strings high ones', () => {
    expect(drumFor(1000)).toBe('kick')
    expect(drumFor(750)).toBe('kick')
    expect(drumFor(620)).toBe('tomL')
    expect(drumFor(500)).toBe('snare')
    expect(drumFor(150)).toBe('hat')
  })

  it('never gets lower as the string gets shorter', () => {
    let last = -1
    for (let length = 1400; length >= 80; length -= 10) {
      const i = drumIndex(stringPitch(length, diagonal, base, 0, 'free'), base, DRUM_KIT.length)
      expect(i).toBeGreaterThanOrEqual(last)
      last = i
    }
    expect(last).toBe(DRUM_KIT.length - 1)
  })

  it('stays inside the kit', () => {
    expect(drumIndex(0, base, 8)).toBe(0)
    expect(drumIndex(200, base, 8)).toBe(7)
  })
})

describe('drum labels', () => {
  it('names the drum, not a note', () => {
    expect(drums.label?.(baseMidi('drums'))).toBe('Kick')
    expect(handDrums.label?.(baseMidi('handdrums'))).toBe('Dum')
    expect(handDrums.label?.(baseMidi('handdrums') + 40)).toBe(HAND_DRUMS.at(-1)?.label)
  })
})
