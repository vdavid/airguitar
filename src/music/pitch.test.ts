import { describe, expect, it } from 'vitest'
import { rawPitch, REF_REL_LENGTH, stringPitch } from './pitch.ts'
import { midiToFreq, noteLabel, snapToScale, TONES } from './theory.ts'

const DIAG = 1000

describe('rawPitch', () => {
  it('plays the base note at the reference length', () => {
    expect(rawPitch(REF_REL_LENGTH * DIAG, DIAG, 48)).toBeCloseTo(48)
  })

  it('goes up an octave when the string halves', () => {
    const long = rawPitch(600, DIAG, 48)
    const short = rawPitch(300, DIAG, 48)
    expect(short - long).toBeCloseTo(12)
  })

  it('keeps frequency proportional to 1/length', () => {
    const f1 = midiToFreq(rawPitch(500, DIAG, 48))
    const f2 = midiToFreq(rawPitch(250, DIAG, 48))
    expect(f2 / f1).toBeCloseTo(2)
  })

  it('clamps tiny and huge strings', () => {
    expect(rawPitch(1, DIAG, 48)).toBe(rawPitch(10, DIAG, 48))
    expect(rawPitch(5000, DIAG, 48)).toBe(rawPitch(DIAG, DIAG, 48))
  })
})

describe('snapToScale', () => {
  it('leaves notes already in the scale alone', () => {
    // A minor pentatonic: A C D E G
    for (const midi of [57, 60, 62, 64, 67, 69]) expect(snapToScale(midi, 9, 'pentamin')).toBe(midi)
  })

  it('snaps to the nearest scale note', () => {
    expect(snapToScale(58, 9, 'pentamin')).toBe(57) // B♭ → A
    expect(snapToScale(59.2, 9, 'pentamin')).toBe(60) // near B → C
    expect(snapToScale(65.4, 9, 'pentamin')).toBe(64) // F-ish → E
  })

  it('can snap up to the next octave root', () => {
    expect(snapToScale(68.6, 9, 'pentamin')).toBe(69) // just under A → A
  })

  it('always lands on a scale note, for every tone and key', () => {
    for (const tone of ['major', 'minor', 'pentamaj', 'pentamin', 'blues', 'dorian', 'hijaz'] as const) {
      for (let key = 0; key < 12; key++) {
        for (let m = 40; m < 80; m += 0.37) {
          const s = snapToScale(m, key, tone)
          expect(TONES[tone].steps).toContain((((s - key) % 12) + 12) % 12)
          expect(Math.abs(s - m)).toBeLessThanOrEqual(2)
        }
      }
    }
  })

  it('does nothing for the Free tone', () => {
    expect(snapToScale(61.37, 9, 'free')).toBe(61.37)
  })
})

describe('stringPitch', () => {
  it('snaps a length to the key', () => {
    const p = stringPitch(333, DIAG, 48, 0, 'major')
    expect(Number.isInteger(p)).toBe(true)
    expect([0, 2, 4, 5, 7, 9, 11]).toContain(p % 12)
  })

  it('gives continuous pitch in Free', () => {
    expect(Number.isInteger(stringPitch(333, DIAG, 48, 0, 'free'))).toBe(false)
  })
})

describe('noteLabel', () => {
  it('names notes with octave numbers', () => {
    expect(noteLabel(60, 0, 'major')).toBe('C4')
    expect(noteLabel(57, 9, 'minor')).toBe('A3')
  })

  it('spells with flats in flat keys', () => {
    expect(noteLabel(70, 5, 'major')).toBe('B♭4')
    expect(noteLabel(68, 9, 'major')).toBe('G♯4')
  })
})
