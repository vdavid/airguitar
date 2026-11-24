import { createSynthInstrument, env, type Recipe } from './synth.ts'
import type { Instrument } from './types.ts'

/** Synth lead and 808 bass (Music Maker's recipes). */

/** Saw + detuned square through a resonant lowpass that snaps shut. Sustains while held. */
const lead: Recipe = (n) => {
  const { ctx, t, f, vel } = n
  const hold = n.hold(0.35)
  const dur = hold + 0.14
  const g = new GainNode(ctx, { gain: 0 })
  const lp = new BiquadFilterNode(ctx, { type: 'lowpass', Q: 7 })
  env(lp.frequency, t, [
    [0, Math.min(12000, f * (5 + 7 * vel))],
    [0.22, Math.min(9000, f * 2.2), 'exp'],
  ])
  env(g.gain, t, [
    [0, 0],
    [0.005, 0.42 * vel],
    [0.14, 0.28 * vel, 'exp'],
    [Math.max(hold, 0.15), 0.25 * vel],
    [dur, 0.0001, 'exp'],
  ])
  n.osc('sawtooth', f, dur).connect(lp)
  n.osc('square', f, dur, 9)
    .connect(new GainNode(ctx, { gain: 0.5 }))
    .connect(lp)
  lp.connect(g).connect(n.out)
  return dur
}

/** A sine that drops into the note, through a soft clipper: the trap 808. */
const sub: Recipe = (n) => {
  const { ctx, t, f, vel } = n
  const dur = 0.9
  const g = new GainNode(ctx, { gain: 0 })
  env(g.gain, t, [
    [0, 0],
    [0.008, 0.9 * vel],
    [dur, 0.0001, 'exp'],
  ])
  const o = n.osc('sine', f, dur)
  env(o.frequency, t, [
    [0, f * 2.2],
    [0.05, f, 'exp'],
  ])
  const curve = new Float32Array(257)
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / 128 - 1) * 2.2)
  o.connect(new WaveShaperNode(ctx, { curve })).connect(g).connect(n.out)
  return dur
}

export const synth: Instrument = createSynthInstrument('synth', {
  hold: 'sustain',
  range: { lo: 36, hi: 96 },
  recipe: lead,
})
export const subBass: Instrument = createSynthInstrument('sub', {
  hold: 'once',
  range: { lo: 24, hi: 55 },
  recipe: sub,
})
