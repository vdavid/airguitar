/**
 * Keys, scales ("tones"), and note names. Pitches are MIDI note numbers (60 = middle C), and may be
 * fractional when the tone is "Free".
 */

/** Pitch classes 0..11, C first. */
export const KEY_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const

export type ToneId = 'major' | 'minor' | 'pentamaj' | 'pentamin' | 'blues' | 'dorian' | 'hijaz' | 'free'

type Parent = 'major' | 'minor' | 'dorian' | 'hijaz'

export interface Tone {
  readonly id: ToneId
  readonly name: string
  /** Semitones above the key's root. Empty for "Free" (no snapping). */
  readonly steps: readonly number[]
  /** Which parent scale decides sharps or flats when spelling notes. */
  readonly parent: Parent
}

export const TONES: Readonly<Record<ToneId, Tone>> = {
  major: { id: 'major', name: 'Major', steps: [0, 2, 4, 5, 7, 9, 11], parent: 'major' },
  minor: { id: 'minor', name: 'Minor', steps: [0, 2, 3, 5, 7, 8, 10], parent: 'minor' },
  pentamaj: { id: 'pentamaj', name: 'Major pentatonic', steps: [0, 2, 4, 7, 9], parent: 'major' },
  pentamin: { id: 'pentamin', name: 'Minor pentatonic', steps: [0, 3, 5, 7, 10], parent: 'minor' },
  blues: { id: 'blues', name: 'Blues', steps: [0, 3, 5, 6, 7, 10], parent: 'minor' },
  dorian: { id: 'dorian', name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10], parent: 'dorian' },
  hijaz: { id: 'hijaz', name: 'Hijaz', steps: [0, 1, 4, 5, 7, 8, 10], parent: 'hijaz' },
  free: { id: 'free', name: 'Free', steps: [], parent: 'major' },
}

export const TONE_ORDER: readonly ToneId[] = [
  'major',
  'minor',
  'pentamaj',
  'pentamin',
  'blues',
  'dorian',
  'hijaz',
  'free',
]

export function isToneId(value: unknown): value is ToneId {
  return typeof value === 'string' && (TONE_ORDER as readonly string[]).includes(value)
}

export function isKey(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 12
}

const mod12 = (n: number): number => ((n % 12) + 12) % 12

/**
 * Snaps a (possibly fractional) MIDI pitch to the nearest note of the key + tone, in any octave.
 * "Free" returns the pitch unchanged. Ties go to the lower note.
 */
export function snapToScale(midi: number, key: number, tone: ToneId): number {
  const steps = TONES[tone].steps
  if (steps.length === 0) return midi
  const rel = midi - key
  const octave = Math.floor(rel / 12)
  const within = rel - octave * 12
  let best = 0
  let bestErr = Infinity
  // 12 is the next octave's root, so a pitch just under it can snap up.
  for (const s of [...steps, 12]) {
    const err = Math.abs(within - s)
    if (err < bestErr) {
      bestErr = err
      best = s
    }
  }
  return key + octave * 12 + best
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** Spells a pitch class with sharps or flats to suit the key (A major has G♯, not A♭). */
export function spell(pitchClass: number, key: number, tone: ToneId): string {
  const shift = { major: 0, minor: 3, dorian: 10, hijaz: 8 }[TONES[tone].parent]
  const relMajor = (key + shift) % 12
  const names = [5, 10, 3, 8, 1, 6].includes(relMajor) ? FLAT_NAMES : SHARP_NAMES
  return names[mod12(pitchClass)] ?? '?'
}

/** A label like "E4". Fractional pitches name their nearest note. */
export function noteLabel(midi: number, key: number, tone: ToneId): string {
  const n = Math.round(midi)
  return `${spell(n, key, tone)}${Math.floor(n / 12) - 1}`
}
