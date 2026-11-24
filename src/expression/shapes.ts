import { clamp, type Vec } from '../geom.ts'

/** The pure geometry behind the expression gestures: how far a pull bends, how far a sweep goes. */

/** A pull this far (stage units) from the string is the most it bends. */
export const PULL_MAX = 90
/** The bend at a full pull, in cents. */
export const BEND_CENTS = 200
/** Pulls closer than this don't bend at all (hand jitter while pinching). */
export const PULL_DEAD = 8
/** Letting go of a pull at least this deep snaps the string (it plays, with a twang). */
export const SNAP_MIN = 14

export interface Pull {
  /** Where the string is pulled to (the pinch, clamped to `PULL_MAX` off the line). */
  readonly point: Vec
  /** How far off the line, 0..`PULL_MAX`. */
  readonly depth: number
  /** The bend, in cents. Pulling either way raises the pitch, like a real string. */
  readonly cents: number
}

/** A pinch at `u` along string a→b, now at `p`. */
export function pullString(a: Vec, b: Vec, u: number, p: Vec): Pull {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const d = clamp(((p.x - a.x) * dy - (p.y - a.y) * dx) / len, -PULL_MAX, PULL_MAX)
  // The unit normal on the side that `d` measures as positive.
  const point = { x: a.x + dx * u + (dy / len) * d, y: a.y + dy * u - (dx / len) * d }
  const depth = Math.abs(d)
  const cents = depth <= PULL_DEAD ? 0 : ((depth - PULL_DEAD) / (PULL_MAX - PULL_DEAD)) * BEND_CENTS
  return { point, depth, cents }
}

/** How hard a let-go pull plucks: 0.35 for a shallow snap, 1 at a full pull. */
export function snapVelocity(depth: number): number {
  return clamp(0.35 + (depth / PULL_MAX) * 0.65, 0.35, 1)
}

export interface SweepAmounts {
  /** 0..1: dragging down darkens (lowers the lowpass). */
  readonly dark: number
  /** 0..1: dragging up thins (raises the highpass). */
  readonly thin: number
  /** 0..1: dragging sideways, either way, adds echo. */
  readonly echo: number
}

/** The air sweep (Music Maker's air pad): how far the pinch moved from where it started. */
export function sweepAmounts(from: Vec, to: Vec): SweepAmounts {
  const dy = to.y - from.y
  const dx = Math.abs(to.x - from.x)
  return {
    dark: clamp((dy - 20) / 240, 0, 1),
    thin: clamp((-dy - 20) / 240, 0, 1),
    echo: clamp((dx - 30) / 260, 0, 1),
  }
}
