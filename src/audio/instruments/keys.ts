import { clamp } from '../../geom.ts'
import { createSynthInstrument, env, type Recipe } from './synth.ts'
import type { Instrument } from './types.ts'

/** Keyboards: piano, electric piano, organ (Music Maker's recipes). */

/** Two slightly detuned additive tones through a closing lowpass; the piano adds a hammer thump. */
const keyboard =
  (hammer: boolean): Recipe =>
  (n) => {
    const { ctx, t, f, vel, midi } = n
    const dur = clamp(3.2 - (midi - 36) * 0.03, 1.2, 3.2) * n.length
    const g = new GainNode(ctx, { gain: 0 })
    const lp = new BiquadFilterNode(ctx, { type: 'lowpass', Q: 0.4 })
    env(lp.frequency, t, [
      [0, Math.min(11000, f * 5 + 2500 * vel + 600)],
      [dur * 0.6, Math.max(500, f * 1.6), 'exp'],
    ])
    env(g.gain, t, [
      [0, 0],
      [0.005, 0.55 * vel],
      [0.12, 0.3 * vel, 'exp'],
      [dur, 0.0001, 'exp'],
    ])
    const wave = hammer ? n.waves.piano : n.waves.keys
    const g2 = new GainNode(ctx, { gain: 0.6 })
    n.osc(wave, f, dur).connect(lp)
    n.osc(wave, f, dur, 3).connect(g2).connect(lp)
    lp.connect(g).connect(n.out)
    if (hammer) {
      const bp = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 2600, Q: 0.8 })
      const ng = new GainNode(ctx, { gain: 0 })
      env(ng.gain, t, [
        [0, 0.18 * vel],
        [0.035, 0.0001, 'exp'],
      ])
      n.noise(0.04).connect(bp).connect(ng).connect(n.out)
    }
    return dur
  }

/** Drawbars an octave below, with a gentle tremolo. Sustains while held. */
const organ: Recipe = (n) => {
  const { ctx, t, f, vel } = n
  const hold = n.hold(0.6)
  const dur = hold + 0.14
  const g = new GainNode(ctx, { gain: 0 })
  const trem = new GainNode(ctx, { gain: 0.88 })
  env(g.gain, t, [
    [0, 0],
    [0.012, 0.5 * vel],
    [hold, 0.5 * vel],
    [dur, 0.0001, 'exp'],
  ])
  n.lfo(6.2, dur)
    .connect(new GainNode(ctx, { gain: 0.12 }))
    .connect(trem.gain)
  n.osc(n.waves.organ, f / 2, dur)
    .connect(trem)
    .connect(g)
    .connect(n.out)
  return dur
}

export const piano: Instrument = createSynthInstrument('piano', {
  hold: 'once',
  range: { lo: 28, hi: 100 },
  recipe: keyboard(true),
})
export const epiano: Instrument = createSynthInstrument('epiano', {
  hold: 'once',
  range: { lo: 33, hi: 96 },
  recipe: keyboard(false),
})
export const organInstrument: Instrument = createSynthInstrument('organ', {
  hold: 'sustain',
  range: { lo: 36, hi: 96 },
  recipe: organ,
})
