import { INSTRUMENTS, type InstrumentId } from '../audio/instruments/catalog.ts'
import type { Preview } from '../gestures/controller.ts'
import { clamp, dist, lerp, type Vec } from '../geom.ts'
import type { Settings } from '../state/settings.ts'
import type { StageState, StageString } from '../state/stage.ts'
import type { StringRuntime } from '../strings/player.ts'
import type { OpenPicker } from '../ui/picker.ts'
import type { Effects } from './effects.ts'
import { drawIcon } from './icons.ts'
import { drawPicker } from './picker.ts'
import { AMBER, hexA, INK, IVORY, label, TAU } from './style.ts'

/**
 * Draws one frame of the stage on the canvas, in stage units (the canvas transform maps them to
 * device pixels). Music Maker's look: ivory strings with a coloured glow that swells and ripples
 * when plucked, an instrument badge in the middle, spark particles, and floating note names.
 */

const HAND_BONES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
] as const

export interface HandView {
  readonly landmarks: readonly Vec[]
  readonly cursor: Vec
  /** While the picker is open: the hand's one aim point (`ui/picker-aim.ts`), drawn as its cursor. */
  readonly aim: Vec | null
  /** Thumb–index gap relative to hand size: drives the closing pinch ring. */
  readonly ratio: number
  readonly pinching: boolean
}

export interface FrameView {
  readonly t: number
  readonly dt: number
  readonly stage: StageState
  readonly settings: Settings
  readonly runtime: (id: number) => StringRuntime
  readonly label: (s: StageString) => string
  readonly video: HTMLVideoElement | null
  readonly previews: readonly Preview[]
  /** Hands pinching in empty air, waiting for a partner hand to stretch a string. */
  readonly waiting: readonly Vec[]
  /** Two hands' pinches armed to make a string (close together, not pulled apart yet). */
  readonly armed: readonly { readonly a: Vec; readonly b: Vec }[]
  readonly dragging: readonly { stringId: number; end: 'a' | 'b' }[]
  readonly hands: readonly HandView[]
  /** Points that count as "near" for showing labels (fingertips, the mouse). */
  readonly pointers: readonly Vec[]
  readonly picker: OpenPicker | null
  /** The instrument the picker's target plays now (outlined in the palette). */
  readonly pickerCurrent: InstrumentId | null
  /** Hands are on (the picker shows its "pinch twice" hint). */
  readonly pickerHands: boolean
  readonly effects: Effects
  readonly safeTop: number
  readonly debugLines: readonly string[]
}

export function renderFrame(g: CanvasRenderingContext2D, f: FrameView): void {
  drawBackdrop(g, f)
  for (const s of f.stage.strings) {
    const r = f.runtime(s.id)
    r.near = f.pointers.some((p) => distanceToString(p, s) < 90)
    drawString(g, s, r, f)
  }
  drawPreviews(g, f)
  f.effects.step(f.dt, f.t)
  drawParticles(g, f.effects)
  drawPops(g, f)
  if (f.picker) drawPicker(g, f.picker, f.t, f.pickerCurrent, f.pickerHands)
  drawHands(g, f)
  drawRipples(g, f)
  f.debugLines.forEach((line, i) => {
    label(g, line, 16, f.safeTop + 18 + i * 18, 12, '#8ff0c0', 'left', 500)
  })
}

function distanceToString(p: Vec, s: StageString): number {
  const dx = s.b.x - s.a.x
  const dy = s.b.y - s.a.y
  const len2 = dx * dx + dy * dy || 1
  const u = clamp(((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / len2, 0, 1)
  return Math.hypot(p.x - (s.a.x + dx * u), p.y - (s.a.y + dy * u))
}

function drawBackdrop(g: CanvasRenderingContext2D, f: FrameView): void {
  const { width: W, height: H } = f.stage
  const v = f.video
  if (v && v.readyState >= 2 && v.videoWidth > 0) {
    const sc = Math.max(W / v.videoWidth, H / v.videoHeight)
    const dw = v.videoWidth * sc
    const dh = v.videoHeight * sc
    g.save()
    g.translate(W, 0)
    g.scale(-1, 1)
    g.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh)
    g.restore()
    g.fillStyle = `rgba(8,10,14,${f.settings.cameraDim})`
    g.fillRect(0, 0, W, H)
    return
  }
  const gr = g.createLinearGradient(0, 0, 0, H)
  gr.addColorStop(0, '#0b0e13')
  gr.addColorStop(1, '#161b22')
  g.fillStyle = gr
  g.fillRect(0, 0, W, H)
  g.strokeStyle = 'rgba(255,255,255,0.03)'
  g.lineWidth = 1
  g.beginPath()
  for (let y = 60; y < H; y += 60) {
    g.moveTo(0, y + 0.5)
    g.lineTo(W, y + 0.5)
  }
  g.stroke()
}

function drawString(g: CanvasRenderingContext2D, s: StageString, r: StringRuntime, f: FrameView): void {
  const { t } = f
  const col = INSTRUMENTS[s.instrument].color
  const dx = s.b.x - s.a.x
  const dy = s.b.y - s.a.y
  const L = Math.hypot(dx, dy) || 1
  // The normal that points up the screen.
  let nx = -dy / L
  let ny = dx / L
  if (ny > 0) {
    nx = -nx
    ny = -ny
  }
  const age = t - r.vib.t0
  const amp = r.vib.amp * Math.exp(-age * 3)
  const live = amp > 0.35

  // A standing wave: the first four harmonics, weighted by where it was plucked.
  const trace = (k: number): void => {
    g.beginPath()
    // Pinched and pulled: two straight segments through the pinch.
    if (r.pull) {
      g.moveTo(s.a.x, s.a.y)
      g.lineTo(r.pull.x, r.pull.y)
      g.lineTo(s.b.x, s.b.y)
      return
    }
    if (!live) {
      g.moveTo(s.a.x, s.a.y)
      g.lineTo(s.b.x, s.b.y)
      return
    }
    const N = 44
    const p = r.vib.pos
    for (let i = 0; i <= N; i++) {
      const u = i / N
      let d = 0
      for (let h = 1; h <= 4; h++) {
        d += (Math.sin(h * Math.PI * p) / (h * h)) * Math.sin(h * Math.PI * u) * Math.cos(h * age * 36)
      }
      d *= amp * 1.25 * k
      const x = s.a.x + dx * u + nx * d
      const y = s.a.y + dy * u + ny * d
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
  }

  g.lineCap = 'round'
  g.save()
  g.globalCompositeOperation = 'lighter'
  const glow = live ? clamp(amp / 14, 0.25, 1) : 0
  trace(1)
  g.strokeStyle = hexA(col, 0.1 + 0.16 * glow)
  g.lineWidth = 7 + 9 * glow
  g.stroke()
  trace(1)
  g.strokeStyle = hexA(col, 0.22 + 0.3 * glow)
  g.lineWidth = 3.5 + 2.5 * glow
  g.stroke()
  if (live) {
    g.strokeStyle = hexA(col, 0.22)
    g.lineWidth = 1.2
    for (const k of [-1, 0.55, -0.55]) {
      trace(k)
      g.stroke()
    }
  }
  g.restore()
  trace(1)
  g.strokeStyle = IVORY
  g.lineWidth = 1.8
  g.stroke()

  // A flash of colour that spreads from where it was plucked.
  const fa = t - r.flash.t
  if (r.flash.u >= 0 && fa < 0.35) {
    const spread = 0.08 + fa * 0.6
    const u0 = clamp(r.flash.u - spread, 0, 1)
    const u1 = clamp(r.flash.u + spread, 0, 1)
    g.strokeStyle = hexA(col, 0.8 * (1 - fa / 0.35))
    g.lineWidth = 5
    g.beginPath()
    g.moveTo(s.a.x + dx * u0, s.a.y + dy * u0)
    g.lineTo(s.a.x + dx * u1, s.a.y + dy * u1)
    g.stroke()
  }

  // End caps; a dragged end gets a ring, and a ring on the other end shows where to drop to delete.
  g.strokeStyle = IVORY
  g.lineWidth = 2.2
  g.beginPath()
  for (const e of [s.a, s.b]) {
    g.moveTo(e.x - nx * 10, e.y - ny * 10)
    g.lineTo(e.x + nx * 10, e.y + ny * 10)
  }
  g.stroke()
  g.fillStyle = IVORY
  g.beginPath()
  g.arc(s.a.x, s.a.y, 3.6, 0, TAU)
  g.fill()
  const drag = f.dragging.find((d) => d.stringId === s.id)
  if (drag) {
    const held = s[drag.end]
    const other = drag.end === 'a' ? s.b : s.a
    g.strokeStyle = col
    g.lineWidth = 2.5
    g.beginPath()
    g.arc(held.x, held.y, 14, 0, TAU)
    g.stroke()
    const close = clamp(1 - (dist(held, other) - 36) / 120, 0, 1)
    if (close > 0) {
      g.strokeStyle = hexA('#ff6b6b', 0.35 + 0.6 * close)
      g.setLineDash([4, 4])
      g.beginPath()
      g.arc(other.x, other.y, 36, 0, TAU)
      g.stroke()
      g.setLineDash([])
    }
  }

  // The badge: the instrument's icon in the middle of the string.
  const mx = (s.a.x + s.b.x) / 2
  const my = (s.a.y + s.b.y) / 2
  const fresh = clamp(1 - (t - r.born) / 0.6, 0, 1)
  const dr = 14 + fresh * 9 + (r.near ? 1.5 + Math.sin(t * 6) * 1.2 : 0)
  g.fillStyle = 'rgba(8,10,14,0.9)'
  g.beginPath()
  g.arc(mx, my, dr, 0, TAU)
  g.fill()
  g.strokeStyle = hexA(col, r.near ? 1 : 0.75)
  g.lineWidth = 1.8
  g.beginPath()
  g.arc(mx, my, dr, 0, TAU)
  g.stroke()
  drawIcon(g, s.instrument, col, mx, my, 19)

  if (f.settings.showLabels && (r.near || t - r.touched < 2.6 || drag) && !f.picker) {
    label(g, `${INSTRUMENTS[s.instrument].name} · ${f.label(s)}`, mx + nx * 31, my + ny * 31, 13, col)
  }
}

function drawPreviews(g: CanvasRenderingContext2D, f: FrameView): void {
  for (const p of f.previews) {
    g.save()
    g.setLineDash([7, 7])
    g.lineWidth = 2
    g.strokeStyle = p.ok ? IVORY : 'rgba(251,246,233,0.4)'
    g.beginPath()
    g.moveTo(p.a.x, p.a.y)
    g.lineTo(p.b.x, p.b.y)
    g.stroke()
    g.restore()
    g.fillStyle = IVORY
    for (const e of [p.a, p.b]) {
      g.beginPath()
      g.arc(e.x, e.y, 5, 0, TAU)
      g.fill()
    }
  }
  // A hand waiting for a partner: a soft pulsing dot.
  for (const w of f.waiting) {
    g.strokeStyle = hexA('#fbf6e9', 0.35 + 0.25 * Math.sin(f.t * 5))
    g.lineWidth = 1.5
    g.setLineDash([3, 5])
    g.beginPath()
    g.arc(w.x, w.y, 22, 0, TAU)
    g.stroke()
    g.setLineDash([])
  }
  // An armed pair: a soft amber glow between the two pinches, so the "close together" step is learnable.
  for (const p of f.armed) {
    const mx = (p.a.x + p.b.x) / 2
    const my = (p.a.y + p.b.y) / 2
    const r = 26 + Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y) / 2
    const glow = g.createRadialGradient(mx, my, 0, mx, my, r)
    glow.addColorStop(0, hexA(AMBER, 0.4 + 0.1 * Math.sin(f.t * 6)))
    glow.addColorStop(1, hexA(AMBER, 0))
    g.fillStyle = glow
    g.beginPath()
    g.arc(mx, my, r, 0, TAU)
    g.fill()
  }
}

function drawParticles(g: CanvasRenderingContext2D, effects: Effects): void {
  g.save()
  g.globalCompositeOperation = 'lighter'
  g.lineWidth = 1.6
  for (const p of effects.particles) {
    const k = 1 - p.age / p.life
    g.strokeStyle = hexA(p.color, 0.9 * k)
    g.beginPath()
    g.moveTo(p.x, p.y)
    g.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025)
    g.stroke()
  }
  g.restore()
}

function drawPops(g: CanvasRenderingContext2D, f: FrameView): void {
  for (const p of f.effects.pops) {
    const k = (f.t - p.t) / 0.9
    g.globalAlpha = 1 - k * k
    label(g, p.text, p.x, p.y - 34 * k, 17, p.color, 'center', 700)
  }
  g.globalAlpha = 1
}

function drawHands(g: CanvasRenderingContext2D, f: FrameView): void {
  const sens = f.settings.pinchSensitivity
  const tips = f.settings.allFingers ? [8, 12, 16, 20] : [8]
  for (const h of f.hands) {
    const lm = h.landmarks
    if (f.settings.showSkeleton) {
      g.strokeStyle = 'rgba(251,246,233,0.34)'
      g.lineWidth = 1.6
      g.lineCap = 'round'
      g.beginPath()
      for (const [a, b] of HAND_BONES) {
        const pa = lm[a]
        const pb = lm[b]
        if (!pa || !pb) continue
        g.moveTo(pa.x, pa.y)
        g.lineTo(pb.x, pb.y)
      }
      g.stroke()
      g.fillStyle = 'rgba(251,246,233,0.75)'
      for (const p of lm) {
        g.beginPath()
        g.arc(p.x, p.y, 2.1, 0, TAU)
        g.fill()
      }
    }
    // In the picker only the aim point counts, so the fingertip rings would just mislead.
    if (!h.pinching && !h.aim) {
      g.strokeStyle = IVORY
      g.lineWidth = 2
      for (const k of tips) {
        const p = lm[k]
        if (!p) continue
        g.beginPath()
        g.arc(p.x, p.y, 8, 0, TAU)
        g.stroke()
      }
    }
    // The pinch ring closes and fills as thumb and finger meet.
    const k = clamp(1 - (h.ratio - 0.3 * sens) / (0.7 * sens), 0, 1)
    const r = lerp(17, 7, k)
    g.strokeStyle = h.pinching ? '#ffc24a' : 'rgba(255,194,74,0.75)'
    g.lineWidth = h.pinching ? 3 : 1.6
    const c = h.aim ?? h.cursor
    g.beginPath()
    g.arc(c.x, c.y, r, 0, TAU)
    g.stroke()
    if (h.pinching) {
      g.fillStyle = '#ffc24a'
      g.beginPath()
      g.arc(c.x, c.y, 5, 0, TAU)
      g.fill()
    } else if (h.aim) {
      // The picker cursor: a small dot exactly where hover and pick are measured.
      g.fillStyle = IVORY
      g.strokeStyle = INK
      g.lineWidth = 1.5
      g.beginPath()
      g.arc(c.x, c.y, 3.5, 0, TAU)
      g.fill()
      g.stroke()
    }
  }
}

function drawRipples(g: CanvasRenderingContext2D, f: FrameView): void {
  for (const r of f.effects.ripples) {
    const k = (f.t - r.t) / 0.45
    g.strokeStyle = `rgba(255,194,74,${1 - k})`
    g.lineWidth = 2.5
    g.beginPath()
    g.arc(r.x, r.y, 10 + 34 * k, 0, TAU)
    g.stroke()
  }
}
