import { describe, expect, it } from 'vitest'
import { baseMidi } from '../audio/instruments/catalog.ts'
import { MAX_REL_LENGTH, MIN_REL_LENGTH, stringPitch } from '../music/pitch.ts'
import { TONES } from '../music/theory.ts'
import { MAX_STRINGS, parseSnapshot, StageStore } from '../state/stage.ts'
import { stringLength } from '../strings/model.ts'
import { lengthFor, note, STARTERS, starterSnapshot } from './starters.ts'

/** Stage y below which the top bar sits. */
const BAR = 90

describe('note', () => {
  it('reads note names', () => {
    expect(note('A4')).toBe(69)
    expect(note('C4')).toBe(60)
    expect(note('F#3')).toBe(54)
    expect(note('Bb2')).toBe(46)
    expect(() => note('H2')).toThrow()
  })
})

describe('lengthFor', () => {
  it('inverts the length → pitch mapping', () => {
    const diag = Math.hypot(1280, 720)
    for (const midi of [57, 62, 69, 80]) {
      expect(stringPitch(lengthFor(midi, 'harp', diag), diag, baseMidi('harp'), 0, 'free')).toBeCloseTo(midi, 9)
    }
  })
})

describe('starters', () => {
  it('have unique ids and notes in their own key and tone', () => {
    expect(new Set(STARTERS.map((s) => s.id)).size).toBe(STARTERS.length)
    for (const st of STARTERS) {
      for (const s of st.strings) {
        expect(TONES[st.tone].steps, `${st.id} ${String(s.note)}`).toContain((((s.note - st.key) % 12) + 12) % 12)
      }
    }
  })

  for (const vertical of [false, true]) {
    for (const st of STARTERS) {
      it(`${st.id} (${vertical ? 'vertical' : 'landscape'}) loads, fits, and plays its notes`, () => {
        const snap = starterSnapshot(st, vertical)
        expect(parseSnapshot(snap)).toEqual(snap)
        expect(snap.strings.length).toBeLessThanOrEqual(MAX_STRINGS)
        expect(snap.strings.length).toBe(st.strings.length)
        const diag = Math.hypot(snap.width, snap.height)
        snap.strings.forEach((s, i) => {
          for (const p of [s.a, s.b]) {
            expect(p.x).toBeGreaterThanOrEqual(0)
            expect(p.x).toBeLessThanOrEqual(snap.width)
            expect(p.y).toBeGreaterThanOrEqual(BAR)
            expect(p.y).toBeLessThanOrEqual(snap.height)
          }
          const rel = stringLength(s) / diag
          expect(rel).toBeGreaterThan(MIN_REL_LENGTH)
          expect(rel).toBeLessThan(MAX_REL_LENGTH)
          const want = st.strings[i]?.note
          expect(stringPitch(stringLength(s), diag, baseMidi(s.instrument), snap.key, snap.tone)).toBe(want)
        })
        const store = new StageStore()
        store.load(snap)
        expect(store.state.strings).toHaveLength(st.strings.length)
      })
    }
  }
})
