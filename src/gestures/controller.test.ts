import { describe, expect, it, vi } from 'vitest'
import { AppStore } from '../state/app.ts'
import { StageStore } from '../state/stage.ts'
import { PickerState } from '../ui/picker.ts'
import { GestureController, type GestureHost, type Pointer } from './controller.ts'

function setup(): {
  ctl: GestureController
  stage: StageStore
  app: AppStore
  picker: PickerState
  spies: { tooShort: ReturnType<typeof vi.fn>; stringMerged: ReturnType<typeof vi.fn> }
} {
  const spies = { tooShort: vi.fn(), stringMerged: vi.fn() }
  const stage = new StageStore()
  const app = new AppStore()
  const picker = new PickerState()
  const host: GestureHost = {
    stage,
    app,
    picker,
    safeTop: () => 60,
    now: () => 0,
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
  return { ctl: new GestureController(host), stage, app, picker, spies }
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
  it('opens on a string middle and picks with a pinch on a tile', () => {
    const { ctl, stage, picker } = setup()
    const s = stage.addString({ x: 100, y: 300 }, { x: 600, y: 300 })
    ctl.pinchStart(hand('h1', 350, 300))
    ctl.pinchEnd('h1')
    expect(picker.open?.target).toEqual({ kind: 'string', id: s?.id })
    const harp = picker.open?.layout.tiles.find((t) => t.id === 'harp')
    if (!harp) throw new Error('no harp tile')
    ctl.pinchStart(hand('h2', harp.x + 40, harp.y + 40))
    expect(stage.find(s?.id ?? 0)?.instrument).toBe('harp')
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
  it('is offered string and air pinches in Play only', () => {
    const { ctl, stage, app } = setup()
    stage.addString({ x: 100, y: 300 }, { x: 600, y: 300 })
    const handler = {
      pinchString: vi.fn(() => true),
      pinchAir: vi.fn(() => true),
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
    expect(handler.pinchAir).toHaveBeenCalledOnce()
  })

  it('cancels (rather than releases) a pinch that was interrupted', () => {
    const { ctl, stage, app } = setup()
    stage.addString({ x: 100, y: 300 }, { x: 600, y: 300 })
    const handler = {
      pinchString: vi.fn(() => true),
      pinchAir: vi.fn(() => true),
      move: vi.fn(),
      release: vi.fn(),
      cancel: vi.fn(),
    }
    ctl.setExpressionHandler(handler)
    app.setMode('play')
    ctl.pinchStart(hand('h1', 200, 302))
    ctl.cancel('h1')
    ctl.pinchStart(hand('h2', 900, 600))
    // What a mode switch does (app.ts).
    ctl.cancelAll()
    expect(handler.cancel).toHaveBeenCalledTimes(2)
    expect(handler.release).not.toHaveBeenCalled()
  })
})
