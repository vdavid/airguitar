import { baseMidi, type InstrumentId } from '../audio/instruments/catalog.ts'
import type { Vec } from '../geom.ts'
import { REF_REL_LENGTH } from '../music/pitch.ts'
import type { ToneId } from '../music/theory.ts'
import { LANDSCAPE, orient, type StageSnapshot, type StageString } from '../state/stage.ts'

/**
 * Ready-made layouts, adapted from Music Maker's starters to one pitch per string: each string is
 * cut to the exact length that plays its note (see `music/pitch.ts`), so a row of strings is a
 * scale you can sweep across.
 *
 * Positions are in landscape stage units (1280 × 720). On a vertical stage the layout is
 * transposed (x ↔ y), which keeps every length, and so every pitch.
 */

export interface StarterString {
  readonly instrument: InstrumentId
  /** MIDI note; must be in the starter's key + tone. */
  readonly note: number
  /** The string's middle, or its bottom end with `from: 'bottom'`. */
  readonly at: Vec
  readonly vertical?: boolean
  readonly from?: 'middle' | 'bottom'
}

export interface Starter {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly key: number
  readonly tone: ToneId
  readonly newStringInstrument: InstrumentId
  readonly strings: readonly StarterString[]
}

const NOTE_RE = /^([A-G])([#b]?)(-?\d)$/
const LETTERS: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** "A4" → 69, "F#3" → 54, "Bb2" → 46. */
export function note(name: string): number {
  const m = NOTE_RE.exec(name)
  const letter = m?.[1]
  const octave = m?.[3]
  if (letter === undefined || octave === undefined) throw new Error(`Bad note name: ${name}`)
  const acc = m?.[2] === '#' ? 1 : m?.[2] === 'b' ? -1 : 0
  return 12 * (Number(octave) + 1) + (LETTERS[letter] ?? 0) + acc
}

/** The string length (stage units) that plays `midi` on an instrument: the inverse of `rawPitch`. */
export function lengthFor(midi: number, instrument: InstrumentId, diagonal: number): number {
  return diagonal * REF_REL_LENGTH * Math.pow(2, -(midi - baseMidi(instrument)) / 12)
}

const row = (instrument: InstrumentId, notes: readonly string[], x: number, y0: number, dy: number): StarterString[] =>
  notes.map((n, i) => ({ instrument, note: note(n), at: { x, y: y0 + i * dy } }))

const harpColumn = (instrument: InstrumentId, notes: readonly string[], x0: number, dx: number, bottom: number) =>
  notes.map((n, i) => ({
    instrument,
    note: note(n),
    at: { x: x0 + i * dx, y: bottom },
    vertical: true,
    from: 'bottom' as const,
  }))

export const STARTERS: readonly Starter[] = [
  {
    id: 'harp',
    name: 'Harp',
    description: 'Eight harp strings in A minor pentatonic, long and low on the left',
    key: 9,
    tone: 'pentamin',
    newStringInstrument: 'harp',
    strings: harpColumn('harp', ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6'], 290, 100, 650),
  },
  {
    id: 'bass-guitar',
    name: 'Bass and guitar',
    description: 'Six guitar strings on top, two bass strings below, in E minor pentatonic',
    key: 4,
    tone: 'pentamin',
    newStringInstrument: 'guitar',
    strings: [
      ...row('guitar', ['E3', 'G3', 'A3', 'B3', 'D4', 'E4'], 640, 130, 52),
      ...row('bass', ['E1', 'A1'], 640, 520, 90),
    ],
  },
  {
    id: 'drum-circle',
    name: 'Drum circle',
    description: 'Drum kit, hand drums, a marimba scale, and an 808 bass, in D major pentatonic',
    key: 2,
    tone: 'pentamaj',
    newStringInstrument: 'marimba',
    strings: [
      { instrument: 'drums', note: note('D4'), at: { x: 350, y: 150 } },
      { instrument: 'handdrums', note: note('A4'), at: { x: 930, y: 150 } },
      ...row('marimba', ['D4', 'E4', 'F#4', 'A4', 'B4'], 640, 250, 70),
      { instrument: 'sub', note: note('D2'), at: { x: 640, y: 640 } },
    ],
  },
  {
    id: 'oud-night',
    name: 'Oud night',
    description: 'Oud, a qanun scale, and hand drums, in D Hijaz',
    key: 2,
    tone: 'hijaz',
    newStringInstrument: 'oud',
    strings: [
      ...row('oud', ['G3', 'A3', 'D4'], 640, 140, 70),
      ...row('qanun', ['D5', 'Eb5', 'F#5', 'G5', 'A5'], 470, 380, 66),
      { instrument: 'handdrums', note: note('A4'), at: { x: 1030, y: 650 }, vertical: true, from: 'bottom' },
    ],
  },
  {
    id: 'chamber',
    name: 'Chamber group',
    description: 'Violin, cello, flute, and voices in G major',
    key: 7,
    tone: 'major',
    newStringInstrument: 'violin',
    strings: [
      ...row('violin', ['G4', 'D5', 'A5'], 640, 130, 60),
      ...row('cello', ['G2', 'D3'], 640, 330, 60),
      { instrument: 'flute', note: note('B5'), at: { x: 330, y: 560 } },
      { instrument: 'voices', note: note('D4'), at: { x: 830, y: 560 } },
      { instrument: 'voices', note: note('G4'), at: { x: 830, y: 640 } },
    ],
  },
]

/** The stage snapshot for a starter, landscape or (transposed) vertical. */
export function starterSnapshot(starter: Starter, vertical = false): StageSnapshot {
  const width = vertical ? LANDSCAPE.height : LANDSCAPE.width
  const height = vertical ? LANDSCAPE.width : LANDSCAPE.height
  const diagonal = Math.hypot(width, height)
  const flip = (p: Vec): Vec => (vertical ? { x: p.y, y: p.x } : p)
  const strings: StageString[] = starter.strings.map((s, i) => {
    const len = lengthFor(s.note, s.instrument, diagonal)
    const dir = s.vertical === true ? { x: 0, y: -1 } : { x: 1, y: 0 }
    const back = s.from === 'bottom' ? 0 : len / 2
    const a = { x: s.at.x - dir.x * back, y: s.at.y - dir.y * back }
    const b = { x: a.x + dir.x * len, y: a.y + dir.y * len }
    return orient({ id: i + 1, a: flip(a), b: flip(b), instrument: s.instrument })
  })
  return {
    version: 1,
    width,
    height,
    key: starter.key,
    tone: starter.tone,
    newStringInstrument: starter.newStringInstrument,
    strings,
  }
}
