import { dist, midpoint, type Vec } from '../geom.ts'

/** MediaPipe hand landmark indices we use. */
export const WRIST = 0
export const THUMB_TIP = 4
export const INDEX_MCP = 5
export const INDEX_TIP = 8
export const MIDDLE_MCP = 9
export const PINKY_MCP = 17
export const PLUCKING_TIPS = [8, 12, 16, 20] as const

/** Pinch closes below this thumb–index gap (relative to hand size) and opens above the second. */
export const PINCH_ON = 0.3
export const PINCH_OFF = 0.46
/** Above this the hand counts as open enough to pluck with. */
export const OPEN_HAND = 0.34
/** A pinch must hold (or release) for this many tracker frames in a row to count. */
export const CONFIRM_FRAMES = 2

/**
 * A scale-free hand size: wrist → middle knuckle, or the knuckle row (index → pinky) scaled up,
 * whichever is bigger. Two spans keep it steady when the hand turns and one foreshortens.
 */
export function handSize(lm: readonly Vec[]): number {
  const a = dist(lm[WRIST] ?? { x: 0, y: 0 }, lm[MIDDLE_MCP] ?? { x: 0, y: 0 })
  const b = dist(lm[INDEX_MCP] ?? { x: 0, y: 0 }, lm[PINKY_MCP] ?? { x: 0, y: 0 })
  return Math.max(a, b * 1.25, 1)
}

/** Thumb–index tip gap divided by hand size. Small means pinching. */
export function pinchRatio(lm: readonly Vec[]): number {
  return dist(lm[THUMB_TIP] ?? { x: 0, y: 0 }, lm[INDEX_TIP] ?? { x: 0, y: 0 }) / handSize(lm)
}

/** The point between thumb and index tips: the pinch cursor. */
export function pinchPoint(lm: readonly Vec[]): Vec {
  return midpoint(lm[THUMB_TIP] ?? { x: 0, y: 0 }, lm[INDEX_TIP] ?? { x: 0, y: 0 })
}

export interface PinchState {
  readonly pinching: boolean
  /** Consecutive frames the reading has disagreed with `pinching`. */
  readonly streak: number
}

export const OPEN: PinchState = { pinching: false, streak: 0 }

/**
 * Hysteresis plus a short confirmation: a pinch starts below PINCH_ON and ends above PINCH_OFF
 * (both scaled by `sensitivity`), each only after CONFIRM_FRAMES frames in a row, so one noisy
 * frame never flips it. Returns the new state and whether it just went down or up.
 */
export function updatePinch(
  prev: PinchState,
  ratio: number,
  sensitivity = 1,
): { state: PinchState; event: 'down' | 'up' | null } {
  const crossing = prev.pinching ? ratio > PINCH_OFF * sensitivity : ratio < PINCH_ON * sensitivity
  if (!crossing) return { state: { pinching: prev.pinching, streak: 0 }, event: null }
  const streak = prev.streak + 1
  if (streak < CONFIRM_FRAMES) return { state: { pinching: prev.pinching, streak }, event: null }
  return { state: { pinching: !prev.pinching, streak: 0 }, event: prev.pinching ? 'up' : 'down' }
}
