/**
 * Karplus–Strong plucked string, rendered once per note into a buffer (Music Maker's recipe).
 * Pure DSP with no Web Audio dependency, so it's unit-testable.
 *
 * A delay line one period long starts as filtered noise, comb-filtered by the pick position. Each
 * pass averages neighbours (high harmonics die first, which is what sounds like a string), runs an
 * allpass for the fractional part of the period (exact tuning), and decays to -60 dB in `t60`.
 */

export interface KarplusParams {
  /** Rendered length in seconds. */
  readonly duration: number
  /** 0..1 noise brightness: higher lets more highs into the pluck. */
  readonly brightness: number
  /** 0..1 pick position along the string; near the end is twangy, the middle is round. */
  readonly pick: number
  /** Seconds to fade 60 dB. */
  readonly t60: number
  /** Detuned doubled/tripled courses, in cents (oud, qanun). */
  readonly detune?: readonly number[]
  /** Sitar-style buzz: the bridge damps only one half of the swing. */
  readonly buzz?: boolean
}

export const GUITAR: KarplusParams = { duration: 2.6, brightness: 0.62, pick: 0.2, t60: 3.4 }

function renderString(
  out: Float32Array,
  sampleRate: number,
  freq: number,
  gain: number,
  p: KarplusParams,
  rng: () => number,
): void {
  const period = sampleRate / freq
  let n = Math.floor(period - 0.5)
  let frac = period - 0.5 - n
  if (frac < 0.1) {
    n -= 1
    frac += 1
  }
  if (n < 2) n = 2
  const c = (1 - frac) / (1 + frac)
  const line = new Float32Array(n)
  let lp = 0
  for (let i = 0; i < n; i++) {
    lp += p.brightness * (rng() * 2 - 1 - lp)
    line[i] = lp
  }
  const offset = Math.max(1, Math.round(p.pick * n))
  const excite = line.slice()
  let peak = 1e-6
  for (let i = 0; i < n; i++) {
    const v = (excite[i] ?? 0) - (excite[(i - offset + n) % n] ?? 0)
    line[i] = v
    peak = Math.max(peak, Math.abs(v))
  }
  for (let i = 0; i < n; i++) line[i] = (line[i] ?? 0) / peak
  const decay = Math.pow(0.001, 1 / (freq * p.t60))
  let idx = 0
  let prev = 0
  let apx = 0
  let apy = 0
  for (let i = 0; i < out.length; i++) {
    const x = line[idx] ?? 0
    const avg = p.buzz === true && x < 0 ? 0.9 * x + 0.1 * prev : 0.5 * (x + prev)
    prev = x
    const y = c * avg + apx - c * apy
    apx = avg
    apy = y
    line[idx] = y * decay
    out[i] = (out[i] ?? 0) + x * gain
    if (++idx >= n) idx = 0
  }
}

/** Renders one note, normalized to 0.85 peak with a 50 ms fade at the end. */
export function renderKarplus(
  sampleRate: number,
  freq: number,
  p: KarplusParams,
  rng: () => number = Math.random,
): Float32Array<ArrayBuffer> {
  const length = Math.floor(sampleRate * p.duration)
  const data = new Float32Array(length)
  if (p.detune && p.detune.length > 0) {
    for (const cents of p.detune) {
      renderString(data, sampleRate, freq * Math.pow(2, cents / 1200), 1 / p.detune.length + 0.1, p, rng)
    }
  } else renderString(data, sampleRate, freq, 1, p, rng)
  let peak = 1e-6
  for (const v of data) peak = Math.max(peak, Math.abs(v))
  const fade = Math.floor(sampleRate * 0.05)
  for (let i = 0; i < length; i++) {
    let g = 0.85 / peak
    if (i > length - fade) g *= (length - i) / fade
    data[i] = (data[i] ?? 0) * g
  }
  return data
}
