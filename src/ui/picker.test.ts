import { describe, expect, it } from 'vitest'
import { hitPicker, layoutPicker, PickerState } from './picker.ts'

const STAGE = { width: 1280, height: 720 }

describe('layoutPicker', () => {
  it('lays out 24 tiles in six columns', () => {
    const l = layoutPicker({ x: 640, y: 360 }, STAGE, 60)
    expect(l.tiles).toHaveLength(24)
    expect(new Set(l.tiles.map((t) => t.y)).size).toBe(4)
  })

  it('stays inside the stage and below the top bar', () => {
    const l = layoutPicker({ x: 10, y: 10 }, STAGE, 60)
    expect(l.panel.x).toBeGreaterThanOrEqual(0)
    expect(l.panel.y).toBeGreaterThanOrEqual(60)
    expect(l.panel.x + l.panel.w).toBeLessThanOrEqual(STAGE.width)
  })
})

describe('hitPicker', () => {
  const l = layoutPicker({ x: 640, y: 360 }, STAGE, 60)
  const first = l.tiles[0]
  const last = l.tiles[23]

  it('hits tiles', () => {
    if (!first || !last) throw new Error('no tiles')
    expect(hitPicker(l, { x: first.x + 40, y: first.y + 40 })).toEqual({ kind: 'tile', id: 'guitar' })
    expect(hitPicker(l, { x: last.x + 40, y: last.y + 40 })).toEqual({ kind: 'tile', id: 'handdrums' })
  })

  it('hits the close button and outside', () => {
    expect(hitPicker(l, l.close)).toEqual({ kind: 'close' })
    expect(hitPicker(l, { x: 2, y: 700 })).toEqual({ kind: 'outside' })
    expect(hitPicker(l, { x: l.panel.x - 1, y: l.panel.y + 100 })).toEqual({ kind: 'outside' })
  })

  it('gives the gap between two tiles to the nearer one', () => {
    const a = l.tiles[0]
    const b = l.tiles[1]
    const below = l.tiles[6]
    if (!a || !b || !below) throw new Error('no tiles')
    const gapMid = (a.x + a.w + b.x) / 2
    expect(hitPicker(l, { x: gapMid - 1, y: a.y + 40 })).toEqual({ kind: 'tile', id: a.id })
    expect(hitPicker(l, { x: gapMid + 1, y: a.y + 40 })).toEqual({ kind: 'tile', id: b.id })
    expect(hitPicker(l, { x: a.x + 40, y: a.y + a.h + 1 })).toEqual({ kind: 'tile', id: a.id })
    expect(hitPicker(l, { x: a.x + 40, y: below.y - 1 })).toEqual({ kind: 'tile', id: below.id })
  })

  it('gives the panel around the grid (header, padding, corners) to the nearest edge tile', () => {
    if (!first || !last) throw new Error('no tiles')
    expect(hitPicker(l, { x: l.panel.x + 4, y: l.panel.y + 4 })).toEqual({ kind: 'tile', id: 'guitar' })
    expect(hitPicker(l, { x: first.x + 40, y: first.y - 20 })).toEqual({ kind: 'tile', id: 'guitar' })
    expect(hitPicker(l, { x: l.panel.x + l.panel.w - 2, y: l.panel.y + l.panel.h - 2 })).toEqual({
      kind: 'tile',
      id: 'handdrums',
    })
  })
})

describe('PickerState', () => {
  const aimAt = (p: { x: number; y: number }): { aim: typeof p; latched: typeof p } => ({ aim: p, latched: p })

  it('reports a newly hovered tile once', () => {
    const picker = new PickerState()
    picker.show({ kind: 'new-strings' }, { x: 640, y: 360 }, STAGE, 60, 0)
    const tile = picker.open?.layout.tiles[3]
    if (!tile) throw new Error('no tile')
    const p = { x: tile.x + 30, y: tile.y + 30 }
    expect(picker.updateHover([aimAt(p)], [], 0)).toBe('oud')
    expect(picker.updateHover([aimAt(p)], [], 0)).toBeNull()
    expect(picker.open).toMatchObject({ hover: 'oud' })
  })

  it('keeps an arm while only the mouse sits on another tile, and clears it when a hand moves there', () => {
    const picker = new PickerState()
    picker.show({ kind: 'new-strings' }, { x: 640, y: 360 }, STAGE, 60, 0)
    const [a, b] = picker.open?.layout.tiles ?? []
    if (!a || !b) throw new Error('no tiles')
    const onB = { x: b.x + 30, y: b.y + 30 }
    expect(picker.pinchTile('h1', a.id, 1)).toBe('armed')
    picker.updateHover([], [onB], 1.1)
    expect(picker.open?.armed?.tile).toBe(a.id)
    picker.updateHover([aimAt(onB)], [], 1.2)
    expect(picker.open?.armed).toBeNull()
  })

  it('keeps the arm while a closing pinch slides the aim to a neighbor but its latched aim stays', () => {
    const picker = new PickerState()
    picker.show({ kind: 'new-strings' }, { x: 640, y: 360 }, STAGE, 60, 0)
    const [a, b] = picker.open?.layout.tiles ?? []
    if (!a || !b) throw new Error('no tiles')
    const onA = { x: a.x + 30, y: a.y + 30 }
    const onB = { x: b.x + 30, y: b.y + 30 }
    picker.pinchTile('h1', a.id, 1)
    picker.updateHover([{ aim: onB, latched: onA }], [], 1.2)
    expect(picker.open?.armed?.tile).toBe(a.id)
    // The highlight follows the cursor itself.
    expect(picker.open?.hover).toBe(b.id)
  })
})
