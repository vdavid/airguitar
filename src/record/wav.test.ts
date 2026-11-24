import { describe, expect, it } from 'vitest'
import { deinterleave, interleave16, wavFromChannels, wavFromPcm16 } from './wav.ts'
import { crc32, zipParts } from './zip.ts'

const ascii = (b: Uint8Array, from: number, len: number): string => String.fromCharCode(...b.subarray(from, from + len))

describe('16-bit PCM', () => {
  it('interleaves and clips', () => {
    const out = interleave16(new Float32Array([0, 1, -2]), new Float32Array([0.5, -1, 2]))
    expect([...out]).toEqual([0, 16384, 32767, -32767, -32767, 32767])
  })

  it('round-trips through deinterleave across chunks', () => {
    const a = new Int16Array([1, 2, 3, 4])
    const b = new Int16Array([5, 6])
    const { left, right } = deinterleave([a, b])
    expect([...left]).toEqual([1, 3, 5])
    expect([...right]).toEqual([2, 4, 6])
  })
})

describe('WAV', () => {
  it('writes a valid 16-bit stereo header', () => {
    const bytes = wavFromPcm16([new Int16Array([1, 2, 3, 4]), new Int16Array([5, 6])], 48000)
    const v = new DataView(bytes.buffer)
    expect(bytes.length).toBe(44 + 12)
    expect(ascii(bytes, 0, 4)).toBe('RIFF')
    expect(v.getUint32(4, true)).toBe(36 + 12)
    expect(ascii(bytes, 8, 8)).toBe('WAVEfmt ')
    expect(v.getUint16(20, true)).toBe(1)
    expect(v.getUint16(22, true)).toBe(2)
    expect(v.getUint32(24, true)).toBe(48000)
    expect(v.getUint32(28, true)).toBe(192000)
    expect(v.getUint16(32, true)).toBe(4)
    expect(v.getUint16(34, true)).toBe(16)
    expect(ascii(bytes, 36, 4)).toBe('data')
    expect(v.getUint32(40, true)).toBe(12)
    expect(v.getInt16(44 + 10, true)).toBe(6)
  })

  it('encodes float channels and reports the peak', () => {
    const { bytes, peak } = wavFromChannels(new Float32Array([0.25, -0.5]), new Float32Array([0, 0.1]), 44100)
    expect(bytes.length).toBe(44 + 8)
    expect(peak).toBeCloseTo(0.5)
    expect(new DataView(bytes.buffer).getInt16(44 + 4, true)).toBe(-16383)
  })
})

describe('zip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  it('stores files with matching local and central records', () => {
    const files = [
      { name: 'a.txt', bytes: new TextEncoder().encode('hello') },
      { name: 'b ü.wav', bytes: new Uint8Array([1, 2, 3]) },
    ]
    const parts = zipParts(files, new Date(2026, 10, 24, 12, 30))
    const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
    let o = 0
    for (const p of parts) {
      all.set(p, o)
      o += p.length
    }
    const v = new DataView(all.buffer)
    expect(v.getUint32(0, true)).toBe(0x04034b50)
    expect(ascii(all, 30, 5)).toBe('a.txt')
    expect(ascii(all, 35, 5)).toBe('hello')
    // End of central directory: two entries, and it points at the central directory.
    const end = all.length - 22
    expect(v.getUint32(end, true)).toBe(0x06054b50)
    expect(v.getUint16(end + 10, true)).toBe(2)
    const cdOffset = v.getUint32(end + 16, true)
    expect(v.getUint32(cdOffset, true)).toBe(0x02014b50)
    expect(v.getUint32(cdOffset + 16, true)).toBe(crc32(new TextEncoder().encode('hello')))
    // The second file's local header offset is right after the first file.
    const second = cdOffset + 46 + 5
    expect(v.getUint32(second + 42, true)).toBe(30 + 5 + 5)
  })
})
