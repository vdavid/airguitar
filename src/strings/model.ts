import { dist, distanceToLine, midpoint, type Vec } from '../geom.ts'
import type { StageString } from '../state/stage.ts'

/**
 * Hit tests and rules on the strings of a stage. Pure functions over `StageString`s; the store
 * applies the changes.
 */

/** How close (stage units) a pointer must be to grab things. Hands are less precise than a mouse. */
export interface Reach {
  readonly endpoint: number
  readonly middle: number
  readonly body: number
}
export const HAND_REACH: Reach = { endpoint: 36, middle: 34, body: 16 }
export const MOUSE_REACH: Reach = { endpoint: 16, middle: 15, body: 7 }

/** Dropping an end within this distance of the string's other end deletes the string. */
export const MERGE_RADIUS = 36
/** A new string must be at least this long (stage units). */
export const MIN_NEW_LENGTH = { hand: 90, mouse: 60 } as const

export const stringLength = (s: StageString): number => dist(s.a, s.b)
export const stringMiddle = (s: StageString): Vec => midpoint(s.a, s.b)

export interface EndpointHit {
  readonly string: StageString
  readonly end: 'a' | 'b'
}

/** The closest endpoint within `radius`, if any. */
export function nearestEndpoint(strings: readonly StageString[], p: Vec, radius: number): EndpointHit | null {
  let best: EndpointHit | null = null
  let bestD = radius
  for (const string of strings) {
    for (const end of ['a', 'b'] as const) {
      const d = dist(p, string[end])
      if (d < bestD) {
        bestD = d
        best = { string, end }
      }
    }
  }
  return best
}

/** The string whose middle (its instrument badge) is closest, within `radius`. */
export function nearestMiddle(strings: readonly StageString[], p: Vec, radius: number): StageString | null {
  let best: StageString | null = null
  let bestD = radius
  for (const s of strings) {
    const d = dist(p, stringMiddle(s))
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best
}

/** The closest point on a string's body (away from its very ends), within `radius`. */
export function nearestBody(
  strings: readonly StageString[],
  p: Vec,
  radius: number,
): { string: StageString; u: number } | null {
  let best: { string: StageString; u: number } | null = null
  let bestD = radius
  for (const string of strings) {
    const { distance, t } = distanceToLine(string.a, string.b, p)
    if (t < 0.06 || t > 0.94) continue
    if (distance < bestD) {
      bestD = distance
      best = { string, u: t }
    }
  }
  return best
}

/**
 * In modes that can't delete (Mixed), a dragged end stays at least this far from the other end:
 * the shortest string the mouse can make, well outside `MERGE_RADIUS`.
 */
export const MIN_KEPT_LENGTH = MIN_NEW_LENGTH.mouse

/**
 * Where a dragged end goes when the string must keep `min` length: `to` if that's far enough from
 * the `fixed` end, else pushed out along its direction from `fixed` (or `prev`'s, the end's last
 * position, when `to` sits right on `fixed`).
 */
export function keepApart(fixed: Vec, to: Vec, prev: Vec, min = MIN_KEPT_LENGTH): Vec {
  const d = dist(fixed, to)
  if (d >= min) return to
  let dir = d > 1e-6 ? to : prev
  if (dist(fixed, dir) <= 1e-6) dir = { x: fixed.x + 1, y: fixed.y }
  const len = dist(fixed, dir)
  return { x: fixed.x + ((dir.x - fixed.x) / len) * min, y: fixed.y + ((dir.y - fixed.y) / len) * min }
}

/** True when the string's ends sit on each other: the drop that deletes it. */
export function isMerged(s: StageString, radius = MERGE_RADIUS): boolean {
  return stringLength(s) < radius
}
