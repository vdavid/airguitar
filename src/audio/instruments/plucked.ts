import { midiToFreq } from '../../music/theory.ts'
import type { InstrumentId } from './catalog.ts'
import { renderKarplus, type KarplusParams } from './karplus.ts'
import type { Instrument, InstrumentContext, NoteRequest, Voice } from './types.ts'

/**
 * A Karplus–Strong instrument (guitar, and later harp, oud, qanun, sitar, bass, electric guitar).
 * Each note renders once per semitone and is cached per audio context; fractional pitches (the
 * "Free" tone) and retuning use the source's `detune`, so they cost nothing extra.
 */
export function createPluckedInstrument(id: InstrumentId, params: KarplusParams): Instrument {
  const caches = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>()

  const buffer = (ctx: BaseAudioContext, midi: number): AudioBuffer => {
    let cache = caches.get(ctx)
    if (!cache) {
      cache = new Map()
      caches.set(ctx, cache)
    }
    const hit = cache.get(midi)
    if (hit) return hit
    const data = renderKarplus(ctx.sampleRate, midiToFreq(midi), params)
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
    play(context: InstrumentContext, note: NoteRequest): Voice {
      const { ctx, out } = context
      const start = Math.max(note.when ?? ctx.currentTime, ctx.currentTime)
      const rendered = Math.round(note.midi)
      const src = new AudioBufferSourceNode(ctx, { buffer: buffer(ctx, rendered) })
      const gain = new GainNode(ctx, { gain: 0.25 + 0.75 * Math.min(1, Math.max(0, note.velocity)) })
      const pan = new StereoPannerNode(ctx, { pan: Math.min(1, Math.max(-1, note.pan)) })
      let pitch = note.midi
      let bendCents = 0
      src.detune.value = (pitch - rendered) * 100
      src.connect(gain).connect(pan).connect(out)
      src.start(start)
      const endsAt = start + (src.buffer?.duration ?? 0)
      src.onended = () => {
        pan.disconnect()
      }
      const retune = (glide: number): void => {
        src.detune.setTargetAtTime((pitch - rendered) * 100 + bendCents, ctx.currentTime, glide)
      }
      return {
        endsAt,
        setPitch(midi) {
          pitch = midi
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
          src.stop(t + 0.25)
        },
      }
    },
  }
}
