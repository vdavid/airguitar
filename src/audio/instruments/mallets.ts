import { createSynthInstrument, env, type Recipe, type SynthNote } from './synth.ts'
import type { Instrument } from './types.ts'

/** Struck tones: marimba, kalimba, steel pan, bells (Music Maker's recipes). */

/** Sine partials, each with its own fast-attack exponential decay. */
const partials =
  (parts: readonly (readonly [mult: number, level: number, decay: number])[]): Recipe =>
  (n) => {
    const { ctx, t, f, vel } = n
    let longest = 0
    for (const [mult, level, decay] of parts) {
      // Partials above what the ear (and the sample rate) can use only alias.
      if (f * mult > 16000) continue
      const pg = new GainNode(ctx, { gain: 0 })
      env(pg.gain, t, [
        [0, 0],
        [0.002, level * vel],
        [decay, 0.0001, 'exp'],
      ])
      n.osc('sine', f * mult, decay)
        .connect(pg)
        .connect(n.out)
      longest = Math.max(longest, decay)
    }
    return longest
  }

/** A two-operator FM tone with a fading index, plus an inharmonic partial. */
function fmBell(
  n: SynthNote,
  o: {
    dur: number
    ratio: number
    index: readonly [start: number, end: number, time: number]
    partial: readonly [mult: number, level: number, decay: number]
    body?: number
    /** The strike starts this much sharp and settles in 50 ms (a steel pan). */
    strike?: number
  },
): number {
  const { ctx, t, f, vel } = n
  const g = new GainNode(ctx, { gain: 0 })
  const pts: [number, number, 'exp'?][] = [
    [0, 0],
    [0.003, 0.5 * vel],
  ]
  if (o.body !== undefined) pts.push([0.2, o.body * vel, 'exp'])
  pts.push([o.dur, 0.0001, 'exp'])
  env(g.gain, t, pts)
  const car = n.osc('sine', f, o.dur)
  if (o.strike !== undefined) {
    env(car.frequency, t, [
      [0, f * o.strike],
      [0.05, f, 'exp'],
    ])
  }
  const mg = new GainNode(ctx, { gain: 0 })
  env(mg.gain, t, [
    [0, f * o.index[0]],
    [o.index[2], f * o.index[1], 'exp'],
  ])
  n.osc('sine', f * o.ratio, o.dur)
    .connect(mg)
    .connect(car.frequency)
  car.connect(g)
  const [mult, level, decay] = o.partial
  const pg = new GainNode(ctx, { gain: 0 })
  env(pg.gain, t, [
    [0, level * vel],
    [decay, 0.0001, 'exp'],
  ])
  n.osc('sine', f * mult, decay)
    .connect(pg)
    .connect(g)
  g.connect(n.out)
  return o.dur
}

export const marimba: Instrument = createSynthInstrument('marimba', {
  hold: 'roll',
  range: { lo: 45, hi: 96 },
  recipe: partials([
    [1, 0.6, 0.9],
    [4, 0.22, 0.14],
    [10, 0.07, 0.04],
  ]),
})

export const kalimba: Instrument = createSynthInstrument('kalimba', {
  hold: 'once',
  range: { lo: 52, hi: 96 },
  recipe: partials([
    [1, 0.6, 1.7],
    [2, 0.08, 0.5],
    [5.4, 0.16, 0.09],
    [8.9, 0.05, 0.04],
  ]),
})

export const steelpan: Instrument = createSynthInstrument('steelpan', {
  hold: 'roll',
  range: { lo: 52, hi: 93 },
  recipe: (n) =>
    fmBell(n, {
      dur: 1.5,
      ratio: 2,
      index: [1.4 + 1.6 * n.vel, 0.18, 0.3],
      partial: [2.005, 0.2, 0.7],
      body: 0.26,
      strike: 1.012,
    }),
})

export const bells: Instrument = createSynthInstrument('bells', {
  hold: 'once',
  range: { lo: 60, hi: 98 },
  recipe: (n) =>
    fmBell(n, {
      dur: 2.8,
      ratio: 3.51,
      index: [1.2 + 2 * n.vel, 0.15, 1.1],
      partial: [2.76, 0.16, 0.8],
    }),
})
