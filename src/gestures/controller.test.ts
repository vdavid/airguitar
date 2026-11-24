import { describe, expect, it, vi } from 'vitest'
import type { Vec } from '../geom.ts'
import { AppStore } from '../state/app.ts'
import { StageStore } from '../state/stage.ts'
import { MIN_KEPT_LENGTH } from '../strings/model.ts'
import { PickerState } from '../ui/picker.ts'
import { GestureController, type GestureHost, type Pointer } from './controller.ts'

function setup(): {
  ctl: GestureController
  stage: StageStore
  app: AppStore
  picker: PickerState
  clock: { t: number }
  spies: { tooShort: ReturnType<typeof vi.fn>; stringMerged: ReturnType<typeof vi.fn> }
} {
  const spies = { tooShort: vi.fn(), stringMerged: vi.fn() }
  const stage = new StageStore()
  const app = new AppStore()
  const picker = new PickerState()
  const clock = { t: 0 }
  const host: GestureHost = {
    stage,
    app,
    picker,
    safeTop: () => 60,
    now: () => clock.t,
    pressUi: () => false,
    choose: (target, id) => {
      if (target.kind === 'string') stage.setInstrument(target.id, id)
      else stage.setNewStringInstrument(id)
    },
    stringCreated: vi.fn(),
    stringMerged: spies.stringMerged,
    tooShort: spies.tooShort,
    stageFull: vi.fn(),
  }
  return { ctl: new GestureController(host), stage, app, picker, clock, spies }
}

const hand = (id: string, x: number, y: number): Pointer => ({ id, kind: 'hand', pos: { x, y } })
const mouse = (x: number, y: number): Pointer => ({ id: 'mouse', kind: 'mouse', pos: { x, y } })

describe('creating strings', () => {
  it('stretches a string between two pinching hands', () => {
    const { ctl, stage } = setup()
    ctl.pinchStart(hand('h1', 300, 300))
    expect(ctl.previews()).toHaveLength(0)
    expect(ctl.waiting()).toHaveLength(1)
    ctl.pinchStart(hand('h2', 320, 300))
    ctl.pinchMove(hand('h2', 700, 320))
    expect(ctl.previews()).toEqual([{ a: { x: 300, y: 300 }, b: { x: 700, y: 320 }, ok: true }])
    ctl.pinchEnd('h1')
    expect(stage.state.strings).toHaveLength(1)
    ctl.pinchEnd('h2')
    expect(stage.state.strings).toHaveLength(1)
  })

  it('pairs four hands into two strings', () => {
    const { ctl, stage } = setup()
    ctl.pinchStart(hand('a1', 100, 200))
    ctl.pinchStart(hand('a2', 400, 200))
    ctl.pinchStart(hand('b1', 100, 500))
    ctl.pinchStart(hand('b2', 400, 500))
    expect(ctl.previews()).toHaveLength(2)
    for (const id of ['a1', 'a2', 'b1', 'b2']) ctl.pinchEnd(id)
    expect(stage.state.strings.map((s) => s.a.y)).toEqual([200, 500])
  })

  it('does not create a string that is too short', () => {
    const { ctl, stage, spies } = setup()
    ctl.pinchStart(hand('h1', 300, 300))
    ctl.pinchStart(hand('h2', 330, 300))
    ctl.pinchEnd('h1')
    expect(stage.state.strings).toHaveLength(0)
    expect(spies.tooShort).toHaveBeenCalled()
  })

  it('lets the mouse drag out a string', () => {
    const { ctl, stage } = setup()
    ctl.pinchStart(mouse(100, 100))
    ctl.pinchMove(mouse(400, 100))
    ctl.pinchEnd('mouse')
    expect(stage.state.strings).toHaveLength(1)
  })

  it('creates nothing in Play mode', () => {
    const { ctl, stage, app } = setup()
    app.setMode('play')
    ctl.pinchStart(hand('h1', 100, 300))
    ctl.pinchStart(hand('h2', 600, 300))
    ctl.pinchEnd('h1')
    ctl.pinchStart(mouse(100, 100))
    ctl.pinchMove(mouse(400, 100))
    ctl.pinchEnd('mouse')
    expect(stage.state.strings).toHaveLength(0)
  })

  it('forgets a pairing when a hand is lost', () => {
    const { ctl, stage } = setup()
    ctl.pinchStart(hand('h1', 100, 300))
    ctl.pinchStart(hand('h2', 600, 300))
    ctl.cancel('h2')
    expect(ctl.waiting()).toHaveLength(1)
    ctl.pinchEnd('h1')
    expect(stage.state.strings).toHaveLength(0)
  })
})

describe('endpoints', () => {
  it('grabs and moves an endpoint', () => {
    const { ctl, stage } = setup()
    const s = stage.addString({ x: 100, y: 300 }, { x: 600, y: 300 })
    ctl.pinchStart(hand('h1', 605, 305))
    ctl.pinchMove(hand('h1', 800, 400))
    ctl.pinchEnd('h1')
    expect(stage.find(s?.id ?? 0)?.b).toEqual({ x: 800, y: 400 })
  })

  it('deletes a string when one end is dropped on the other', () => {
    const { ctl, stage, spies } = setup()
    stage.addString({ x: 100, y: 300 }, { x: 600, y: 300 })
    ctl.pinchStart(mouse(600, 300))
    ctl.pinchMove(mouse(110, 305))
    ctl.pinchEnd('mouse')
    expect(stage.state.strings).toHaveLength(0)
    expect(spies.stringMerged).toHaveBeenCalled()
  })

  it('cannot move endpoints in Play mode', () => {
    const { ctl, stage, app } = setup()
    const s = stage.addString({ x: 100, y: 300 }, { x: 600, y: 300 })
    app.setMode('play')
    ctl.pinchStart(hand('h1', 600, 300))
    ctl.pinchMove(hand('h1', 800, 400))
    ctl.pinchEnd('h1')
    expect(stage.find(s?.id ?? 0)?.b).toEqual({ x: 600, y: 300 })
  })
})

describe('the instrument picker', () => {
  function openOnString(): ReturnType<typeof setup> & { id: number; tile: (id: string) => Vec } {
    const env = setup()
    const s = env.stage.addString({ x: 100, y: 300 }, { x: 600, y: 300 })
    env.ctl.pinchStart(hand('h1', 350, 300))
    env.ctl.pinchEnd('h1')
    expect(env.picker.open?.target).toEqual({ kind: 'string', id: s?.id })
    const tile = (id: string): Vec => {
      const r = env.picker.open?.layout.tiles.find((t) => t.id === id)
      if (!r) throw new Error(`no ${id} tile`)
      return { x: r.x + 40, y: r.y + 40 }
    }
    return { ...env, id: s?.id ?? 0, tile }
  }

  it('opens on a string middle and picks with two hand pinches on a tile', () => {
    const { ctl, stage, picker, clock, id, tile } = openOnString()
    const harp = tile('harp')
    clock.t = 1
    ctl.pinchStart(hand('h2', harp.x, harp.y))
    expect(picker.open?.armed?.tile).toBe('harp')
    expect(stage.find(id)?.instrument).toBe('guitar')
    clock.t = 1.15
    ctl.pinchEnd('h2')
    clock.t = 1.4
    ctl.pinchStart(hand('h2', harp.x, harp.y))
    expect(stage.find(id)?.instrument).toBe('harp')
    expect(picker.open).toBeNull()
  })

  it('does not pick on a single hand pinch, or on two pinches on different tiles', () => {
    const { ctl, stage, picker, clock, id, tile } = openOnString()
    clock.t = 1
    ctl.pinchStart(hand('h2', tile('harp').x, tile('harp').y))
    ctl.pinchEnd('h2')
    clock.t = 1.4
    ctl.pinchStart(hand('h2', tile('oud').x, tile('oud').y))
    ctl.pinchEnd('h2')
    expect(stage.find(id)?.instrument).toBe('guitar')
    expect(picker.open?.armed?.tile).toBe('oud')
  })

  it('picks with a single mouse click', () => {
    const { ctl, stage, picker, id, tile } = openOnString()
    const harp = tile('harp')
    ctl.pinchStart(mouse(harp.x, harp.y))
    expect(stage.find(id)?.instrument).toBe('harp')
    expect(picker.open).toBeNull()
  })

  it('closes on a single hand pinch on the close button', () => {
    const { ctl, picker } = openOnString()
    const close = picker.open?.layout.close
    if (!close) throw new Error('no close button')
    ctl.pinchStart(hand('h2', close.x, close.y))
    expect(picker.open).toBeNull()
  })

  it('closes on a pinch outside, without other effects', () => {
    const { ctl, stage, picker } = setup()
    stage.addString({ x: 100, y: 300 }, { x: 600, y: 300 })
    picker.show({ kind: 'new-strings' }, { x: 640, y: 360 }, stage.state, 60, 0)
    ctl.pinchStart(mouse(5, 715))
    ctl.pinchMove(mouse(400, 715))
    ctl.pinchEnd('mouse')
    expect(picker.open).toBeNull()
    expect(stage.state.strings).toHaveLength(1)
  })

  it('does not open in Play mode', () => {
    const { ctl, stage, picker, app } = setup()
    stage.addString({ x: 100, y: 300 }, { x: 600, y: 300 })
    app.setMode('play')
    ctl.pinchStart(hand('h1', 350, 300))
    expect(picker.open).toBeNull()
  })
})

describe('expression handler', () => {
  it('is offered string pinches in Play only, and never empty air', () => {
    const { ctl, stage, app } = setup()
    stage.addString({ x: 100, y: 300 }, { x: 600, y: 300 })
    const handler = {
      pinchString: vi.fn(() => true),
      move: vi.fn(),
      release: vi.fn(),
      cancel: vi.fn(),
    }
    ctl.setExpressionHandler(handler)
    ctl.pinchStart(hand('h1', 200, 302))
    ctl.pinchEnd('h1')
    expect(handler.pinchString).not.toHaveBeenCalled()
    app.setMode('play')
    ctl.pinchStart(hand('h1', 200, 302))
    ctl.pinchMove(hand('h1', 200, 340))
    ctl.pinchEnd('h1')
    ctl.pinchStart(hand('h2', 900, 600))
    expect(handler.pinchString).toHaveBeenCalledOnce()
    expect(handler.move).toHaveBeenCalledOnce()
    expect(handler.release).toHaveBeenCalledOnce()
  })

  it('cancels (rather than releases) a pinch that was interrupted', () => {
    const { ctl, stage, app } = setup()
    stage.addString({ x: 100, y: 300 }, { x: 600, y: 300 })
    const handler = {
      pinchString: vi.fn(() => true),
      move: vi.fn(),
      release: vi.fn(),
      cancel: vi.fn(),
    }
    ctl.setExpressionHandler(handler)
    app.setMode('play')
    ctl.pinchStart(hand('h1', 200, 302))
    ctl.cancel('h1')
    ctl.pinchStart(hand('h2', 210, 302))
    // What a mode switch does (app.ts).
    ctl.cancelAll()
    expect(handler.cancel).toHaveBeenCalledTimes(2)
    expect(handler.release).not.toHaveBeenCalled()
  })
})

describe('the picker on a new string', () => {
  it('opens for a string the mouse just made, with the top bar instrument on it', () => {
    const { ctl, stage, picker } = setup()
    stage.setNewStringInstrument('harp')
    ctl.pinchStart(mouse(100, 100))
    ctl.pinchMove(mouse(400, 100))
    ctl.pinchEnd('mouse')
    const s = stage.state.strings[0]
    expect(s?.instrument).toBe('harp')
    expect(picker.open?.target).toEqual({ kind: 'string', id: s?.id })
  })

  it('opens for a string two hands just made, and closing it keeps the instrument', () => {
    const { ctl, stage, picker } = setup()
    ctl.pinchStart(hand('h1', 300, 300))
    ctl.pinchStart(hand('h2', 700, 300))
    ctl.pinchEnd('h1')
    ctl.pinchEnd('h2')
    expect(picker.open?.target.kind).toBe('string')
    ctl.pinchStart(hand('h3', 5, 715))
    ctl.pinchEnd('h3')
    expect(picker.open).toBeNull()
    expect(stage.state.strings[0]?.instrument).toBe('guitar')
  })

  it('stays shut when nothing was made', () => {
    const { ctl, picker } = setup()
    ctl.pinchStart(mouse(100, 100))
    ctl.pinchMove(mouse(120, 100))
    ctl.pinchEnd('mouse')
    expect(picker.open).toBeNull()
  })
})

describe('Mixed mode', () => {
  it('moves an end, which re-pitches the string', () => {
    const { ctl, stage, app } = setup()
    const s = stage.addString({ x: 100, y: 300 }, { x: 600, y: 300 })
    app.setMode('mixed')
    ctl.pinchStart(mouse(600, 300))
    ctl.pinchMove(mouse(800, 300))
    ctl.pinchEnd('mouse')
    expect(stage.find(s?.id ?? 0)?.b).toEqual({ x: 800, y: 300 })
  })

  it('never deletes: an end dropped on the other stays at the minimum length', () => {
    const { ctl, stage, app, spies } = setup()
    stage.addString({ x: 100, y: 300 }, { x: 600, y: 300 })
    app.setMode('mixed')
    ctl.pinchStart(mouse(600, 300))
    ctl.pinchMove(mouse(102, 300))
    ctl.pinchEnd('mouse')
    expect(stage.state.strings).toHaveLength(1)
    expect(spies.stringMerged).not.toHaveBeenCalled()
    const s = stage.state.strings[0]
    expect(s && Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y)).toBeCloseTo(MIN_KEPT_LENGTH)
  })

  it('creates no strings', () => {
    const { ctl, stage, app } = setup()
    app.setMode('mixed')
    ctl.pinchStart(hand('h1', 100, 300))
    ctl.pinchStart(hand('h2', 600, 300))
    ctl.pinchEnd('h1')
    ctl.pinchStart(mouse(100, 100))
    ctl.pinchMove(mouse(400, 100))
    ctl.pinchEnd('mouse')
    expect(stage.state.strings).toHaveLength(0)
  })

  it('bends on the middle and never opens the picker', () => {
    const { ctl, stage, app, picker } = setup()
    stage.addString({ x: 100, y: 300 }, { x: 600, y: 300 })
    const handler = { pinchString: vi.fn(() => true), move: vi.fn(), release: vi.fn(), cancel: vi.fn() }
    ctl.setExpressionHandler(handler)
    app.setMode('mixed')
    ctl.pinchStart(hand('h1', 350, 300))
    ctl.pinchEnd('h1')
    expect(picker.open).toBeNull()
    expect(handler.pinchString).toHaveBeenCalledOnce()
    expect(handler.release).toHaveBeenCalledOnce()
  })
})
