import { clamp } from '../../geom.ts'
import { midiToFreq } from '../../music/theory.ts'
import type { InstrumentId } from './catalog.ts'
import { BASS, ELECTRIC, GUITAR, HARP, OUD, QANUN, renderKarplus, SITAR, type KarplusParams } from './karplus.ts'
import { fitRange, type Range } from './range.ts'
import type { HoldStyle, Instrument } from './types.ts'

/**
 * Karplus–Strong instruments: guitar, electric guitar, harp, oud, qanun, sitar, bass. Each note
 * renders once per semitone and is cached per audio context; fractional pitches (the "Free" tone)
 * and retuning use the source's `detune`, so they cost nothing extra.
 */

export interface PluckedSpec {
  readonly params: KarplusParams
  readonly range: Range
  readonly hold: HoldStyle
  /** Adds a short sine at the fundamental under the pluck, for weight (the bass). */
  readonly sine?: boolean
}

export function createPluckedInstrument(id: InstrumentId, spec: PluckedSpec): Instrument {
  const caches = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>()

  const buffer = (ctx: BaseAudioContext, midi: number): AudioBuffer => {
    let cache = caches.get(ctx)
    if (!cache) {
      cache = new Map()
      caches.set(ctx, cache)
    }
    const hit = cache.get(midi)
    if (hit) return hit
    const data = renderKarplus(ctx.sampleRate, midiToFreq(midi), spec.params)
    const buf = ctx.createBuffer(1, data.length, ctx.sampleRate)
    buf.copyToChannel(data, 0)
    if (cache.size > 120) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(midi, buf)
    return buf
  }

  return {
    id,
    hold: spec.hold,
    play(context, note) {
      const { ctx, out } = context
      const start = Math.max(note.when ?? ctx.currentTime, ctx.currentTime)
      const vel = clamp(note.velocity, 0, 1)
      const rendered = Math.round(fitRange(note.midi, spec.range))
      const src = new AudioBufferSourceNode(ctx, { buffer: buffer(ctx, rendered) })
      const gain = new GainNode(ctx, { gain: 0.25 + 0.75 * vel })
      const pan = new StereoPannerNode(ctx, { pan: clamp(note.pan, -1, 1) })
      const detunes = [src.detune]
      src.connect(gain).connect(pan).connect(out)
      src.start(start)
      const endsAt = start + (src.buffer?.duration ?? 0)
      const sources: AudioScheduledSourceNode[] = [src]
      if (spec.sine === true) {
        const o = new OscillatorNode(ctx, { type: 'sine', frequency: midiToFreq(rendered) })
        const og = new GainNode(ctx, { gain: 0 })
        og.gain.setValueAtTime(0, start)
        og.gain.linearRampToValueAtTime(0.5 * vel, start + 0.01)
        og.gain.exponentialRampToValueAtTime(0.0001, start + 0.9)
        o.connect(og).connect(gain)
        o.start(start)
        o.stop(start + 0.95)
        detunes.push(o.detune)
        sources.push(o)
      }
      src.onended = () => {
        pan.disconnect()
      }
      let pitch = fitRange(note.midi, spec.range)
      let bendCents = 0
      const retune = (glide: number): void => {
        const now = ctx.currentTime
        for (const d of detunes) d.setTargetAtTime((pitch - rendered) * 100 + bendCents, now, glide)
      }
      for (const d of detunes) d.value = (pitch - rendered) * 100
      return {
        endsAt,
        setPitch(midi) {
          pitch = fitRange(midi, spec.range)
          retune(0.02)
        },
        bend(cents) {
          bendCents = cents
          retune(0.025)
        },
        release() {
          const t = ctx.currentTime
          if (t >= endsAt) return
          gain.gain.setTargetAtTime(0, t, 0.03)
          for (const s of sources) {
            try {
              s.stop(t + 0.25)
            } catch {
              // Already stopped: nothing to do.
            }
          }
        },
      }
    },
  }
}

export const guitar: Instrument = createPluckedInstrument('guitar', {
  params: GUITAR,
  range: { lo: 40, hi: 88 },
  hold: 'once',
})
export const electricGuitar: Instrument = createPluckedInstrument('egtr', {
  params: ELECTRIC,
  range: { lo: 40, hi: 88 },
  hold: 'once',
})
export const harp: Instrument = createPluckedInstrument('harp', {
  params: HARP,
  range: { lo: 36, hi: 96 },
  hold: 'once',
})
export const oud: Instrument = createPluckedInstrument('oud', {
  params: OUD,
  range: { lo: 40, hi: 84 },
  hold: 'roll',
})
export const qanun: Instrument = createPluckedInstrument('qanun', {
  params: QANUN,
  range: { lo: 48, hi: 91 },
  hold: 'roll',
})
export const sitar: Instrument = createPluckedInstrument('sitar', {
  params: SITAR,
  range: { lo: 40, hi: 84 },
  hold: 'once',
})
export const bass: Instrument = createPluckedInstrument('bass', {
  params: BASS,
  range: { lo: 24, hi: 60 },
  hold: 'once',
  sine: true,
})
