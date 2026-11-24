/** Shared canvas styling: Music Maker's palette and text helper. */

export const IVORY = '#fbf6e9'
export const INK = '#10141a'
export const AMBER = '#ffc24a'
export const FONT = '"Avenir Next", "Segoe UI", system-ui, -apple-system, sans-serif'
export const TAU = Math.PI * 2

/** `#rrggbb` + alpha → `rgba(...)`. */
export function hexA(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

/** Text with an optional dark outline, so it reads over the camera picture. */
export function label(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = 'center',
  weight = 600,
  outline = true,
): void {
  g.font = `${weight} ${size}px ${FONT}`
  g.textAlign = align
  g.textBaseline = 'middle'
  if (outline) {
    g.lineWidth = 3.5
    g.strokeStyle = 'rgba(6,8,12,0.78)'
    g.lineJoin = 'round'
    g.strokeText(text, x, y)
  }
  g.fillStyle = color
  g.fillText(text, x, y)
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}
