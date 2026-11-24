import { createSynthInstrument, env, type Recipe, type SynthNote } from './synth.ts'
import type { Instrument } from './types.ts'

/**
 * Bowed and blown: violin, cello, string section, flute, trumpet, choir (Music Maker's recipes).
 * They all sustain while a finger rests on the string; a plain pluck plays a short bowed or blown
 * note whose length suits the instrument.
 */

/** Vibrato that fades in after `delay` to `depth` cents, driving every oscillator's detune. */
function vibrato(n: SynthNote, rate: number, delay: number, rise: number, depth: number, dur: number): GainNode {
  const lg = new GainNode(n.ctx, { gain: 0 })
  env(lg.gain, n.t, [
    [0, 0],
    [delay, 0],
    [rise, depth],
  ])
  n.lfo(rate, dur).connect(lg)
  return lg
}

/** The swell: attack to `peak`, ease to `sustain` by the end of the hold, then fade out. */
function swell(n: SynthNote, attack: number, peak: number, sustain: number, hold: number, dur: number): GainNode {
  const g = new GainNode(n.ctx, { gain: 0 })
  env(g.gain, n.t, [
    [0, 0],
    [attack, peak * n.vel],
    [hold, sustain * n.vel],
    [dur, 0.0001, 'exp'],
  ])
  return g
}

/** Saws through body resonances, plus a little bow-hair noise. */
const bowed =
  (violin: boolean): Recipe =>
  (n) => {
    const { ctx, t, f, vel } = n
    const hold = n.hold(violin ? 0.6 : 0.7)
    const dur = hold + 0.24
    const g = swell(n, 0.07, 0.36, 0.3, hold, dur)
    const vib = vibrato(n, violin ? 5.8 : 5.1, 0.16, 0.4, violin ? 14 : 9, dur)
    const mix = new GainNode(ctx, { gain: 1 })
    for (const d of [0, 5]) {
      const o = n.osc('sawtooth', f, dur, d)
      vib.connect(o.detune)
      o.connect(mix)
    }
    let node: AudioNode = mix
    const body: readonly (readonly [number, number])[] = violin
      ? ([
          [520, 6],
          [1150, 4],
          [2900, 6],
        ] as const)
      : ([
          [230, 6],
          [600, 5],
          [1500, 4],
        ] as const)
    for (const [frequency, gain] of body) {
      node = node.connect(new BiquadFilterNode(ctx, { type: 'peaking', frequency, Q: 2.2, gain }))
    }
    node
      .connect(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: (violin ? 4800 : 2600) + 1500 * vel }))
      .connect(g)
    const bp = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: violin ? 3200 : 1800, Q: 0.7 })
    const ng = new GainNode(ctx, { gain: 0 })
    env(ng.gain, t, [
      [0, 0.05],
      [0.1, 0.012, 'exp'],
      [dur, 0.008],
    ])
    n.noise(dur).connect(bp).connect(ng).connect(g)
    g.connect(n.out)
    return dur
  }

/** Three detuned saws, a slow attack, and a long release: a string section. */
const section: Recipe = (n) => {
  const { ctx, f, vel } = n
  const hold = n.hold(0.95)
  const dur = hold + 0.8
  const g = swell(n, 0.09, 0.3, 0.24, hold, dur)
  const lp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 1100 + 2400 * vel, Q: 0.6 })
  const vib = vibrato(n, 5.3, 0.25, 0.6, 7, dur)
  for (const d of [-9, 0, 8]) {
    const o = n.osc('sawtooth', f, dur, d)
    vib.connect(o.detune)
    o.connect(lp)
  }
  lp.connect(g).connect(n.out)
  return dur
}

/** A sine with a soft octave, breath noise that puffs at the start, and late vibrato. */
const flute: Recipe = (n) => {
  const { ctx, t, f } = n
  const hold = n.hold(0.55)
  const dur = hold + 0.3
  const g = swell(n, 0.05, 0.5, 0.42, hold, dur)
  const vib = vibrato(n, 5, 0.18, 0.45, 9, dur)
  const o1 = n.osc('sine', f, dur)
  const o2 = n.osc('triangle', f * 2, dur)
  vib.connect(o1.detune)
  vib.connect(o2.detune)
  o1.connect(g)
  o2.connect(new GainNode(ctx, { gain: 0.13 })).connect(g)
  const bp = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: Math.min(9000, f * 2.2), Q: 1.6 })
  const ng = new GainNode(ctx, { gain: 0 })
  env(ng.gain, t, [
    [0, 0.5],
    [0.07, 0.1, 'exp'],
    [dur, 0.05],
  ])
  n.noise(dur).connect(bp).connect(ng).connect(g)
  g.connect(n.out)
  return dur
}

/** Saw + square through a brassy opening filter, with a lip scoop into the note. */
const trumpet: Recipe = (n) => {
  const { ctx, t, f, vel } = n
  const hold = n.hold(0.45)
  const dur = hold + 0.13
  const g = swell(n, 0.03, 0.4, 0.34, hold, dur)
  const lp = new BiquadFilterNode(ctx, { type: 'lowpass', Q: 1.4 })
  env(lp.frequency, t, [
    [0, f * 1.2],
    [0.05, Math.min(9000, f * (4 + 4 * vel))],
    [hold, Math.min(8000, f * 4)],
    [dur, f * 1.5],
  ])
  const vib = vibrato(n, 5.4, 0.22, 0.42, 8, dur)
  const o1 = n.osc('sawtooth', f, dur)
  const o2 = n.osc('square', f, dur)
  vib.connect(o1.detune)
  vib.connect(o2.detune)
  // The scoop rides on a gain into the detune, so retuning the note doesn't cancel it.
  const scoop = new ConstantSourceNode(ctx, { offset: 0 })
  env(scoop.offset, t, [
    [0, -35],
    [0.045, 0],
  ])
  scoop.connect(o1.detune)
  scoop.start(t)
  scoop.stop(t + 0.1)
  o1.connect(lp)
  o2.connect(new GainNode(ctx, { gain: 0.25 })).connect(lp)
  lp.connect(g).connect(n.out)
  return dur
}

/** Detuned saws and breath through "aah" formants. */
const voices: Recipe = (n) => {
  const { ctx, f } = n
  const hold = n.hold(0.9)
  const dur = hold + 0.75
  const g = swell(n, 0.14, 0.3, 0.26, hold, dur)
  const src = new GainNode(ctx, { gain: 1 })
  const vib = vibrato(n, 4.8, 0.3, 0.7, 8, dur)
  for (const d of [-9, 0, 9]) {
    const o = n.osc('sawtooth', f, dur, d)
    vib.connect(o.detune)
    o.connect(src)
  }
  n.noise(dur)
    .connect(new GainNode(ctx, { gain: 0.05 }))
    .connect(src)
  for (const [frequency, Q, level] of [
    [780, 7, 1],
    [1180, 8, 0.6],
    [2850, 9, 0.28],
  ] as const) {
    src
      .connect(new BiquadFilterNode(ctx, { type: 'bandpass', frequency, Q }))
      .connect(new GainNode(ctx, { gain: level }))
      .connect(g)
  }
  g.connect(n.out)
  return dur
}

export const violin: Instrument = createSynthInstrument('violin', {
  hold: 'sustain',
  range: { lo: 55, hi: 100 },
  recipe: bowed(true),
})
export const cello: Instrument = createSynthInstrument('cello', {
  hold: 'sustain',
  range: { lo: 36, hi: 81 },
  recipe: bowed(false),
})
export const strings: Instrument = createSynthInstrument('strings', {
  hold: 'sustain',
  range: { lo: 36, hi: 96 },
  recipe: section,
})
export const fluteInstrument: Instrument = createSynthInstrument('flute', {
  hold: 'sustain',
  range: { lo: 60, hi: 98 },
  recipe: flute,
})
export const trumpetInstrument: Instrument = createSynthInstrument('trumpet', {
  hold: 'sustain',
  range: { lo: 52, hi: 86 },
  recipe: trumpet,
})
export const voicesInstrument: Instrument = createSynthInstrument('voices', {
  hold: 'sustain',
  range: { lo: 43, hi: 81 },
  recipe: voices,
})
