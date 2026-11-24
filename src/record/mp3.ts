/**
 * MP3 encoding with lamejs (LGPL-3.0, a JavaScript port of LAME). It's vendored unmodified as a
 * separate file in `public/vendor/lamejs/` with its license, and loaded as a classic script only
 * when someone saves an MP3, so the app bundle stays MIT and small. No maintained npm package
 * exists: `lamejs` was last published in 2022 and its forks are dormant.
 */

interface Mp3Encoder {
  encodeBuffer(left: Int16Array, right: Int16Array): Int8Array
  flush(): Int8Array
}

interface LameJs {
  readonly Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => Mp3Encoder
}

declare global {
  interface Window {
    lamejs?: LameJs
  }
}

/** Sample rates MPEG-1 Layer III supports at our bitrate. */
export const MP3_RATES: readonly number[] = [32000, 44100, 48000]

let loading: Promise<LameJs> | null = null

function loadLame(): Promise<LameJs> {
  loading ??= new Promise<LameJs>((resolve, reject) => {
    if (window.lamejs) {
      resolve(window.lamejs)
      return
    }
    const s = document.createElement('script')
    s.src = `${import.meta.env.BASE_URL}vendor/lamejs/lame.min.js`
    s.onload = () => {
      if (window.lamejs) resolve(window.lamejs)
      else reject(new Error('The MP3 encoder didn’t load.'))
    }
    s.onerror = () => {
      loading = null
      reject(new Error('The MP3 encoder couldn’t be downloaded.'))
    }
    document.head.append(s)
  })
  return loading
}

/** Encodes 16-bit stereo to a 192 kbps MP3, in slices so the page stays responsive. */
export async function encodeMp3(
  left: Int16Array,
  right: Int16Array,
  sampleRate: number,
  onProgress: (fraction: number) => void,
): Promise<Blob> {
  const lame = await loadLame()
  const enc = new lame.Mp3Encoder(2, sampleRate, 192)
  const parts: Int8Array<ArrayBuffer>[] = []
  const block = 1152 * 24
  let last = performance.now()
  for (let i = 0; i < left.length; i += block) {
    const out = enc.encodeBuffer(left.subarray(i, i + block), right.subarray(i, i + block))
    if (out.length) parts.push(new Int8Array(out))
    if (performance.now() - last > 40) {
      onProgress(i / left.length)
      await new Promise((r) => setTimeout(r, 0))
      last = performance.now()
    }
  }
  const end = enc.flush()
  if (end.length) parts.push(new Int8Array(end))
  onProgress(1)
  return new Blob(parts, { type: 'audio/mpeg' })
}
