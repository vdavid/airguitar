/**
 * 16-bit stereo PCM and WAV encoding. Recorded sound is kept as interleaved 16-bit chunks (half
 * the memory of floats: ten minutes at 48 kHz is about 110 MB), then written out as a WAV, or
 * split into channels for the MP3 encoder.
 */

const toInt16 = (v: number): number => Math.round(Math.max(-1, Math.min(1, v)) * 32767)

/** Interleaves two float channels (-1..1, clipped) into 16-bit L R L R … */
export function interleave16(left: Float32Array, right: Float32Array): Int16Array {
  const out = new Int16Array(left.length * 2)
  for (let i = 0; i < left.length; i++) {
    out[i * 2] = toInt16(left[i] ?? 0)
    out[i * 2 + 1] = toInt16(right[i] ?? left[i] ?? 0)
  }
  return out
}

/** Splits interleaved chunks back into two channels, for the MP3 encoder. */
export function deinterleave(chunks: readonly Int16Array[]): { left: Int16Array; right: Int16Array } {
  const frames = chunks.reduce((n, c) => n + c.length / 2, 0)
  const left = new Int16Array(frames)
  const right = new Int16Array(frames)
  let o = 0
  for (const c of chunks) {
    for (let i = 0; i < c.length; i += 2) {
      left[o] = c[i] ?? 0
      right[o] = c[i + 1] ?? 0
      o++
    }
  }
  return { left, right }
}

/** A 44-byte RIFF header for 16-bit stereo PCM. */
function wavHeader(view: DataView, frames: number, sampleRate: number): void {
  const bytes = frames * 4
  const str = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  str(0, 'RIFF')
  view.setUint32(4, 36 + bytes, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 2, true) // channels
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 4, true) // byte rate
  view.setUint16(32, 4, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  str(36, 'data')
  view.setUint32(40, bytes, true)
}

/** A WAV file from interleaved 16-bit stereo chunks. */
export function wavFromPcm16(chunks: readonly Int16Array[], sampleRate: number): Uint8Array<ArrayBuffer> {
  const samples = chunks.reduce((n, c) => n + c.length, 0)
  const buf = new ArrayBuffer(44 + samples * 2)
  wavHeader(new DataView(buf), samples / 2, sampleRate)
  const pcm = new Int16Array(buf, 44)
  let o = 0
  for (const c of chunks) {
    pcm.set(c, o)
    o += c.length
  }
  return new Uint8Array(buf)
}

/** A WAV file from two float channels (a rendered `AudioBuffer`), plus its peak level. */
export function wavFromChannels(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
): { bytes: Uint8Array<ArrayBuffer>; peak: number } {
  let peak = 0
  for (let i = 0; i < left.length; i++) peak = Math.max(peak, Math.abs(left[i] ?? 0), Math.abs(right[i] ?? 0))
  return { bytes: wavFromPcm16([interleave16(left, right)], sampleRate), peak: Math.min(1, peak) }
}
