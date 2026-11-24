/** Small 2D geometry helpers. Coordinates are stage units unless a name says otherwise. */

export interface Vec {
  readonly x: number
  readonly y: number
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpVec(a: Vec, b: Vec, t: number): Vec {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
}

export function midpoint(a: Vec, b: Vec): Vec {
  return lerpVec(a, b, 0.5)
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Where `p` projects onto `a`→`b`, as a fraction of its length (unclamped). */
export function projectT(a: Vec, b: Vec, p: Vec): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return 0
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
}

/** Distance from `p` to the segment `a`→`b` (clamped to its ends), plus where along it. */
export function distanceToSegment(a: Vec, b: Vec, p: Vec): { distance: number; t: number } {
  const t = clamp(projectT(a, b, p), 0, 1)
  return { distance: dist(p, lerpVec(a, b, t)), t }
}

/** Distance from `p` to the infinite line through `a`→`b`, plus where along it (unclamped). */
export function distanceToLine(a: Vec, b: Vec, p: Vec): { distance: number; t: number } {
  const t = projectT(a, b, p)
  return { distance: dist(p, lerpVec(a, b, t)), t }
}
