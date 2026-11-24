import type { InstrumentId } from '../audio/instruments/catalog.ts'
import { TONES, type ToneId } from '../music/theory.ts'

/**
 * The pre-made beats (Music Maker's), as plain data, plus the pure step → events decoding.
 *
 * Patterns are 16 steps to a bar. `x` = hit, `X` = accent, `o` = open hat, `-` = rest. A part with
 * several bars alternates them. Bass digits are chord tones as scale-degree offsets from the
 * chord's root (0 root, 3 third, 5 fifth, 8 octave). Chords change once a bar along a four-bar
 * progression of the key's parent scale, so bass and chords follow the global key and tone.
 */

export const BEAT_IDS = ['boombap', 'house', 'lofi', 'trap', 'dembow', 'maqsum'] as const
export type BeatId = (typeof BEAT_IDS)[number]

export const PART_IDS = ['kick', 'snare', 'hats', 'bass', 'chords'] as const
export type PartId = (typeof PART_IDS)[number]

export type DrumName = 'kick' | 'snare' | 'hat' | 'ohat' | 'clap' | 'dum' | 'tak' | 'riq' | 'tick'

export interface BeatPattern {
  readonly id: BeatId
  readonly name: string
  /** The tempo the beat starts at. */
  readonly bpm: number
  /** 0..1 of a step: how late every second sixteenth lands. */
  readonly swing: number
  /** Per-part names, in `PART_IDS` order (Maqsum's kick is a "Dum", and so on). */
  readonly labels: Readonly<Record<PartId, string>>
  readonly kick: readonly string[]
  readonly snare: readonly string[]
  readonly hats: readonly string[]
  readonly bass: readonly string[]
  readonly chords: readonly string[]
  readonly bassInstrument: InstrumentId
  readonly chordInstrument: InstrumentId
  /** Chord note length, as a multiple of the instrument's natural length (`NoteRequest.length`). */
  readonly chordLength: number
  /** Chords add the seventh. */
  readonly seventh?: boolean
  readonly kickAs?: DrumName
  readonly snareAs?: DrumName
  readonly hatAs?: DrumName
}

const labels = (
  kick = 'Kick',
  snare = 'Snare',
  hats = 'Hats',
  bass = 'Bass',
  chords = 'Chords',
): BeatPattern['labels'] => ({
  kick,
  snare,
  hats,
  bass,
  chords,
})

export const BEATS: Readonly<Record<BeatId, BeatPattern>> = {
  boombap: {
    id: 'boombap',
    name: 'Boom bap',
    bpm: 88,
    swing: 0.16,
    labels: labels(),
    kick: ['X-----x---x-----', 'X-----x--x-x----'],
    snare: ['----X-------X---'],
    hats: ['x-x-x-x-x-x-x-x-'],
    bass: ['0-----0---0-----', '0-----0--0-5----'],
    chords: ['x--x------x-----'],
    chordInstrument: 'piano',
    chordLength: 0.6,
    bassInstrument: 'bass',
  },
  house: {
    id: 'house',
    name: 'House',
    bpm: 122,
    swing: 0,
    labels: labels('Kick', 'Clap'),
    kick: ['X---X---X---X---'],
    snare: ['----X-------X---'],
    hats: ['--o---o---o---o-', '--o---o---o--xo-'],
    bass: ['--0--0-0--0--0-8'],
    chords: ['x--x--x---x--x--'],
    chordInstrument: 'epiano',
    chordLength: 0.35,
    bassInstrument: 'bass',
    snareAs: 'clap',
  },
  lofi: {
    id: 'lofi',
    name: 'Lo-fi',
    bpm: 76,
    swing: 0.22,
    labels: labels(),
    kick: ['X-----x-x-------', 'X-----x---x--x--'],
    snare: ['----x-------x---'],
    hats: ['x-x-x-x-x-x-x-x-'],
    bass: ['0-------0--5----', '0-------0-----3-'],
    chords: ['x-------x-------'],
    chordInstrument: 'epiano',
    chordLength: 1.4,
    bassInstrument: 'bass',
    seventh: true,
  },
  trap: {
    id: 'trap',
    name: 'Trap',
    bpm: 140,
    swing: 0,
    labels: labels('Kick', 'Snare', 'Hats', '808'),
    kick: ['X------x--x-----', 'X-----x---x--x--'],
    snare: ['--------X-------'],
    hats: ['x-x-x-x-xxx-x-xx', 'x-x-xxx-x-x-xxxx'],
    bass: ['0------0--0-----', '0-----0---0--5--'],
    chords: ['x---------------'],
    chordInstrument: 'bells',
    chordLength: 1,
    bassInstrument: 'sub',
  },
  dembow: {
    id: 'dembow',
    name: 'Dembow',
    bpm: 96,
    swing: 0,
    labels: labels(),
    kick: ['X---X---X---X---'],
    snare: ['---x--x----x--x-'],
    hats: ['x-x-x-x-x-x-x-x-'],
    bass: ['0-----0-0-----5-'],
    chords: ['x-----x---x-----'],
    chordInstrument: 'guitar',
    chordLength: 1,
    bassInstrument: 'bass',
  },
  maqsum: {
    id: 'maqsum',
    name: 'Maqsum',
    bpm: 100,
    swing: 0,
    labels: labels('Dum', 'Tak', 'Riq', 'Bass', 'Oud'),
    kick: ['X-------X-------'],
    snare: ['--X---X-----X---', '--X---X-----X-x-'],
    hats: ['x-xxx-xxx-xxx-xx'],
    bass: ['0-------0-----5-'],
    chords: ['x-------------x-'],
    chordInstrument: 'oud',
    chordLength: 1,
    bassInstrument: 'bass',
    kickAs: 'dum',
    snareAs: 'tak',
    hatAs: 'riq',
  },
}

export function isBeatId(value: unknown): value is BeatId {
  return typeof value === 'string' && (BEAT_IDS as readonly string[]).includes(value)
}

/** Four-bar chord progressions, as scale degrees of the tone's parent scale. */
const PROGRESSIONS = { major: [0, 4, 5, 3], minor: [0, 5, 2, 6], dorian: [0, 3, 0, 6], hijaz: [0, 1, 0, 6] } as const

const BASS_OFFSETS: Readonly<Record<string, number>> = { '0': 0, '3': 2, '5': 4, '8': 7 }

/** Bass notes stay at or below E3, chord notes at or below E5. */
const BASS_CEILING = 52
const CHORD_CEILING = 76

/** The seconds between chord notes, so a chord strums slightly. */
export const STRUM_GAP = 0.012

export type BeatEvent =
  | { readonly kind: 'drum'; readonly part: PartId; readonly drum: DrumName; readonly velocity: number }
  | {
      readonly kind: 'note'
      readonly part: 'bass' | 'chords'
      readonly instrument: InstrumentId
      readonly midi: number
      readonly velocity: number
      /** Seconds after the step's time (the strum). */
      readonly delay: number
      /** `NoteRequest.length`: 1 is the natural length. */
      readonly length: number
    }

/** The MIDI note of scale degree `degree` (may exceed the scale length) of `parent`, in `octave`. */
export function scaleDegree(steps: readonly number[], key: number, octave: number, degree: number): number {
  const n = steps.length
  const within = steps[((degree % n) + n) % n] ?? 0
  return 12 * (octave + 1) + key + 12 * Math.floor(degree / n) + within
}

const cell = (bars: readonly string[], bar: number, s: number): string => bars[bar % bars.length]?.[s] ?? '-'

/**
 * What one step of a beat plays: drum hits and pitched notes, for the parts that are on. Bass and
 * chords follow `key` and the parent scale of `tone` ("Free" counts as major).
 */
export function stepEvents(
  beat: BeatPattern,
  step: number,
  parts: ReadonlySet<PartId>,
  key: number,
  tone: ToneId,
): BeatEvent[] {
  return [...drumEvents(beat, step, parts), ...noteEvents(beat, step, parts, key, tone)]
}

function drumEvents(beat: BeatPattern, step: number, parts: ReadonlySet<PartId>): BeatEvent[] {
  const bar = Math.floor(step / 16)
  const s = step % 16
  const out: BeatEvent[] = []
  if (parts.has('kick')) {
    const c = cell(beat.kick, bar, s)
    if (c !== '-') out.push({ kind: 'drum', part: 'kick', drum: beat.kickAs ?? 'kick', velocity: c === 'X' ? 1 : 0.75 })
  }
  if (parts.has('snare')) {
    const c = cell(beat.snare, bar, s)
    if (c !== '-')
      out.push({ kind: 'drum', part: 'snare', drum: beat.snareAs ?? 'snare', velocity: c === 'X' ? 0.95 : 0.7 })
  }
  if (parts.has('hats')) {
    const c = cell(beat.hats, bar, s)
    if (c !== '-') {
      const drum = c === 'o' ? 'ohat' : (beat.hatAs ?? 'hat')
      out.push({ kind: 'drum', part: 'hats', drum, velocity: s % 4 === 0 ? 0.8 : 0.5 })
    }
  }
  return out
}

function noteEvents(
  beat: BeatPattern,
  step: number,
  parts: ReadonlySet<PartId>,
  key: number,
  tone: ToneId,
): BeatEvent[] {
  const bar = Math.floor(step / 16)
  const s = step % 16
  const out: BeatEvent[] = []
  const parent = TONES[tone].parent
  const scale = TONES[parent].steps
  const degree = PROGRESSIONS[parent][bar % 4] ?? 0
  if (parts.has('bass')) {
    const c = cell(beat.bass, bar, s)
    if (c !== '-') {
      let midi = scaleDegree(scale, key, 1, degree + (BASS_OFFSETS[c] ?? 0))
      while (midi > BASS_CEILING) midi -= 12
      out.push({
        kind: 'note',
        part: 'bass',
        instrument: beat.bassInstrument,
        midi,
        velocity: 0.85,
        delay: 0,
        length: 1,
      })
    }
  }
  if (parts.has('chords') && cell(beat.chords, bar, s) !== '-') {
    const tones = beat.seventh === true ? [0, 2, 4, 6] : [0, 2, 4]
    tones.forEach((k, i) => {
      let midi = scaleDegree(scale, key, 3, degree + k)
      while (midi > CHORD_CEILING) midi -= 12
      out.push({
        kind: 'note',
        part: 'chords',
        instrument: beat.chordInstrument,
        midi,
        velocity: 0.42,
        delay: i * STRUM_GAP,
        length: beat.chordLength,
      })
    })
  }
  return out
}
