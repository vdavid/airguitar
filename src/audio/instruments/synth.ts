import { clamp } from '../../geom.ts'
import { midiToFreq } from '../../music/theory.ts'
import type { InstrumentId } from './catalog.ts'
import { fitRange, type Range } from './range.ts'
import type { HoldStyle, Instrument, InstrumentContext, NoteRequest, Voice } from './types.ts'

/**
 * The plumbing for oscillator-built instruments (Music Maker's `buildVoice` recipes): a recipe
 * wires oscillators, noise, filters, and envelopes for one note, and this turns it into a `Voice`
 * that can be retuned, bent, held, and released.
 *
 * Every pitched oscillator a recipe makes through `osc()` follows `setPitch` and `bend` via its
 * `detune`; LFOs and noise don't. The voice ends in a gate (for release) and a stereo panner.
 */

/** One envelope breakpoint: seconds after the note starts, value, and how to get there. */
export type EnvPoint = readonly [dt: number, value: number, curve?: 'exp']

/** Schedules an envelope on `param`, starting at `t`. */
export function env(param: AudioParam, t: number, pts: readonly EnvPoint[]): void {
  const first = pts[0]
  if (!first) return
  param.cancelScheduledValues(t)
  param.setValueAtTime(first[1], t + first[0])
  for (const [dt, v, curve] of pts.slice(1)) {
    if (curve === 'exp') param.exponentialRampToValueAtTime(Math.max(v, 1e-4), t + dt)
    else param.linearRampToValueAtTime(v, t + dt)
  }
}

/** A sustained note held by a resting finger plays at most this long. */
export const HELD_MAX = 45

export interface Waves {
  readonly piano: PeriodicWave
  readonly keys: PeriodicWave
  /** Drawbars, on a wave an octave below the note. */
  readonly organ: PeriodicWave
}

const waveCache = new WeakMap<BaseAudioContext, Waves>()

function waves(ctx: BaseAudioContext): Waves {
  const hit = waveCache.get(ctx)
  if (hit) return hit
  const wave = (a: readonly number[]): PeriodicWave =>
    ctx.createPeriodicWave(new Float32Array(a.length), new Float32Array(a))
  const w: Waves = {
    piano: wave([0, 1, 0.52, 0.3, 0.19, 0.12, 0.085, 0.06, 0.04, 0.03, 0.02, 0.014]),
    keys: wave([0, 1, 0.3, 0.1, 0.16, 0.03, 0.05]),
    organ: wave([0, 0.22, 0.9, 0, 0.55, 0, 0.3, 0, 0.2]),
  }
  waveCache.set(ctx, w)
  return w
}

/** What a recipe gets to build one note with. */
export interface SynthNote {
  readonly ctx: BaseAudioContext
  /** Start time on the audio clock. */
  readonly t: number
  /** Fundamental in Hz. */
  readonly f: number
  readonly midi: number
  /** 0.05..1 */
  readonly vel: number
  /** Connect the note's sound here. */
  readonly out: AudioNode
  readonly waves: Waves
  /** How long a sustaining note holds before its release: `base` seconds, or until `release()` when held. */
  hold(base: number): number
  /** A pitched oscillator (follows retuning and bends), running from `t` for `dur` seconds. */
  osc(type: OscillatorType | PeriodicWave, freq: number, dur: number, detune?: number): OscillatorNode
  /** An unpitched oscillator, for vibrato and tremolo. */
  lfo(freq: number, dur: number): OscillatorNode
  /** Looping white noise, from `t + at` for `dur` seconds. */
  noise(dur: number, at?: number): AudioBufferSourceNode
}

/** Builds one note and returns how long it lasts (seconds after `t`), release tail included. */
export type Recipe = (n: SynthNote) => number

export interface SynthSpec {
  readonly hold: HoldStyle
  readonly range: Range
  readonly recipe: Recipe
}

export function createSynthInstrument(id: InstrumentId, spec: SynthSpec): Instrument {
  return {
    id,
    hold: spec.hold,
    range: spec.range,
    play: (context, note) => playSynth(context, note, spec),
  }
}

interface Pitched {
  readonly param: AudioParam
  readonly base: number
}

function playSynth(context: InstrumentContext, note: NoteRequest, spec: SynthSpec): Voice {
  const { ctx } = context
  const t = Math.max(note.when ?? ctx.currentTime, ctx.currentTime)
  const rendered = Math.round(fitRange(note.midi, spec.range))
  const held = note.held === true
  const gate = new GainNode(ctx, { gain: 1 })
  const pan = new StereoPannerNode(ctx, { pan: clamp(note.pan, -1, 1) })
  gate.connect(pan).connect(context.out)

  const sources: AudioScheduledSourceNode[] = []
  const pitched: Pitched[] = []
  const start = (node: AudioScheduledSourceNode, at: number, dur: number): void => {
    node.start(at)
    node.stop(at + dur + 0.05)
    sources.push(node)
  }
  const n: SynthNote = {
    ctx,
    t,
    f: midiToFreq(rendered),
    midi: rendered,
    vel: clamp(note.velocity, 0.05, 1),
    out: gate,
    waves: waves(ctx),
    hold: (base) => (held ? HELD_MAX : base),
    osc(type, freq, dur, detune = 0) {
      const o = new OscillatorNode(ctx, { frequency: freq, detune })
      if (type instanceof PeriodicWave) o.setPeriodicWave(type)
      else o.type = type
      start(o, t, dur)
      pitched.push({ param: o.detune, base: detune })
      return o
    },
    lfo(freq, dur) {
      const o = new OscillatorNode(ctx, { type: 'sine', frequency: freq })
      start(o, t, dur)
      return o
    },
    noise(dur, at = 0) {
      const s = new AudioBufferSourceNode(ctx, { buffer: context.noise, loop: true })
      s.start(t + at, Math.random() * 1.5)
      s.stop(t + at + dur + 0.05)
      sources.push(s)
      return s
    },
  }
  const length = spec.recipe(n)
  const endsAt = t + length + 0.05

  let left = sources.length
  for (const s of sources) {
    s.onended = () => {
      if (--left === 0) pan.disconnect()
    }
  }

  // The note's offset from what was rendered, in cents: retuning plus the bend.
  let pitch = fitRange(note.midi, spec.range) - rendered
  let bendCents = 0
  const retune = (glide: number): void => {
    const now = ctx.currentTime
    if (now >= endsAt) return
    for (const p of pitched) {
      p.param.cancelScheduledValues(now)
      p.param.setTargetAtTime(p.base + pitch * 100 + bendCents, now, glide)
    }
  }
  if (pitch !== 0) retune(0.001)

  return {
    endsAt,
    setPitch(midi) {
      pitch = fitRange(midi, spec.range) - rendered
      retune(0.02)
    },
    bend(cents) {
      bendCents = cents
      retune(0.025)
    },
    release() {
      const now = ctx.currentTime
      if (now >= endsAt) return
      gate.gain.cancelScheduledValues(now)
      gate.gain.setTargetAtTime(0, now, 0.07)
      for (const s of sources) {
        try {
          s.stop(now + 0.6)
        } catch {
          // Already stopped: nothing to do.
        }
      }
    },
  }
}
