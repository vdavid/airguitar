import './ui/style.css'
import { createApp, type AppContext } from './app.ts'
import { mountFeatures } from './features.ts'
import type { InstrumentId } from './audio/instruments/catalog.ts'
import type { Vec } from './geom.ts'
import { PLUCKING_TIPS } from './gestures/pinch.ts'
import { renderFrame, type HandView } from './render/renderer.ts'
import { HandTracker, type HandEvents } from './tracking/hands.ts'
import { Tracker } from './tracking/landmarker.ts'
import { updateHandHover } from './ui/hand-press.ts'
import { setHint } from './ui/messages.ts'

/** Boot: wires input (camera hands, mouse) → gestures and plucking, and runs the frame loop. */

function byId<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id)
  if (!(el instanceof type)) throw new Error(`Missing #${id}`)
  return el
}

const canvas = byId('stage', HTMLCanvasElement)
const maybe2d = canvas.getContext('2d')
if (!maybe2d) throw new Error('This browser can’t draw on a canvas.')
const g2d: CanvasRenderingContext2D = maybe2d
const ctx = createApp(canvas, byId('top', HTMLElement))
mountFeatures(ctx)

const tracker = new Tracker(byId('cam', HTMLVideoElement))
const hands = new HandTracker()
const mouse = { pos: null as Vec | null, down: false }

// ── layout: the stage keeps its aspect ratio, letterboxed, drawn at device resolution ──
function layout(): void {
  const { width: W, height: H } = ctx.stage.state
  const scale = Math.min(innerWidth / W, innerHeight / H)
  const cssW = Math.round(W * scale)
  const cssH = Math.round(H * scale)
  const dpr = Math.min(devicePixelRatio || 1, 2)
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
}
addEventListener('resize', layout)
ctx.stage.changes.subscribe((c) => {
  if (c.type === 'size' || c.type === 'loaded') layout()
})
layout()

// ── hands → gestures ──
const handPointer = (id: number, pos: Vec): { id: string; kind: 'hand'; pos: Vec } => ({
  id: `h${id}`,
  kind: 'hand',
  pos,
})
const handEvents: HandEvents = {
  pinchDown: (h) => {
    ctx.strings.forget(`h${h.id}-`)
    ctx.gestures.pinchStart(handPointer(h.id, h.cursor))
  },
  pinchMove: (h) => {
    ctx.gestures.pinchMove(handPointer(h.id, h.cursor))
  },
  pinchUp: (h) => {
    ctx.gestures.pinchEnd(`h${h.id}`)
  },
  lost: (h) => {
    ctx.gestures.cancel(`h${h.id}`)
    ctx.strings.forget(`h${h.id}-`)
  },
}

// ── mouse (and touch): press = pinch, hover sweeps pluck ──
canvas.addEventListener('pointerdown', (e) => {
  if (ctx.app.state.input === 'idle') return
  ctx.unlockAudio()
  const pos = ctx.toStage(e.clientX, e.clientY)
  mouse.pos = pos
  mouse.down = true
  ctx.strings.forget('mouse')
  try {
    canvas.setPointerCapture(e.pointerId)
  } catch {
    // Capture is a nicety; dragging still works without it.
  }
  ctx.gestures.pinchStart({ id: 'mouse', kind: 'mouse', pos })
})
canvas.addEventListener('pointermove', (e) => {
  const pos = ctx.toStage(e.clientX, e.clientY)
  mouse.pos = pos
  if (mouse.down) ctx.gestures.pinchMove({ id: 'mouse', kind: 'mouse', pos })
})
const mouseUp = (): void => {
  if (!mouse.down) return
  mouse.down = false
  ctx.strings.forget('mouse')
  ctx.gestures.pinchEnd('mouse')
}
canvas.addEventListener('pointerup', mouseUp)
canvas.addEventListener('pointercancel', mouseUp)
canvas.addEventListener('pointerleave', () => {
  if (mouse.down) return
  mouse.pos = null
  ctx.strings.forget('mouse')
})
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') ctx.picker.close()
})

// ── the start dialog ──
const startModal = byId('start-modal', HTMLElement)
const status = byId('start-status', HTMLElement)
const startCamera = byId('start-camera', HTMLButtonElement)
const startMouse = byId('start-mouse', HTMLButtonElement)
const closeStart = (): void => {
  startModal.classList.remove('open')
}
startCamera.addEventListener('click', () => {
  ctx.unlockAudio()
  startCamera.disabled = true
  tracker
    .start((m) => {
      status.textContent = m
    })
    .then(() => {
      ctx.app.setInput('camera')
      closeStart()
    })
    .catch((err: unknown) => {
      console.error(err)
      startCamera.disabled = false
      const name = err instanceof DOMException ? err.name : ''
      status.textContent =
        name === 'NotAllowedError'
          ? 'The camera is blocked. Allow it in the address bar, or play with the mouse.'
          : `The camera didn’t start: ${err instanceof Error ? err.message : String(err)}`
    })
})
startMouse.addEventListener('click', () => {
  ctx.unlockAudio()
  ctx.app.setInput('mouse')
  closeStart()
})

// ── the frame loop ──
let lastT = ctx.now()
let fps = 0
let fpsFrames = 0
let fpsT = lastT
let failed = false

function frame(): void {
  requestAnimationFrame(frame)
  const t = ctx.now()
  const dt = Math.min(t - lastT, 0.1)
  lastT = t
  fpsFrames++
  if (t - fpsT > 1) {
    fps = Math.round(fpsFrames / (t - fpsT))
    fpsFrames = 0
    fpsT = t
  }
  try {
    step(t, dt)
  } catch (err) {
    console.error(err)
    if (!failed) {
      failed = true
      ctx.toast(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`, 6000)
    }
  }
}

function step(t: number, dt: number): void {
  const input = ctx.app.state.input
  const sens = ctx.settings.state.pinchSensitivity
  if (input === 'camera') {
    const dets = tracker.detect(t, ctx.stage.state)
    if (dets) hands.update(dets, t, sens, handEvents)
  }
  if (input !== 'idle' && !ctx.picker.open) pluckAll(t)
  const pointing = point(t)
  setHint(hint(ctx))
  draw(t, dt, pointing)
}

/** Plucking: open hands' fingertips, and the mouse while it hovers. */
function pluckAll(t: number): void {
  const settings = ctx.settings.state
  const tips = settings.allFingers ? PLUCKING_TIPS : ([8] as const)
  for (const h of hands.hands) {
    if (!hands.canPluck(h, t, settings.pinchSensitivity)) continue
    for (const k of tips) {
      const p = h.landmarks[k]
      if (p) ctx.strings.feed(`h${h.id}-${k}`, p)
    }
  }
  if (mouse.pos && !mouse.down) ctx.strings.feed('mouse', mouse.pos)
}

/** Pointing: the picker highlights (and auditions) what's pointed at; HTML buttons light up. */
function point(t: number): Vec[] {
  const pointing: Vec[] = []
  for (const h of hands.hands) {
    const tip = h.landmarks[8]
    if (tip) pointing.push(tip)
    if (h.pinch.pinching) pointing.push(h.cursor)
  }
  if (mouse.pos) pointing.push(mouse.pos)
  const fresh = ctx.picker.updateHover(pointing)
  if (fresh && t - (ctx.picker.open?.openedAt ?? t) > 0.3) ctx.previewInstrument(fresh)
  updateHandHover(hands.hands.map((h) => ctx.toClient(h.cursor)))
  return pointing
}

function draw(t: number, dt: number, pointing: Vec[]): void {
  const settings = ctx.settings.state
  const handViews: HandView[] = hands.hands.map((h) => ({
    landmarks: h.landmarks,
    cursor: h.cursor,
    ratio: h.ratio,
    pinching: h.pinch.pinching,
  }))
  const k = canvas.width / ctx.stage.state.width
  g2d.setTransform(k, 0, 0, k, 0, 0)
  renderFrame(g2d, {
    t,
    dt,
    stage: ctx.stage.state,
    settings,
    runtime: (id) => ctx.strings.runtime(id),
    label: (s) => ctx.strings.labelOf(s),
    video: ctx.app.state.input === 'camera' ? tracker.video : null,
    previews: ctx.gestures.previews(),
    waiting: ctx.gestures.waiting(),
    dragging: ctx.gestures.dragging(),
    hands: handViews,
    pointers: pointing,
    picker: ctx.picker.open,
    pickerCurrent: pickerCurrent(ctx),
    effects: ctx.effects,
    safeTop: ctx.safeTop(),
    debugLines: settings.debug ? debugLines() : [],
  })
}

function debugLines(): string[] {
  const sens = ctx.settings.state.pinchSensitivity
  return [
    `draw ${fps} fps · tracker ${tracker.fps} fps ${tracker.delegate} · ${hands.hands.length} hands`,
    ...hands.hands.map(
      (h) =>
        `hand ${h.id}: ${h.ratio.toFixed(2)} (closes below ${(0.3 * sens).toFixed(2)}) ${h.pinch.pinching ? 'PINCHED' : 'open'}`,
    ),
  ]
}

function pickerCurrent(c: AppContext): InstrumentId | null {
  const target = c.picker.open?.target
  if (!target) return null
  if (target.kind === 'new-strings') return c.stage.state.newStringInstrument
  return c.stage.find(target.id)?.instrument ?? null
}

function hint(c: AppContext): string {
  const input = c.app.state.input
  if (input === 'idle') return ''
  const handsOn = input === 'camera'
  const build = c.app.state.mode === 'build'
  if (c.picker.open)
    return handsOn ? 'Pinch an instrument to pick it. Pinch outside to close.' : 'Click an instrument to pick it.'
  if (c.gestures.previews().length > 0)
    return handsOn ? 'Pull your hands apart, then let go.' : 'Let go to place the string.'
  if (c.gestures.waiting().length > 0) return 'Now pinch with your other hand too, and pull them apart.'
  if (c.stage.state.strings.length === 0) {
    if (!build) return 'Switch to Build to make strings.'
    return handsOn
      ? 'Pinch with both hands, pull them apart, and let go to stretch a string.'
      : 'Drag anywhere to draw a string.'
  }
  const plucks = c.strings.plucks
  if (plucks < 3)
    return handsOn ? 'Sweep a fingertip across a string to play it.' : 'Sweep the pointer across a string to play it.'
  if (plucks < 14 && build) {
    return handsOn
      ? 'Pinch an end to move it, or the middle to change the instrument.'
      : 'Drag an end to move it. Click the middle to change the instrument.'
  }
  return ''
}

// For automated checks and debugging in the console.
Object.assign(window, { __airguitar: ctx })

requestAnimationFrame(frame)
