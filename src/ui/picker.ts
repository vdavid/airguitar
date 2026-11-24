import { INSTRUMENT_IDS, type InstrumentId } from '../audio/instruments/catalog.ts'
import { clamp, type Vec } from '../geom.ts'
import { DoublePinch, type Armed, type DoublePinchResult } from './double-pinch.ts'

/**
 * The instrument picker: Music Maker's palette of 24 icon tiles, drawn on the stage canvas so hands
 * can reach it. Hands choose a tile with a double pinch (`double-pinch.ts`), the mouse with one
 * click; a single pinch outside the panel or on the close button closes it. This file is layout,
 * hit testing, and open/hover/armed state; drawing is in `render/picker.ts`.
 */

export type PickerTarget = { readonly kind: 'string'; readonly id: number } | { readonly kind: 'new-strings' }

export const PICKER_COLS = 6
const TILE_W = 96
const TILE_H = 80
const GAP = 6
const HEAD = 52
const PAD = 14

export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface PickerLayout {
  readonly panel: Rect
  readonly tiles: readonly (Rect & { readonly id: InstrumentId })[]
  readonly close: { readonly x: number; readonly y: number; readonly r: number }
}

export type PickerHit =
  | { readonly kind: 'tile'; readonly id: InstrumentId }
  | { readonly kind: 'close' }
  | { readonly kind: 'panel' }
  | { readonly kind: 'outside' }

/** Places the panel centred on `anchor`, kept inside the stage and below the top bar. */
export function layoutPicker(anchor: Vec, stage: { width: number; height: number }, safeTop: number): PickerLayout {
  const rows = Math.ceil(INSTRUMENT_IDS.length / PICKER_COLS)
  const w = PICKER_COLS * TILE_W + (PICKER_COLS - 1) * GAP + PAD * 2
  const h = HEAD + rows * TILE_H + (rows - 1) * GAP + PAD
  const lo = safeTop + h / 2 + 8
  const hi = stage.height - h / 2 - 8
  const cx = clamp(anchor.x, w / 2 + 8, stage.width - w / 2 - 8)
  const cy = hi > lo ? clamp(anchor.y, lo, hi) : (lo + hi) / 2
  const x0 = cx - w / 2
  const y0 = cy - h / 2
  const tiles = INSTRUMENT_IDS.map((id, i) => ({
    id,
    x: x0 + PAD + (i % PICKER_COLS) * (TILE_W + GAP),
    y: y0 + HEAD + Math.floor(i / PICKER_COLS) * (TILE_H + GAP),
    w: TILE_W,
    h: TILE_H,
  }))
  return { panel: { x: x0, y: y0, w, h }, tiles, close: { x: x0 + w - 28, y: y0 + 27, r: 16 } }
}

const inside = (r: Rect, p: Vec, inset = 0): boolean =>
  p.x >= r.x + inset && p.x <= r.x + r.w - inset && p.y >= r.y + inset && p.y <= r.y + r.h - inset

export function hitPicker(layout: PickerLayout, p: Vec): PickerHit {
  if (Math.hypot(p.x - layout.close.x, p.y - layout.close.y) <= layout.close.r + 4) return { kind: 'close' }
  for (const t of layout.tiles) if (inside(t, p, 2)) return { kind: 'tile', id: t.id }
  return inside(layout.panel, p) ? { kind: 'panel' } : { kind: 'outside' }
}

export interface OpenPicker {
  readonly target: PickerTarget
  readonly layout: PickerLayout
  readonly openedAt: number
  /** The tile some pointer is over, for highlight and the header name. */
  readonly hover: InstrumentId | null
  readonly closeHover: boolean
  /** The tile a first pinch armed (`double-pinch.ts`), and when, for the pulsing ring. */
  readonly armed: Armed<InstrumentId> | null
}

export class PickerState {
  private current: OpenPicker | null = null
  private readonly double = new DoublePinch<InstrumentId>()

  get open(): OpenPicker | null {
    return this.current
  }

  show(
    target: PickerTarget,
    anchor: Vec,
    stage: { width: number; height: number },
    safeTop: number,
    now: number,
  ): void {
    this.current = {
      target,
      layout: layoutPicker(anchor, stage, safeTop),
      openedAt: now,
      hover: null,
      closeHover: false,
      armed: null,
    }
    this.double.reset()
  }

  close(): void {
    this.current = null
    this.double.reset()
  }

  /** A hand pinched a tile: the first pinch arms it, a second one in time chooses it. */
  pinchTile(pointer: string, id: InstrumentId, t: number): DoublePinchResult {
    const result = this.double.pinch(pointer, id, t)
    if (this.current) this.current = { ...this.current, armed: this.double.armed }
    return result
  }

  /** A hand's pinch ended or the hand was lost (for telling a real re-pinch from jitter). */
  release(pointer: string, t: number): void {
    this.double.release(pointer, t)
  }

  /**
   * Updates hover from every pointer this frame (`hands`: fingertips and pinch cursors; `others`:
   * the mouse). Only hands clear an arm by moving onto another tile. Returns the tile that just
   * became hovered (for an audition sound), if any.
   */
  updateHover(hands: readonly Vec[], others: readonly Vec[], t: number): InstrumentId | null {
    const open = this.current
    if (!open) return null
    let hover: InstrumentId | null = null
    let closeHover = false
    const tiles: (InstrumentId | null)[] = []
    for (const [i, p] of [...hands, ...others].entries()) {
      const hit = hitPicker(open.layout, p)
      if (i < hands.length) tiles.push(hit.kind === 'tile' ? hit.id : null)
      if (hit.kind === 'tile') hover ??= hit.id
      if (hit.kind === 'close') closeHover = true
    }
    const fresh = hover !== null && hover !== open.hover ? hover : null
    this.current = { ...open, hover, closeHover, armed: this.double.update(t, tiles) }
    return fresh
  }
}
