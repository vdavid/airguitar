import { INSTRUMENTS, type InstrumentId } from '../audio/instruments/catalog.ts'
import { clamp } from '../geom.ts'
import type { OpenPicker } from '../ui/picker.ts'
import { drawIcon } from './icons.ts'
import { hexA, INK, IVORY, label, roundRect, TAU } from './style.ts'

/** Draws the instrument palette: icon tiles, the hovered (or current) one named in the header. */
export function drawPicker(
  g: CanvasRenderingContext2D,
  picker: OpenPicker,
  t: number,
  current: InstrumentId | null,
): void {
  const { panel, tiles, close } = picker.layout
  const open = clamp((t - picker.openedAt) / 0.18, 0, 1)
  const e = 1 - Math.pow(1 - open, 3)
  const cx = panel.x + panel.w / 2
  const cy = panel.y + panel.h / 2
  g.save()
  g.globalAlpha = e
  g.translate(cx, cy)
  g.scale(0.94 + 0.06 * e, 0.94 + 0.06 * e)
  g.translate(-cx, -cy)
  roundRect(g, panel.x, panel.y, panel.w, panel.h, 18)
  g.fillStyle = 'rgba(9,11,15,0.93)'
  g.fill()
  g.strokeStyle = 'rgba(251,246,233,0.2)'
  g.lineWidth = 1.2
  g.stroke()

  const focus = picker.hover ?? current
  const hx = panel.x + 20
  const hy = panel.y + 27
  if (focus !== null) {
    const info = INSTRUMENTS[focus]
    drawIcon(g, info.id, info.color, hx + 12, hy, 28)
    label(g, info.name, hx + 34, hy + 1, 17, info.color, 'left', 700, false)
  }
  label(g, 'CHOOSE AN INSTRUMENT', panel.x + panel.w - 56, hy + 1, 11, 'rgba(243,239,230,0.6)', 'right', 600, false)

  // The close button (Music Maker had a countdown ring here; this picker has no timers).
  g.fillStyle = picker.closeHover ? IVORY : 'rgba(255,255,255,0.06)'
  g.beginPath()
  g.arc(close.x, close.y, close.r, 0, TAU)
  g.fill()
  g.strokeStyle = picker.closeHover ? INK : 'rgba(251,246,233,0.75)'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(close.x - 5, close.y - 5)
  g.lineTo(close.x + 5, close.y + 5)
  g.moveTo(close.x + 5, close.y - 5)
  g.lineTo(close.x - 5, close.y + 5)
  g.stroke()

  for (const tile of tiles) {
    const info = INSTRUMENTS[tile.id]
    const hover = picker.hover === tile.id
    const on = current === tile.id
    roundRect(g, tile.x, tile.y, tile.w, tile.h, 11)
    g.fillStyle = hover ? info.color : on ? hexA(info.color, 0.16) : 'rgba(255,255,255,0.045)'
    g.fill()
    g.strokeStyle = on && !hover ? info.color : 'rgba(251,246,233,0.1)'
    g.lineWidth = on ? 2 : 1
    g.stroke()
    const mx = tile.x + tile.w / 2
    const my = tile.y + tile.h / 2
    drawIcon(g, tile.id, hover ? INK : info.color, mx, my - 9, 36)
    label(
      g,
      info.name,
      mx,
      my + 26,
      11.5,
      hover ? INK : 'rgba(243,239,230,0.92)',
      'center',
      hover || on ? 700 : 500,
      false,
    )
  }
  g.restore()
}
