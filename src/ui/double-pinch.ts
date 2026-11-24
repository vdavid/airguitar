/**
 * The picker's double pinch, pure. A tile is chosen by two pinches on the same tile (same hand or
 * any hand), the second starting `DOUBLE_PINCH_MIN`–`DOUBLE_PINCH_MAX` seconds after the first
 * started. The first pinch "arms" the tile; the arm clears after `DOUBLE_PINCH_MAX`, or when a hand
 * moves onto another tile and none stays on the armed one.
 *
 * Two guards keep one shaky pinch from counting twice (on top of `gestures/pinch.ts`'s hysteresis):
 * - a second pinch sooner than `DOUBLE_PINCH_MIN` is ignored (the arm keeps its time);
 * - a pinch starting within `MIN_RELEASE` of the same hand letting go is the same pinch flickering
 *   open in the tracker, so it's ignored too.
 *
 * Times are seconds on one clock (`AppContext.now`). The mouse doesn't use this: a click picks.
 */

export const DOUBLE_PINCH_MIN = 0.12
export const DOUBLE_PINCH_MAX = 1.2
/** A hand must stay open this long between its two pinches; a shorter gap is tracking jitter. */
export const MIN_RELEASE = 0.1
/** Float slack so 0.12 s and 1.2 s land inside the window on any clock value. */
const EPS = 1e-6

export interface Armed<T> {
  readonly tile: T
  readonly at: number
}

export type DoublePinchResult = 'armed' | 'chosen' | 'ignored'

export class DoublePinch<T> {
  private current: Armed<T> | null = null
  private readonly releasedAt = new Map<string, number>()

  get armed(): Armed<T> | null {
    return this.current
  }

  /** A pinch by `pointer` started on `tile` at `t`. */
  pinch(pointer: string, tile: T, t: number): DoublePinchResult {
    const up = this.releasedAt.get(pointer)
    if (up !== undefined && t - up < MIN_RELEASE - EPS) return 'ignored'
    const armed = this.current
    if (armed?.tile === tile) {
      const dt = t - armed.at
      if (dt < DOUBLE_PINCH_MIN - EPS) return 'ignored'
      if (dt <= DOUBLE_PINCH_MAX + EPS) {
        this.current = null
        return 'chosen'
      }
    }
    this.current = { tile, at: t }
    return 'armed'
  }

  /** `pointer`'s pinch ended (or its hand was lost) at `t`. */
  release(pointer: string, t: number): void {
    this.releasedAt.set(pointer, t)
  }

  /**
   * Per frame: `hovered` is the tile under each pointer (null when on no tile). Clears an expired
   * arm, or one every hand left for another tile. Returns the arm still standing.
   */
  update(t: number, hovered: readonly (T | null)[]): Armed<T> | null {
    const armed = this.current
    if (!armed) return null
    const left = !hovered.includes(armed.tile) && hovered.some((h) => h !== null)
    if (t - armed.at > DOUBLE_PINCH_MAX + EPS || left) this.current = null
    return this.current
  }

  /** Drops the arm (the picker opened or closed). Release times stay: a flicker is still a flicker. */
  reset(): void {
    this.current = null
  }
}
