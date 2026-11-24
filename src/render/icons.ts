import type { InstrumentId } from '../audio/instruments/catalog.ts'

/**
 * Instrument icons (Music Maker's), drawn on a 24 × 24 grid. Each icon is a little program over a
 * drawing kit, so the same definition renders to the canvas (stage badges, the picker) and to SVG
 * (HTML buttons).
 *
 * Kit: `S` strokes a path, `F` fills one, `C` is a ring, `D` a dot, `B` a solid body of circles,
 * `cut` carves detail out of what's drawn so far.
 */
interface Kit {
  S(d: string, width?: number): void
  F(d: string): void
  C(x: number, y: number, r: number, width?: number): void
  D(x: number, y: number, r: number): void
  B(circles: readonly (readonly [number, number, number])[]): void
  cut(fn: () => void): void
}

const GUITAR_BODY = [
  [8.6, 15.9, 5.6],
  [12.7, 10.9, 3.9],
] as const

const guitar = (k: Kit): void => {
  k.B(GUITAR_BODY)
  k.cut(() => {
    k.D(10.3, 13.9, 1.5)
  })
  k.S('M15 8.6 L20.3 3.3 M18.7 1.8 L21.8 4.9', 2)
}

const ICONS: Readonly<Record<InstrumentId, (k: Kit) => void>> = {
  guitar,
  egtr(k) {
    guitar(k)
    k.F('M6.6 1.2 L2.6 7.2 H5.4 L4.2 11.4 L8.8 5.2 H6 Z')
  },
  harp(k) {
    k.S('M6.5 3 V21 M6.5 3 C12 2.5 13.5 8.5 19 7 M6.5 21 L19 7')
    k.S('M10 3.9 V17.1 M12.75 5.5 V14 M15.4 6.9 V11', 1.2)
  },
  oud(k) {
    k.F(
      'M12 21.8 C6.2 21.8 5 16.2 7.9 12.3 C9.7 9.9 10.8 8.6 10.8 6.2 H13.2 C13.2 8.6 14.3 9.9 16.1 12.3 C19 16.2 17.8 21.8 12 21.8 Z',
    )
    k.cut(() => {
      k.D(12, 15.9, 2)
    })
    k.S('M12 6.4 V3.6 L15.9 1.9', 2)
  },
  qanun(k) {
    k.S('M3.2 6.5 H20.8 L13.8 18.5 H3.2 Z')
    k.S('M3.2 9.5 H19 M3.2 12.5 H17.3 M3.2 15.5 H15.5', 1.2)
  },
  sitar(k) {
    k.D(12, 17.3, 4.7)
    k.cut(() => {
      k.D(12, 17.3, 1.4)
    })
    k.S('M12 13 V2.2 M12 4.6 H15.6 M12 7.2 H8.4 M12 9.8 H15.6')
  },
  piano(k) {
    k.S('M3.5 6 H20.5 V18.5 H3.5 Z M9.2 13 V18.5 M14.8 13 V18.5')
    k.F('M7.6 6 H10.8 V13 H7.6 Z M13.2 6 H16.4 V13 H13.2 Z')
  },
  epiano(k) {
    k.S('M2.8 7.5 H21.2 V13.5 H2.8 Z M8.2 13.5 L15.8 21 M15.8 13.5 L8.2 21')
    k.S('M7 7.5 V10.4 M10.3 7.5 V10.4 M13.7 7.5 V10.4 M17 7.5 V10.4', 1.3)
  },
  organ(k) {
    k.S(
      'M3 19 V12 L4.5 10.4 L6 12 V19 Z M7.2 19 V8 L8.7 6.4 L10.2 8 V19 Z M11.4 19 V4 L12.9 2.4 L14.4 4 V19 Z M15.6 19 V8 L17.1 6.4 L18.6 8 V19 Z M19.8 19 V12 L21.3 10.4 L22.8 12 V19 Z',
      1.3,
    )
    k.S('M3.6 16 H5.4 M7.8 16 H9.6 M12 16 H13.8 M16.2 16 H18 M20.4 16 H22.2', 1.2)
    k.S('M2 21.6 H23.6')
  },
  marimba(k) {
    k.S('M4 9 V21.5 M8.2 10.2 V20.3 M12.4 11.4 V19.1 M16.6 12.6 V17.9', 2.6)
    k.S('M13.4 1.8 L9.2 5.4 M21.8 2.6 L17.4 6.6', 1.3)
    k.D(8.6, 5.9, 1.7)
    k.D(16.8, 7.1, 1.7)
  },
  kalimba(k) {
    k.S('M6.5 4 H17.5 A2.5 2.5 0 0 1 20 6.5 V17.5 A4 4 0 0 1 16 21.5 H8 A4 4 0 0 1 4 17.5 V6.5 A2.5 2.5 0 0 1 6.5 4 Z')
    k.S('M8.4 4 V10.5 M12 4 V14 M15.6 4 V10.5 M10.2 4 V12.4 M13.8 4 V12.4', 1.25)
    k.D(12, 17.8, 1.2)
  },
  steelpan(k) {
    k.S(
      'M3.5 8.5 A8.5 3.7 0 1 0 20.5 8.5 A8.5 3.7 0 1 0 3.5 8.5 M3.5 8.5 V11.5 C3.5 16.8 8 19.8 12 19.8 C16 19.8 20.5 16.8 20.5 11.5 V8.5',
    )
    k.D(8.6, 8.4, 1.1)
    k.D(12.6, 7.3, 1.1)
    k.D(15, 9.6, 1.1)
  },
  violin(k) {
    k.B([
      [10.4, 16.2, 5],
      [10.4, 10, 3.8],
    ])
    k.S('M10.4 6.6 V2.2 M8.8 2.2 H12', 1.9)
    k.cut(() => {
      k.S('M8.5 12.2 V15.4 M12.3 12.2 V15.4', 1.1)
      k.S('M2.6 22.6 L22 7.8', 3.6)
    })
    k.S('M2.6 22.6 L22 7.8', 1.4)
  },
  cello(k) {
    k.B([
      [12, 15.3, 5.4],
      [12, 8.5, 4],
    ])
    k.S('M12 4.8 V1.4 M12 20.4 V23.2', 1.9)
    k.cut(() => {
      k.S('M9.7 12 V15.6 M14.3 12 V15.6', 1.2)
    })
  },
  strings(k) {
    for (const x of [7, 17]) {
      k.B([
        [x, 16.4, 4.1],
        [x, 11.2, 3.1],
      ])
      k.S(`M${x} 8.4 V3.8`, 1.8)
    }
    k.cut(() => {
      k.S('M5.6 13.6 V16 M8.4 13.6 V16 M15.6 13.6 V16 M18.4 13.6 V16', 0.9)
    })
  },
  flute(k) {
    k.S('M3.6 17.6 L18.8 5 L20.7 7.3 L5.5 19.9 Z')
    k.D(9.2, 14.6, 0.95)
    k.D(12.2, 12.1, 0.95)
    k.D(15.2, 9.6, 0.95)
  },
  trumpet(k) {
    k.S('M2.8 11 H14.6 C17.4 11 18.8 9.2 21.2 7.4 V16.6 C18.8 14.8 17.4 13 14.6 13 H2.8 Z')
    k.S(
      'M7.6 11 V7.6 M10.3 11 V7.6 M13 11 V7.6 M6.8 13 V15.3 A1.6 1.6 0 0 0 8.4 16.9 H12.4 A1.6 1.6 0 0 0 14 15.3 V13',
      1.4,
    )
  },
  voices(k) {
    k.C(8.2, 8.4, 3.3)
    k.S('M2.6 20.4 C2.6 15.4 13.8 15.4 13.8 20.4')
    k.S('M16.4 6 C18 7.6 18 10.4 16.4 12 M19 3.8 C21.8 6.6 21.8 11.4 19 14.2', 1.5)
  },
  bells(k) {
    k.S(
      'M12 3.6 C8 3.6 6.8 7 6.8 10.5 C6.8 14 5.5 15.8 4.2 17.2 H19.8 C18.5 15.8 17.2 14 17.2 10.5 C17.2 7 16 3.6 12 3.6 Z M12 1.8 V3.6',
    )
    k.D(12, 19.8, 1.6)
  },
  synth(k) {
    k.S('M2.5 15.5 V8.5 H7.5 V15.5 H12.5 V8.5 H17.5 V15.5 H21.5')
  },
  bass(k) {
    k.S('M6.4 8.6 C6.4 4.4 16.8 3.2 16.8 10 C16.8 15 11.6 18.6 5.8 20.8')
    k.D(7.7, 9.5, 1.8)
    k.D(20.2, 7.2, 1.3)
    k.D(20.2, 12.4, 1.3)
  },
  sub(k) {
    k.C(12, 12, 8.6)
    k.C(12, 12, 4, 1.4)
    k.D(12, 12, 1.4)
  },
  drums(k) {
    k.S('M4.5 11 A7.5 2.8 0 1 0 19.5 11 A7.5 2.8 0 1 0 4.5 11 M4.5 11 V17 A7.5 2.8 0 0 0 19.5 17 V11')
    k.S('M6.6 2.6 L11.4 10.2 M17.4 2.6 L12.6 10.2', 1.5)
  },
  handdrums(k) {
    k.S(
      'M5.8 4 A6.2 1.8 0 1 0 18.2 4 A6.2 1.8 0 1 0 5.8 4 M5.8 4 C5.8 9.4 10 10.4 10 13.4 C10 16.8 8 18.6 7.4 21 H16.6 C16 18.6 14 16.8 14 13.4 C14 10.4 18.2 9.4 18.2 4',
    )
  },
}

const TAU = Math.PI * 2
const iconCache = new Map<string, HTMLCanvasElement>()

/** The icon as a canvas tinted `color`, cached, rendered at 2× for sharpness. */
export function iconCanvas(id: InstrumentId, color: string, px: number): HTMLCanvasElement {
  const key = `${id}|${color}|${px}`
  const hit = iconCache.get(key)
  if (hit) return hit
  const n = Math.ceil(px * 2)
  const canvas = document.createElement('canvas')
  canvas.width = n
  canvas.height = n
  const c = canvas.getContext('2d')
  if (!c) return canvas
  c.scale(n / 24, n / 24)
  c.lineCap = 'round'
  c.lineJoin = 'round'
  c.strokeStyle = '#fff'
  c.fillStyle = '#fff'
  const kit: Kit = {
    S(d, width = 1.7) {
      c.lineWidth = width
      c.stroke(new Path2D(d))
    },
    F(d) {
      c.fill(new Path2D(d))
    },
    C(x, y, r, width = 1.7) {
      c.lineWidth = width
      c.beginPath()
      c.arc(x, y, r, 0, TAU)
      c.stroke()
    },
    D(x, y, r) {
      c.beginPath()
      c.arc(x, y, r, 0, TAU)
      c.fill()
    },
    B(circles) {
      for (const [x, y, r] of circles) kit.D(x, y, r)
    },
    cut(fn) {
      c.globalCompositeOperation = 'destination-out'
      fn()
      c.globalCompositeOperation = 'source-over'
    },
  }
  ICONS[id](kit)
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.globalCompositeOperation = 'source-in'
  c.fillStyle = color
  c.fillRect(0, 0, n, n)
  iconCache.set(key, canvas)
  return canvas
}

export function drawIcon(
  g: CanvasRenderingContext2D,
  id: InstrumentId,
  color: string,
  x: number,
  y: number,
  px: number,
): void {
  g.drawImage(iconCanvas(id, color, px), x - px / 2, y - px / 2, px, px)
}

let maskSeq = 0

/** The icon as an inline SVG string using `currentColor`, for HTML buttons. */
export function iconSvg(id: InstrumentId, size = 20): string {
  let body = ''
  const masks: string[] = []
  let cutting: string[] | null = null
  const emit = (el: string): void => {
    if (cutting) cutting.push(el)
    else body += el
  }
  const ink = (): string => (cutting ? '#000' : 'currentColor')
  const kit: Kit = {
    S(d, width = 1.7) {
      emit(`<path d="${d}" fill="none" stroke="${ink()}" stroke-width="${width}"/>`)
    },
    F(d) {
      emit(`<path d="${d}" fill="${ink()}"/>`)
    },
    C(x, y, r, width = 1.7) {
      emit(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${ink()}" stroke-width="${width}"/>`)
    },
    D(x, y, r) {
      emit(`<circle cx="${x}" cy="${y}" r="${r}" fill="${ink()}"/>`)
    },
    B(circles) {
      for (const [x, y, r] of circles) kit.D(x, y, r)
    },
    cut(fn) {
      cutting = []
      fn()
      const id = `agm${++maskSeq}`
      masks.push(`<mask id="${id}"><rect x="-2" y="-2" width="28" height="28" fill="#fff"/>${cutting.join('')}</mask>`)
      cutting = null
      body = `<g mask="url(#${id})">${body}</g>`
    },
  }
  ICONS[id](kit)
  return (
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">` +
    `<defs>${masks.join('')}</defs>${body}</svg>`
  )
}
