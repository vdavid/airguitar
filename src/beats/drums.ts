import type { DrumName } from './patterns.ts'

/**
 * The beat's drum kit, synthesized (Music Maker's recipes): sine sweeps for kicks and toms,
 * filtered noise for snares, hats, and claps. Works on a live or an offline context.
 */
export interface DrumTarget {
  readonly ctx: BaseAudioContext
  /** Where the hit goes (the drums' instrument bus on the beats bus). */
  readonly out: AudioNode
  /** White noise (the mix graph's two-second buffer). */
  readonly noise: AudioBuffer
}

export function playDrum(target: DrumTarget, name: DrumName, when: number, velocity: number): void {
  const { ctx, noise } = target
  const t = Math.max(when, ctx.currentTime)
  const vel = Math.min(1, Math.max(0.05, velocity))
  const bus = new GainNode(ctx)
  bus.connect(target.out)

  const tone = (type: OscillatorType, f0: number, f1: number, sweep: number, dur: number, level: number): void => {
    const osc = new OscillatorNode(ctx, { type, frequency: f0 })
    const g = new GainNode(ctx, { gain: 0 })
    osc.frequency.setValueAtTime(f0, t)
    osc.frequency.exponentialRampToValueAtTime(f1, t + sweep)
    g.gain.setValueAtTime(level * vel, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g).connect(bus)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }
  const hiss = (type: BiquadFilterType, freq: number, q: number, dur: number, level: number, at = 0): void => {
    const start = t + at
    const src = new AudioBufferSourceNode(ctx, { buffer: noise })
    const f = new BiquadFilterNode(ctx, { type, frequency: freq, Q: q })
    const g = new GainNode(ctx, { gain: 0 })
    g.gain.setValueAtTime(level * vel, start)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    src.connect(f).connect(g).connect(bus)
    // A random spot in the noise, so repeated hits don't sound identical.
    src.start(start, Math.random() * Math.max(0, noise.duration - dur - 0.05))
    src.stop(start + dur + 0.02)
  }

  switch (name) {
    case 'kick':
      tone('sine', 155, 44, 0.11, 0.42, 1)
      hiss('lowpass', 2500, 0.5, 0.012, 0.35)
      break
    case 'snare':
      hiss('highpass', 1300, 0.6, 0.19, 0.6)
      tone('triangle', 200, 165, 0.05, 0.11, 0.45)
      break
    case 'hat':
      hiss('highpass', 7800, 0.8, 0.045, 0.3)
      break
    case 'ohat':
      hiss('highpass', 7200, 0.8, 0.3, 0.26)
      break
    case 'clap':
      hiss('bandpass', 1500, 1.1, 0.02, 0.5)
      hiss('bandpass', 1500, 1.1, 0.02, 0.5, 0.012)
      hiss('bandpass', 1500, 1.1, 0.16, 0.55, 0.026)
      break
    case 'dum':
      tone('sine', 98, 58, 0.09, 0.3, 1)
      hiss('lowpass', 900, 0.5, 0.02, 0.4)
      break
    case 'tak':
      hiss('bandpass', 3300, 1.6, 0.04, 0.7)
      tone('sine', 790, 760, 0.02, 0.06, 0.22)
      break
    case 'riq':
      hiss('highpass', 6200, 1.2, 0.06, 0.2)
      break
    case 'tick':
      tone('triangle', 1500, 1480, 0.01, 0.04, 0.5)
      break
  }
}
