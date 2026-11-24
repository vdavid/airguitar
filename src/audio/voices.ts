import type { Voice } from './instruments/types.ts'

/**
 * Caps how many string voices sound at once. Each string keeps at most one plucked voice plus one
 * per resting finger, so a full stage (32 strings) with many hands could pile up dozens; past the
 * cap, the oldest voice still sounding is released (voice stealing). Pure bookkeeping over `Voice`,
 * so it's unit-testable.
 */
export class VoicePool {
  /** Oldest first. Each entry pairs the real voice with the wrapper handed out. */
  private readonly live: { readonly inner: Voice; readonly outer: Voice }[] = []

  constructor(private readonly max: number) {}

  get size(): number {
    return this.live.length
  }

  /** Tracks a new voice (stealing the oldest if full) and returns a wrapper to use in its place. */
  add(inner: Voice, now: number): Voice {
    for (let i = this.live.length - 1; i >= 0; i--) {
      if ((this.live[i]?.inner.endsAt ?? 0) <= now) this.live.splice(i, 1)
    }
    while (this.live.length >= this.max) this.live.shift()?.inner.release()
    const outer: Voice = {
      setPitch: (midi) => {
        inner.setPitch(midi)
      },
      bend: (cents) => {
        inner.bend(cents)
      },
      release: () => {
        const i = this.live.findIndex((e) => e.outer === outer)
        if (i >= 0) this.live.splice(i, 1)
        inner.release()
      },
      get endsAt() {
        return inner.endsAt
      },
    }
    this.live.push({ inner, outer })
    return outer
  }
}
