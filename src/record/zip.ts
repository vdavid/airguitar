/**
 * A plain (stored, uncompressed) zip, so the stems arrive as one download. WAVs barely compress,
 * so storing them costs nothing and keeps this tiny.
 */

let crcTable: Uint32Array | null = null

export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (const byte of data) c = (crcTable[(c ^ byte) & 255] ?? 0) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  readonly name: string
  readonly bytes: Uint8Array<ArrayBuffer>
}

/** The zip's bytes, as parts for a `Blob`. Names are UTF-8 (flag bit 11). */
export function zipParts(files: readonly ZipEntry[], date = new Date()): Uint8Array<ArrayBuffer>[] {
  const enc = new TextEncoder()
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const parts: Uint8Array<ArrayBuffer>[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const crc = crc32(f.bytes)
    const n = f.bytes.length
    const head = new DataView(new ArrayBuffer(30))
    head.setUint32(0, 0x04034b50, true)
    head.setUint16(4, 20, true) // version needed
    head.setUint16(6, 0x0800, true) // UTF-8 names
    head.setUint16(8, 0, true) // stored
    head.setUint16(10, dosTime, true)
    head.setUint16(12, dosDate, true)
    head.setUint32(14, crc, true)
    head.setUint32(18, n, true)
    head.setUint32(22, n, true)
    head.setUint16(26, name.length, true)
    parts.push(new Uint8Array(head.buffer), name, f.bytes)

    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true)
    c.setUint16(4, 20, true) // version made by
    c.setUint16(6, 20, true) // version needed
    c.setUint16(8, 0x0800, true)
    c.setUint16(10, 0, true)
    c.setUint16(12, dosTime, true)
    c.setUint16(14, dosDate, true)
    c.setUint32(16, crc, true)
    c.setUint32(20, n, true)
    c.setUint32(24, n, true)
    c.setUint16(28, name.length, true)
    c.setUint32(42, offset, true)
    central.push(new Uint8Array(c.buffer), name)
    offset += 30 + name.length + n
  }
  const size = central.reduce((a, b) => a + b.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, size, true)
  end.setUint32(16, offset, true)
  return [...parts, ...central, new Uint8Array(end.buffer)]
}
