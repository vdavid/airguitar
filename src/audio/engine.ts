import { clamp } from '../geom.ts'
import type { InstrumentId } from './instruments/catalog.ts'
import { getInstrument } from './instruments/registry.ts'
import type { NoteRequest, Voice } from './instruments/types.ts'
import { createMixGraph, type MixGraph } from './graph.ts'
import { VoicePool } from './voices.ts'

/** Most string voices sounding at once; past it the oldest is stolen (`voices.ts`). */
export const MAX_VOICES = 48

/**
 * The live audio: one `AudioContext` and its mix graph (see `graph.ts`). Browsers only start
 * audio after a user gesture, so `start()` runs from a click or key handler; until then `graph`
 * is null and `play` is silent.
 */
export class AudioEngine {
  private context: AudioContext | null = null
  private mix: MixGraph | null = null
  private volume = 0.9
  private color = { brightness: 1, echo: 0, bpm: 100 }
  private readonly voices = new VoicePool(MAX_VOICES)

  /** The live graph, once started. Beats and recording connect here (`beats`, `output`). */
  get graph(): MixGraph | null {
    return this.mix
  }

  get ctx(): AudioContext | null {
    return this.context
  }

  /** Creates (or resumes) the audio context. Call from a user gesture. Safe to call often. */
  start(): MixGraph {
    if (this.context && this.mix) {
      if (this.context.state !== 'running') void this.context.resume()
      return this.mix
    }
    this.context = new AudioContext({ latencyHint: 'interactive' })
    this.mix = createMixGraph(this.context, { volume: this.volume })
    this.applyColor()
    if (this.context.state !== 'running') void this.context.resume()
    return this.mix
  }

  /** Plays a note on an instrument (counted against `MAX_VOICES`). Returns null before `start()`. */
  play(instrument: InstrumentId, note: NoteRequest): Voice | null {
    const mix = this.mix
    if (!mix) return null
    const voice = getInstrument(instrument).play(
      { ctx: mix.ctx, out: mix.instrumentBus(instrument), noise: mix.noise },
      note,
    )
    return this.voices.add(voice, mix.ctx.currentTime)
  }

  setVolume(volume: number): void {
    this.volume = clamp(volume, 0, 1)
    if (this.mix) this.mix.master.gain.setTargetAtTime(this.volume, this.mix.ctx.currentTime, 0.02)
  }

  /**
   * The top bar's sound color: `brightness` 0..1 opens the lowpass (1 = fully open), `echo` 0..1
   * opens the echo send, and `bpm` sets the echo time to a dotted eighth. Kept until `start()` too.
   */
  setColor(brightness: number, echo: number, bpm: number): void {
    this.color = { brightness: clamp(brightness, 0, 1), echo: clamp(echo, 0, 1), bpm }
    this.applyColor()
  }

  private applyColor(): void {
    const mix = this.mix
    if (!mix) return
    const { brightness, echo, bpm } = this.color
    const t = mix.ctx.currentTime
    mix.lowpass.frequency.setTargetAtTime(20000 * Math.pow(0.018, 1 - brightness), t, 0.04)
    mix.echoSend.gain.setTargetAtTime(echo * 0.75, t, 0.05)
    mix.echoDelay.delayTime.setTargetAtTime(clamp((60 / bpm) * 0.75, 0.1, 1.5), t, 0.1)
  }

  /** A short falling "zip": the cue for a deleted string. */
  zip(pan = 0): void {
    const mix = this.mix
    if (!mix) return
    const { ctx } = mix
    const t = ctx.currentTime
    const osc = new OscillatorNode(ctx, { type: 'triangle', frequency: 900 })
    const gain = new GainNode(ctx, { gain: 0 })
    osc.frequency.setValueAtTime(900, t)
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.18)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.22, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
    osc
      .connect(gain)
      .connect(new StereoPannerNode(ctx, { pan: clamp(pan, -1, 1) }))
      .connect(mix.instruments)
    osc.start(t)
    osc.stop(t + 0.22)
  }
}
