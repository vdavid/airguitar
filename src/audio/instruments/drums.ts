import { clamp } from '../../geom.ts'
import { baseMidi, type InstrumentId } from './catalog.ts'
import { env } from './synth.ts'
import type { Instrument, InstrumentContext, NoteRequest, Voice } from './types.ts'

/**
 * Drum kit and hand drums. A string plays one drum, chosen by its length the way its pitch would
 * be: a long string is a low drum (kick, dum), a short one a high one (hats, shaker). The drum
 * sounds are Music Maker's.
 */

export type DrumId =
  | 'kick'
  | 'tomL'
  | 'snare'
  | 'tomH'
  | 'clap'
  | 'rim'
  | 'ohat'
  | 'hat'
  | 'dum'
  | 'slap'
  | 'tak'
  | 'ka'
  | 'cowbell'
  | 'riq'
  | 'shaker'

export interface Drum {
  readonly id: DrumId
  readonly label: string
}

/** Low to high: longest string first. */
export const DRUM_KIT: readonly Drum[] = [
  { id: 'kick', label: 'Kick' },
  { id: 'tomL', label: 'Low tom' },
  { id: 'snare', label: 'Snare' },
  { id: 'tomH', label: 'High tom' },
  { id: 'clap', label: 'Clap' },
  { id: 'rim', label: 'Rim' },
  { id: 'ohat', label: 'Open hat' },
  { id: 'hat', label: 'Hat' },
]

export const HAND_DRUMS: readonly Drum[] = [
  { id: 'dum', label: 'Dum' },
  { id: 'slap', label: 'Slap' },
  { id: 'tak', label: 'Tak' },
  { id: 'ka', label: 'Ka' },
  { id: 'clap', label: 'Clap' },
  { id: 'cowbell', label: 'Cowbell' },
  { id: 'riq', label: 'Riq' },
  { id: 'shaker', label: 'Shaker' },
]

/**
 * Semitones above the base where the second drum starts, and the width of each drum's band. With
 * the stage diagonal at 1,469 units this gives roughly: kick for strings over 700 units long, then
 * a new drum every ~20% shorter, down to hats under 180.
 */
export const FIRST_STEP = 7.9
export const STEP = 3.9

/** Which drum (index into the kit) a string at this pitch plays. */
export function drumIndex(midi: number, base: number, count: number): number {
  return clamp(Math.floor((midi - base - FIRST_STEP) / STEP) + 1, 0, count - 1)
}

type Tone = (type: OscillatorType, f0: number, f1: number, sweep: number, dur: number, level: number) => void
type Noise = (type: BiquadFilterType, freq: number, q: number, dur: number, level: number, at?: number) => void

function hit(drum: DrumId, tone: Tone, noise: Noise, cowbell: () => void): number {
  switch (drum) {
    case 'kick':
      tone('sine', 155, 44, 0.11, 0.42, 1)
      noise('lowpass', 2500, 0.5, 0.012, 0.35)
      return 0.42
    case 'snare':
      noise('highpass', 1300, 0.6, 0.19, 0.6)
      tone('triangle', 200, 165, 0.05, 0.11, 0.45)
      return 0.19
    case 'hat':
      noise('highpass', 7800, 0.8, 0.045, 0.3)
      return 0.05
    case 'ohat':
      noise('highpass', 7200, 0.8, 0.3, 0.26)
      return 0.3
    case 'clap':
      noise('bandpass', 1500, 1.1, 0.02, 0.5)
      noise('bandpass', 1500, 1.1, 0.02, 0.5, 0.012)
      noise('bandpass', 1500, 1.1, 0.16, 0.55, 0.026)
      return 0.19
    case 'tomL':
      tone('sine', 135, 82, 0.2, 0.34, 0.85)
      return 0.34
    case 'tomH':
      tone('sine', 215, 140, 0.16, 0.28, 0.8)
      return 0.28
    case 'rim':
      tone('triangle', 1750, 1700, 0.01, 0.03, 0.4)
      noise('bandpass', 2400, 3, 0.02, 0.3)
      return 0.03
    case 'dum':
      tone('sine', 98, 58, 0.09, 0.3, 1)
      noise('lowpass', 900, 0.5, 0.02, 0.4)
      return 0.3
    case 'tak':
      noise('bandpass', 3300, 1.6, 0.04, 0.7)
      tone('sine', 790, 760, 0.02, 0.06, 0.22)
      return 0.06
    case 'riq':
      noise('highpass', 6200, 1.2, 0.06, 0.2)
      return 0.06
    case 'ka':
      noise('bandpass', 2300, 1.4, 0.035, 0.45)
      return 0.04
    case 'slap':
      noise('bandpass', 1700, 0.9, 0.07, 0.75)
      tone('sine', 420, 300, 0.03, 0.06, 0.3)
      return 0.07
    case 'shaker':
      noise('highpass', 5200, 0.9, 0.11, 0.2)
      return 0.11
    case 'cowbell':
      cowbell()
      return 0.3
  }
}

/** Plays one drum hit into `out`. Returns when it has died away (audio clock). */
export function playDrum(context: InstrumentContext, drum: DrumId, note: NoteRequest): number {
  const { ctx } = context
  const t = Math.max(note.when ?? ctx.currentTime, ctx.currentTime)
  const vel = clamp(note.velocity, 0.05, 1)
  const g = new StereoPannerNode(ctx, { pan: clamp(note.pan, -1, 1) })
  g.connect(context.out)
  const tone: Tone = (type, f0, f1, sweep, dur, level) => {
    const o = new OscillatorNode(ctx, { type, frequency: f0 })
    const og = new GainNode(ctx, { gain: 0 })
    env(o.frequency, t, [
      [0, f0],
      [sweep, f1, 'exp'],
    ])
    env(og.gain, t, [
      [0, level * vel],
      [dur, 0.0001, 'exp'],
    ])
    o.connect(og).connect(g)
    o.start(t)
    o.stop(t + dur + 0.05)
  }
  const noise: Noise = (type, frequency, Q, dur, level, at = 0) => {
    const s = new AudioBufferSourceNode(ctx, { buffer: context.noise, loop: true })
    const ng = new GainNode(ctx, { gain: 0 })
    env(ng.gain, t + at, [
      [0, level * vel],
      [dur, 0.0001, 'exp'],
    ])
    s.connect(new BiquadFilterNode(ctx, { type, frequency, Q })).connect(ng).connect(g)
    s.start(t + at, Math.random() * 1.5)
    s.stop(t + at + dur + 0.05)
  }
  const cowbell = (): void => {
    const bp = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 800, Q: 2.5 })
    const cg = new GainNode(ctx, { gain: 0 })
    env(cg.gain, t, [
      [0, 0.5 * vel],
      [0.28, 0.0001, 'exp'],
    ])
    for (const frequency of [540, 808]) {
      const o = new OscillatorNode(ctx, { type: 'square', frequency })
      o.connect(bp)
      o.start(t)
      o.stop(t + 0.35)
    }
    bp.connect(cg).connect(g)
  }
  const length = hit(drum, tone, noise, cowbell)
  const endsAt = t + length + 0.1
  // Let the hit finish, then free the panner (and everything feeding it).
  const done = new ConstantSourceNode(ctx, { offset: 0 })
  done.start(t)
  done.stop(endsAt)
  done.onended = () => {
    g.disconnect()
  }
  return endsAt
}

/** A drum hit can't be retuned, bent, or damped: it's over in a moment anyway. */
function hitVoice(endsAt: number): Voice {
  return { endsAt, setPitch: () => undefined, bend: () => undefined, release: () => undefined }
}

const FALLBACK: Drum = { id: 'kick', label: 'Kick' }

function createDrumInstrument(id: InstrumentId, kit: readonly Drum[]): Instrument {
  const base = baseMidi(id)
  const drumAt = (midi: number): Drum => kit[drumIndex(midi, base, kit.length)] ?? FALLBACK
  return {
    id,
    hold: 'roll',
    play: (context, note) => hitVoice(playDrum(context, drumAt(note.midi).id, note)),
    label: (midi) => drumAt(midi).label,
  }
}

export const drums: Instrument = createDrumInstrument('drums', DRUM_KIT)
export const handDrums: Instrument = createDrumInstrument('handdrums', HAND_DRUMS)
