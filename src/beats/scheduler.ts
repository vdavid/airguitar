/**
 * Look-ahead scheduling on the audio clock (the "tale of two clocks" pattern Music Maker uses): a
 * coarse JS timer calls `pump` every ~25 ms, and each call schedules every step that starts before
 * `now + lookahead` at its exact audio-clock time. Timer jitter then never reaches the sound.
 *
 * Pure timing math, no Web Audio, so it's unit-tested with a fake clock.
 */

/** Seconds per sixteenth note. */
export function stepDuration(bpm: number): number {
  return 60 / bpm / 4
}

/** Swing pushes every second sixteenth late by `swing` of a step. */
export function swingDelay(step: number, swing: number, bpm: number): number {
  return step % 2 === 1 ? swing * stepDuration(bpm) : 0
}

export const MIN_BPM = 50
export const MAX_BPM = 200

export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)))
}

export interface SchedulerOptions {
  /** How far ahead of `now` steps get scheduled, in seconds. */
  readonly lookahead?: number
  /** Delay before the first step, so it's never scheduled in the past. */
  readonly startDelay?: number
}

export class LookaheadScheduler {
  private readonly lookahead: number
  private readonly startDelay: number
  private step = 0
  private nextTime = 0
  private running = false

  constructor(
    private readonly onStep: (step: number, time: number) => void,
    opts: SchedulerOptions = {},
  ) {
    this.lookahead = opts.lookahead ?? 0.12
    this.startDelay = opts.startDelay ?? 0.08
  }

  get playing(): boolean {
    return this.running
  }

  /** The next step to be scheduled and its time. */
  get position(): { readonly step: number; readonly time: number } {
    return { step: this.step, time: this.nextTime }
  }

  start(now: number, bpm: number): void {
    this.running = true
    this.step = 0
    this.nextTime = now + this.startDelay
    this.pump(now, bpm)
  }

  stop(): void {
    this.running = false
  }

  /**
   * Schedules every step due before `now + lookahead`. The tempo applies from the next step on, so
   * a tempo change never shifts notes already scheduled. If the clock jumped ahead (a throttled
   * background tab), the missed steps are skipped and the beat picks up on time, instead of
   * firing all at once.
   */
  pump(now: number, bpm: number): void {
    if (!this.running) return
    const dur = stepDuration(bpm)
    if (this.nextTime < now) {
      const missed = Math.ceil((now - this.nextTime) / dur)
      this.step += missed
      this.nextTime += missed * dur
    }
    while (this.nextTime < now + this.lookahead) {
      this.onStep(this.step, this.nextTime)
      this.step++
      this.nextTime += dur
    }
  }
}
