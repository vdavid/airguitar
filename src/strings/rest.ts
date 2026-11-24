import { clamp } from '../geom.ts'

/**
 * Resting a finger on a string (Music Maker's "hold"): a pointer that stays on a string, instead
 * of sweeping across it, holds it. Sustaining instruments sing for as long as it stays, mallets and
 * drums roll, the rest sound once. Sliding along the string keeps the hold; moving clearly off it,
 * or the pointer vanishing, ends it.
 *
 * "Stays" is short (`REST_AFTER`) so it feels like touching, not waiting: a kid's finger that lands
 * on a string holds it without trying. One tracker per string, keyed by pointer id. Pure: the
 * player feeds it geometry and acts on the events.
 */

/** A pointer this close to the line (stage units) can start resting. */
export const REST_IN = 10
/** A resting pointer leaves the string past this distance. */
export const REST_OUT = 22
/** Seconds on the string before it counts as resting. */
export const REST_AFTER = 0.14
/** A dwell not fed for this long starts over (the pointer left and came back). */
export const REST_GAP = 0.2
/** A hold whose pointer isn't seen for this long ends (the hand was lost or stopped plucking). */
export const REST_LOST = 0.3
/** Rests don't start this close (stage units) to the middle badge, where pinches land. */
export const BADGE_CLEAR = 26

export interface RestGeometry {
  /** Signed distance from the line. */
  readonly d: number
  /** Where along the string, 0..1 from `a` (unclamped). */
  readonly u: number
  /** The string's length. */
  readonly length: number
}

export type RestEvent =
  | { readonly type: 'start'; readonly u: number }
  | { readonly type: 'move'; readonly u: number }
  | { readonly type: 'end' }
  | null

interface Dwell {
  readonly t0: number
  last: number
}

interface Hold {
  u: number
  seen: number
}

export class RestTracker {
  private readonly dwells = new Map<string, Dwell>()
  private readonly holds = new Map<string, Hold>()

  /**
   * Feeds one pointer's position relative to this string. `canStart` is false when a rest
   * shouldn't begin (a newborn string, or one being bent).
   */
  feed(pointer: string, g: RestGeometry, t: number, canStart: boolean): RestEvent {
    const hold = this.holds.get(pointer)
    if (hold) {
      hold.seen = t
      if (Math.abs(g.d) > REST_OUT || g.u < -0.04 || g.u > 1.04) {
        this.holds.delete(pointer)
        return { type: 'end' }
      }
      hold.u = clamp(g.u, 0, 0.999)
      return { type: 'move', u: hold.u }
    }
    const onString =
      canStart && Math.abs(g.d) < REST_IN && g.u > 0.05 && g.u < 0.95 && Math.abs(g.u - 0.5) * g.length > BADGE_CLEAR
    if (!onString) {
      this.dwells.delete(pointer)
      return null
    }
    const dwell = this.dwells.get(pointer)
    if (!dwell || t - dwell.last > REST_GAP) {
      this.dwells.set(pointer, { t0: t, last: t })
      return null
    }
    dwell.last = t
    if (t - dwell.t0 < REST_AFTER) return null
    this.dwells.delete(pointer)
    const u = clamp(g.u, 0, 0.999)
    this.holds.set(pointer, { u, seen: t })
    return { type: 'start', u }
  }

  isHolding(pointer: string): boolean {
    return this.holds.has(pointer)
  }

  /** The current holds: pointer id → where along the string. */
  current(): [pointer: string, u: number][] {
    return [...this.holds].map(([p, h]) => [p, h.u])
  }

  /** Ends holds whose pointer hasn't been seen lately. Returns the pointers whose hold ended. */
  expire(t: number): string[] {
    const ended: string[] = []
    for (const [p, h] of this.holds) {
      if (t - h.seen > REST_LOST) {
        this.holds.delete(p)
        ended.push(p)
      }
    }
    return ended
  }

  /** Forgets pointers whose id starts with `prefix`. Returns the pointers whose hold ended. */
  forget(prefix: string): string[] {
    for (const p of [...this.dwells.keys()]) if (p.startsWith(prefix)) this.dwells.delete(p)
    const ended = [...this.holds.keys()].filter((p) => p.startsWith(prefix))
    for (const p of ended) this.holds.delete(p)
    return ended
  }

  /** Ends every hold. Returns the pointers whose hold ended. */
  clear(): string[] {
    const ended = [...this.holds.keys()]
    this.holds.clear()
    this.dwells.clear()
    return ended
  }
}
