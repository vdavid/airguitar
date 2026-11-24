import type { AudioEngine } from '../audio/engine.ts'
import { baseMidi, INSTRUMENTS } from '../audio/instruments/catalog.ts'
import { getInstrument } from '../audio/instruments/registry.ts'
import type { Voice } from '../audio/instruments/types.ts'
import { clamp, lerpVec, type Vec } from '../geom.ts'
import { stringPitch } from '../music/pitch.ts'
import { noteLabel } from '../music/theory.ts'
import type { Effects } from '../render/effects.ts'
import type { StageStore, StageString } from '../state/stage.ts'
import { stringLength, stringMiddle } from './model.ts'
import { COOLDOWN, speedToVelocity, sweep, type SideMemory } from './pluck.ts'
import { RestTracker } from './rest.ts'

/**
 * Makes strings sound: turns pointer sweeps into plucks and resting fingers into holds, keeps each
 * string's ringing voices in tune as its length, the key, or the tone changes, applies bends, and
 * holds the per-string visual state (vibration, flash, pull) the renderer draws.
 */

/** A just-created string ignores crossings for this long, so the hands that made it don't pluck it. */
const NEWBORN = 0.4
/** Rests don't start on a string younger than this. */
const REST_NEWBORN = 0.5
/** Seconds between strikes while a finger rests on a rolling instrument (marimba, drums). */
export const ROLL_GAP = 0.095

/** A finger resting on a string. */
interface Hold {
  u: number
  /** The sustained note (sustaining instruments only). */
  voice: Voice | null
  /** When a rolling instrument strikes next. */
  next: number
}

export interface StringRuntime {
  /** Vibration: amplitude (stage units), start time, and where along the string it was plucked. */
  vib: { amp: number; t0: number; pos: number }
  flash: { u: number; t: number }
  voice: Voice | null
  readonly memory: Map<string, SideMemory>
  readonly lastPluck: Map<string, number>
  readonly rest: RestTracker
  readonly holds: Map<string, Hold>
  /** The current bend in cents (a pinch pulling the string). */
  bend: number
  /** Where a pinch pulls the string to, for drawing it bent. */
  pull: Vec | null
  readonly born: number
  /** Last pluck or change, for showing the label for a while. */
  touched: number
  /** A pointer is near, for showing the label. */
  near: boolean
}

export class StringPlayer {
  private readonly runtimes = new Map<number, StringRuntime>()
  /** Plucks so far this session (the hints use it to tell how far along someone is). */
  plucks = 0

  constructor(
    private readonly stage: StageStore,
    private readonly audio: AudioEngine,
    private readonly effects: Effects,
    private readonly now: () => number,
  ) {
    stage.changes.subscribe((change) => {
      switch (change.type) {
        case 'string-added':
          this.runtime(change.string.id)
          break
        case 'string-removed': {
          const r = this.runtimes.get(change.string.id)
          if (r) this.silence(r)
          this.runtimes.delete(change.string.id)
          break
        }
        case 'string-moved':
          this.retune(change.string)
          break
        case 'key':
        case 'tone':
        case 'size':
          for (const s of stage.state.strings) this.retune(s)
          break
        case 'loaded':
          for (const r of this.runtimes.values()) this.silence(r)
          this.runtimes.clear()
          break
        case 'string-instrument': {
          // The held notes belong to the old instrument.
          const r = this.runtimes.get(change.string.id)
          if (r) this.endHolds(r, r.rest.clear())
          break
        }
        case 'new-string-instrument':
          break
      }
    })
  }

  runtime(id: number): StringRuntime {
    let r = this.runtimes.get(id)
    if (!r) {
      const t = this.now()
      r = {
        vib: { amp: 0, t0: 0, pos: 0.5 },
        flash: { u: -1, t: 0 },
        voice: null,
        memory: new Map(),
        lastPluck: new Map(),
        rest: new RestTracker(),
        holds: new Map(),
        bend: 0,
        pull: null,
        born: t,
        touched: t,
        near: false,
      }
      this.runtimes.set(id, r)
    }
    return r
  }

  /** The pitch this string plays now (MIDI, fractional in "Free"). */
  pitchOf(s: StageString): number {
    const { key, tone } = this.stage.state
    return stringPitch(stringLength(s), this.stage.diagonal, baseMidi(s.instrument), key, tone)
  }

  labelOf(s: StageString): string {
    const { key, tone } = this.stage.state
    const midi = this.pitchOf(s)
    return getInstrument(s.instrument).label?.(midi) ?? noteLabel(midi, key, tone)
  }

  /**
   * Feeds one plucking pointer (a fingertip, or the mouse) at `p`. Plucks every string it crossed,
   * and starts, moves, or ends a hold on a string it rests on.
   */
  feed(pointerId: string, p: Vec): void {
    const t = this.now()
    const width = this.stage.state.width
    for (const s of this.stage.state.strings) {
      const r = this.runtime(s.id)
      if (this.rest(s, r, pointerId, p, t)) continue
      const { memory, crossing } = sweep(r.memory.get(pointerId), s.a, s.b, p, t, width)
      if (memory) r.memory.set(pointerId, memory)
      if (!crossing || t - r.born < NEWBORN) continue
      if (t - (r.lastPluck.get(pointerId) ?? -Infinity) < COOLDOWN) continue
      r.lastPluck.set(pointerId, t)
      this.pluck(s, crossing.u, speedToVelocity(crossing.speed))
    }
  }

  /** Drops the memory and holds of pointers whose id starts with `prefix` (a hand pinched or vanished). */
  forget(prefix: string): void {
    for (const r of this.runtimes.values()) {
      for (const k of [...r.memory.keys()]) if (k.startsWith(prefix)) r.memory.delete(k)
      this.endHolds(r, r.rest.forget(prefix))
    }
  }

  /** Once per frame: ends holds whose pointer vanished, rolls the rolling ones, keeps held strings shimmering. */
  update(t: number): void {
    for (const s of this.stage.state.strings) {
      const r = this.runtimes.get(s.id)
      if (!r || r.holds.size === 0) continue
      this.endHolds(r, r.rest.expire(t))
      for (const h of r.holds.values()) {
        if (h.voice) {
          r.vib = { amp: 5, t0: t - 0.02, pos: clamp(h.u, 0.08, 0.92) }
        } else if (getInstrument(s.instrument).hold === 'roll' && t >= h.next) {
          this.pluck(s, h.u, 0.42 + 0.12 * Math.random(), { quiet: true })
          h.next = Math.max(h.next + ROLL_GAP, t + 0.03)
        }
      }
    }
  }

  /** Sounds a string. `u` is where along it (0..1), for the visuals and stereo position. */
  pluck(s: StageString, u: number, velocity: number, opts: { quiet?: boolean } = {}): Voice | null {
    const t = this.now()
    const r = this.runtime(s.id)
    const color = INSTRUMENTS[s.instrument].color
    const at = lerpVec(s.a, s.b, u)
    // A real string damps what it was playing when plucked again.
    r.voice?.release()
    r.voice = this.audio.play(s.instrument, { midi: this.pitchOf(s), velocity, pan: this.panOf(s) })
    if (r.bend !== 0) r.voice?.bend(r.bend)
    r.vib = { amp: 6 + 16 * velocity, t0: t, pos: clamp(u, 0.08, 0.92) }
    r.flash = { u, t }
    r.touched = t
    this.plucks++
    const quiet = opts.quiet === true
    this.effects.burst(at, color, quiet ? 3 : Math.round(6 + 14 * velocity), 90 + 260 * velocity)
    if (!quiet) this.effects.pop(at, this.labelOf(s), color, t)
    return r.voice
  }

  /** Bends everything the string is sounding, in cents (0 returns to pitch). */
  bend(stringId: number, cents: number): void {
    const r = this.runtimes.get(stringId)
    if (!r) return
    r.bend = cents
    r.touched = this.now()
    r.voice?.bend(cents)
    for (const h of r.holds.values()) h.voice?.bend(cents)
  }

  /** Shows the string pulled to `p` (null lets it go straight). */
  setPull(stringId: number, p: Vec | null): void {
    const r = this.runtimes.get(stringId)
    if (r) r.pull = p
  }

  private panOf(s: StageString): number {
    return clamp((stringMiddle(s).x / this.stage.state.width) * 2 - 1, -1, 1) * 0.7
  }

  /** Feeds the rest tracker. Returns true while this pointer holds the string (so it doesn't also pluck it). */
  private rest(s: StageString, r: StringRuntime, pointerId: string, p: Vec, t: number): boolean {
    const dx = s.b.x - s.a.x
    const dy = s.b.y - s.a.y
    const length = Math.hypot(dx, dy)
    if (length < 1) return false
    const d = ((p.x - s.a.x) * dy - (p.y - s.a.y) * dx) / length
    const u = ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / (length * length)
    const canStart = t - r.born > REST_NEWBORN && r.pull === null
    const ev = r.rest.feed(pointerId, { d, u, length }, t, canStart)
    if (!ev) return false
    switch (ev.type) {
      case 'start':
        this.startHold(s, r, pointerId, ev.u, t)
        return true
      case 'move': {
        const h = r.holds.get(pointerId)
        if (h) h.u = ev.u
        return true
      }
      case 'end':
        this.endHolds(r, [pointerId])
        // Start the crossing memory fresh, so leaving the string doesn't count as a pluck.
        r.memory.delete(pointerId)
        return false
    }
  }

  private startHold(s: StageString, r: StringRuntime, pointerId: string, u: number, t: number): void {
    const hold: Hold = { u, voice: null, next: t + ROLL_GAP }
    r.holds.set(pointerId, hold)
    if (getInstrument(s.instrument).hold !== 'sustain') {
      this.pluck(s, u, 0.6)
      return
    }
    hold.voice = this.audio.play(s.instrument, {
      midi: this.pitchOf(s),
      velocity: 0.62,
      pan: this.panOf(s),
      held: true,
    })
    if (r.bend !== 0) hold.voice?.bend(r.bend)
    const at = lerpVec(s.a, s.b, u)
    const color = INSTRUMENTS[s.instrument].color
    r.flash = { u, t }
    r.touched = t
    this.plucks++
    this.effects.burst(at, color, 8, 140)
    this.effects.pop(at, this.labelOf(s), color, t)
  }

  private endHolds(r: StringRuntime, pointers: readonly string[]): void {
    for (const p of pointers) {
      r.holds.get(p)?.voice?.release()
      r.holds.delete(p)
    }
  }

  private silence(r: StringRuntime): void {
    r.voice?.release()
    this.endHolds(r, r.rest.clear())
  }

  private retune(s: StageString): void {
    const r = this.runtimes.get(s.id)
    if (!r) return
    r.touched = this.now()
    const midi = this.pitchOf(s)
    r.voice?.setPitch(midi)
    for (const h of r.holds.values()) h.voice?.setPitch(midi)
  }
}
