import { clamp, lerp, type Vec } from '../geom.ts'

/**
 * Plucking by crossing: each (pointer, string) pair remembers which side of the string the
 * pointer was last clearly on. When it turns up clearly on the other side, having crossed between
 * the ends, that's a pluck. A thin band either side of the string absorbs tracking jitter, and a
 * slow crossing still counts.
 */

/** Pointers within this many stage units of the line count as "on it", neither side. */
export const DEAD_ZONE = 3
/** A memory older than this (seconds) is stale: the pointer went away and came back. */
export const STALE_AFTER = 0.45
/** A jump bigger than this fraction of the stage width is a tracking glitch, not a sweep. */
export const MAX_JUMP = 0.3
/** One pointer can't pluck the same string again within this many seconds. */
export const COOLDOWN = 0.11

export interface SideMemory {
  readonly side: 1 | -1
  /** Signed distance to the line. */
  readonly d: number
  readonly at: Vec
  readonly t: number
}

export interface Crossing {
  /** Where along the string, 0..1 from `a`. */
  readonly u: number
  readonly point: Vec
  /** Pointer speed in stage units per second. */
  readonly speed: number
  /** Which side the pointer came from (+1 or -1). */
  readonly from: 1 | -1
}

/**
 * Feeds a pointer's new position against string a→b. Returns the memory to keep and the crossing,
 * if this move plucked it.
 */
export function sweep(
  memory: SideMemory | undefined,
  a: Vec,
  b: Vec,
  p: Vec,
  t: number,
  stageWidth: number,
): { memory: SideMemory | undefined; crossing: Crossing | null } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1) return { memory, crossing: null }
  const d = ((p.x - a.x) * dy - (p.y - a.y) * dx) / Math.sqrt(len2)
  if (Math.abs(d) < DEAD_ZONE) return { memory, crossing: null }
  const side: 1 | -1 = d > 0 ? 1 : -1
  const next: SideMemory = { side, d, at: { x: p.x, y: p.y }, t }
  if (
    !memory ||
    t - memory.t > STALE_AFTER ||
    Math.hypot(p.x - memory.at.x, p.y - memory.at.y) > stageWidth * MAX_JUMP
  ) {
    return { memory: next, crossing: null }
  }
  if (memory.side === side) return { memory: next, crossing: null }
  // Where the pointer's path crossed the line, then where that is along the string.
  const k = memory.d / (memory.d - d)
  const x = { x: lerp(memory.at.x, p.x, k), y: lerp(memory.at.y, p.y, k) }
  const u = ((x.x - a.x) * dx + (x.y - a.y) * dy) / len2
  if (u < 0 || u > 1) return { memory: next, crossing: null }
  const speed = Math.hypot(p.x - memory.at.x, p.y - memory.at.y) / Math.max(t - memory.t, 0.008)
  return { memory: next, crossing: { u, point: x, speed, from: memory.side } }
}

/** Pluck strength 0.3..1 from pointer speed: a gentle sweep is soft, a fast strum is loud. */
export function speedToVelocity(speed: number): number {
  return clamp(0.3 + speed / 2600, 0.3, 1)
}
