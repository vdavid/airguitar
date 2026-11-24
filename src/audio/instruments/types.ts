import type { InstrumentId } from './catalog.ts'
import type { Range } from './range.ts'

/** Everything an instrument needs to make sound, handed in by the engine. */
export interface InstrumentContext {
  readonly ctx: BaseAudioContext
  /**
   * This instrument's input on the mix (its own gain, tone shaping, and reverb send are behind
   * it). Connect voices here.
   */
  readonly out: AudioNode
  /** Two seconds of white noise, for breath, bow hair, and drum sounds. */
  readonly noise: AudioBuffer
}

export interface NoteRequest {
  /** MIDI pitch; fractional for the "Free" tone. */
  readonly midi: number
  /** 0..1 */
  readonly velocity: number
  /** -1 (left) .. 1 (right). */
  readonly pan: number
  /** Audio-clock start time. Defaults to now. */
  readonly when?: number
  /**
   * For sustaining instruments: keep sounding until `release()` (a rest-finger hold). Otherwise
   * a note plays its natural length.
   */
  readonly held?: boolean
  /**
   * Scales the note's natural length (1, the default, is natural). The beats play short chords
   * with it (Music Maker's `chordLen`). Sustaining instruments hold shorter or longer; struck
   * keys decay faster or slower. Ignored when `held`.
   */
  readonly length?: number
}

/** A sounding note. Every method is safe to call after the note has died away. */
export interface Voice {
  /** Retunes the note (the string got longer or shorter while ringing). */
  setPitch(midi: number): void
  /** Bends relative to the current pitch, in cents (pinch-bend). 0 returns to pitch. */
  bend(cents: number): void
  /** Stops it with a short fade. */
  release(): void
  /** Audio-clock time when the note will have died away by itself. */
  readonly endsAt: number
}

/**
 * What a finger resting on a string does: `sustain` holds the note until the finger leaves (it gets
 * `held: true` and a `release()`), `roll` keeps re-striking it (mallets, drums, tremolo-picked
 * courses), `once` sounds it once.
 */
export type HoldStyle = 'sustain' | 'roll' | 'once'

export interface Instrument {
  readonly id: InstrumentId
  readonly hold: HoldStyle
  /** The range notes fold into by octaves (`range.ts`). Unpitched instruments (drums) have none. */
  readonly range?: Range
  play(context: InstrumentContext, note: NoteRequest): Voice
  /** What the note pop says for this pitch, when a note name doesn't fit (drums name the drum). */
  label?(midi: number): string
}
