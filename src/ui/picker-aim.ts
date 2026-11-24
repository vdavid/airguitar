import type { Vec } from '../geom.ts'

/**
 * Where each hand aims in the picker, pure. One point does both hover and pick: the pinch point
 * (thumb–index midpoint), lightly smoothed. Closing a pinch moves that point (the finger and thumb
 * travel to meet), so a pinch counts for where the hand aimed just before it closed: `latched`
 * looks back to the moment the thumb–index gap started closing, at least `LATCH_BACK` and at most
 * `LATCH_MAX` seconds. Fed once per tracker frame with the hand's pinch point and pinch ratio.
 */

/** Smoothing time constant (seconds): light, so the cursor still feels attached to the hand. */
export const AIM_SMOOTH = 0.04
/** A pinch counts for the aim at least this long (seconds) before it was detected. */
export const LATCH_BACK = 0.1
/** …and never further back than this. */
export const LATCH_MAX = 0.3
/** Ratio rises smaller than this still count as "closing" (tracker noise). */
const RATIO_NOISE = 0.02
const KEEP = 0.5

interface Sample {
  readonly t: number
  readonly aim: Vec
  readonly ratio: number
}

export class PickerAim {
  private readonly samples = new Map<string, Sample[]>()

  /** One tracker frame for hand `id`: its pinch point and thumb–index ratio. Returns the new aim. */
  feed(id: string, t: number, point: Vec, ratio: number): Vec {
    const list = this.samples.get(id) ?? []
    const prev = list.at(-1)
    const a = prev ? 1 - Math.exp(-Math.max(t - prev.t, 0) / AIM_SMOOTH) : 1
    const aim = prev
      ? { x: prev.aim.x + a * (point.x - prev.aim.x), y: prev.aim.y + a * (point.y - prev.aim.y) }
      : point
    list.push({ t, aim, ratio })
    while (list.length > 2 && (list[0]?.t ?? t) < t - KEEP) list.shift()
    this.samples.set(id, list)
    return aim
  }

  /** The hand's current (smoothed) aim. */
  aim(id: string): Vec | null {
    return this.samples.get(id)?.at(-1)?.aim ?? null
  }

  /** Where a pinch by hand `id` detected at `t` was aimed: from just before the gap began to close. */
  latched(id: string, t: number): Vec | null {
    const list = this.samples.get(id)
    const last = list?.at(-1)
    if (!list || !last) return null
    // The closing started at the last moment the gap was (about) its widest in the window.
    const window = list.filter((s) => s.t >= t - LATCH_MAX - 1e-9)
    const widest = Math.max(...window.map((s) => s.ratio))
    let opened = window[0]?.t ?? last.t
    for (const s of window) if (s.ratio >= widest - RATIO_NOISE) opened = s.t
    const from = Math.max(Math.min(opened, t - LATCH_BACK), t - LATCH_MAX)
    let pick = list[0] ?? last
    for (const s of list) if (s.t <= from + 1e-9) pick = s
    return pick.aim
  }

  forget(id: string): void {
    this.samples.delete(id)
  }

  /** Drops every hand not in `ids` (hands the tracker lost). */
  retain(ids: Iterable<string>): void {
    const keep = new Set(ids)
    for (const id of [...this.samples.keys()]) if (!keep.has(id)) this.samples.delete(id)
  }
}
