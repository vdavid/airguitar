import { clamp } from '../geom.ts'
import type { InstrumentId } from './instruments/catalog.ts'
import { getInstrument } from './instruments/registry.ts'
import type { NoteRequest, Voice } from './instruments/types.ts'
import { createMixGraph, type MixGraph } from './graph.ts'

/**
 * The live audio: one `AudioContext` and its mix graph (see `graph.ts`). Browsers only start
 * audio after a user gesture, so `start()` runs from a click or key handler; until then `graph`
 * is null and `play` is silent.
 */
export class AudioEngine {
  private context: AudioContext | null = null
  private mix: MixGraph | null = null
  private volume = 0.9

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
    if (this.context.state !== 'running') void this.context.resume()
    return this.mix
  }

  /** Plays a note on an instrument. Returns null before `start()`. */
  play(instrument: InstrumentId, note: NoteRequest): Voice | null {
    const mix = this.mix
    if (!mix) return null
    return getInstrument(instrument).play({ ctx: mix.ctx, out: mix.instrumentBus(instrument), noise: mix.noise }, note)
  }

  setVolume(volume: number): void {
    this.volume = clamp(volume, 0, 1)
    if (this.mix) this.mix.master.gain.setTargetAtTime(this.volume, this.mix.ctx.currentTime, 0.02)
  }

  /**
   * The performance sweep: `dark` 0..1 lowers the lowpass, `thin` 0..1 raises the highpass, `echo`
   * 0..1 opens the echo send. `bpm` sets the echo time to a dotted eighth.
   */
  setSweep(dark: number, thin: number, echo: number, bpm = 100): void {
    const mix = this.mix
    if (!mix) return
    const t = mix.ctx.currentTime
    mix.lowpass.frequency.setTargetAtTime(20000 * Math.pow(0.018, clamp(dark, 0, 1)), t, 0.04)
    mix.highpass.frequency.setTargetAtTime(20 * Math.pow(90, clamp(thin, 0, 1)), t, 0.04)
    mix.echoSend.gain.setTargetAtTime(clamp(echo, 0, 1) * 0.75, t, 0.05)
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
