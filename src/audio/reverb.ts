/**
 * A generated reverb impulse response (Music Maker's): lowpassed stereo noise with a power-curve
 * fade and a short fade-in. Returns one Float32Array per channel.
 */
export function makeImpulse(
  sampleRate: number,
  seconds = 2.3,
  rng: () => number = Math.random,
): Float32Array<ArrayBuffer>[] {
  const length = Math.max(1, Math.floor(sampleRate * seconds))
  return [0, 1].map(() => {
    const data = new Float32Array(length)
    let lp = 0
    for (let i = 0; i < length; i++) {
      const t = i / length
      lp += 0.35 * (rng() * 2 - 1 - lp)
      data[i] = lp * Math.pow(1 - t, 2.6) * (i < 400 ? i / 400 : 1)
    }
    return data
  })
}
