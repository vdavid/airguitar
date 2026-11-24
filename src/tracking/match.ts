import { dist, type Vec } from '../geom.ts'

/**
 * MediaPipe returns hands in no fixed order. We match each new detection to the closest previous
 * hand by wrist position, so per-hand state (pinch, fingertip memory) stays with the right hand.
 */
export const MAX_MATCH_DISTANCE = 340

/**
 * Returns, for each detection, the index of the previous hand it continues, or -1 for a new hand.
 * Greedy closest-first, each previous hand used at most once.
 */
export function matchHands(previous: readonly Vec[], detections: readonly Vec[]): number[] {
  const pairs: { d: number; i: number; j: number }[] = []
  detections.forEach((det, i) => {
    previous.forEach((prev, j) => {
      const d = dist(det, prev)
      if (d <= MAX_MATCH_DISTANCE) pairs.push({ d, i, j })
    })
  })
  pairs.sort((p, q) => p.d - q.d)
  const result = detections.map(() => -1)
  const used = new Set<number>()
  for (const { i, j } of pairs) {
    if (result[i] !== -1 || used.has(j)) continue
    result[i] = j
    used.add(j)
  }
  return result
}

/**
 * The tracker sometimes reports one hand twice. Drops a detection whose wrist and index tip both
 * sit within `radius` of an earlier one's.
 */
export function dedupeHands(hands: readonly (readonly Vec[])[], radius = 70): (readonly Vec[])[] {
  const kept: (readonly Vec[])[] = []
  for (const h of hands) {
    const dup = kept.some((k) => {
      const [kw, kt, hw, ht] = [k[0], k[8], h[0], h[8]]
      return kw && kt && hw && ht && dist(kw, hw) < radius && dist(kt, ht) < radius
    })
    if (!dup) kept.push(h)
  }
  return kept
}
