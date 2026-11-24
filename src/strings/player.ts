import type { AudioEngine } from '../audio/engine.ts'
import { baseMidi, INSTRUMENTS } from '../audio/instruments/catalog.ts'
import type { Voice } from '../audio/instruments/types.ts'
import { clamp, lerpVec, type Vec } from '../geom.ts'
import { stringPitch } from '../music/pitch.ts'
import { noteLabel } from '../music/theory.ts'
import type { Effects } from '../render/effects.ts'
import type { StageStore, StageString } from '../state/stage.ts'
import { stringLength, stringMiddle } from './model.ts'
import { COOLDOWN, speedToVelocity, sweep, type SideMemory } from './pluck.ts'

/**
 * Makes strings sound: turns pointer sweeps into plucks, keeps each string's ringing voice in tune
 * as its length, the key, or the tone changes, and holds the per-string visual state (vibration,
 * flash) the renderer draws.
 */

/** A just-created string ignores crossings for this long, so the hands that made it don't pluck it. */
const NEWBORN = 0.4

export interface StringRuntime {
  /** Vibration: amplitude (stage units), start time, and where along the string it was plucked. */
  vib: { amp: number; t0: number; pos: number }
  flash: { u: number; t: number }
  voice: Voice | null
  readonly memory: Map<string, SideMemory>
  readonly lastPluck: Map<string, number>
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
        case 'string-removed':
          this.runtimes.get(change.string.id)?.voice?.release()
          this.runtimes.delete(change.string.id)
          break
        case 'string-moved':
          this.retune(change.string)
          break
        case 'key':
        case 'tone':
        case 'size':
          for (const s of stage.state.strings) this.retune(s)
          break
        case 'loaded':
          for (const r of this.runtimes.values()) r.voice?.release()
          this.runtimes.clear()
          break
        case 'string-instrument':
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
    return noteLabel(this.pitchOf(s), key, tone)
  }

  /** Feeds one plucking pointer (a fingertip, or the mouse) at `p`. Plucks every string it crossed. */
  feed(pointerId: string, p: Vec): void {
    const t = this.now()
    const width = this.stage.state.width
    for (const s of this.stage.state.strings) {
      const r = this.runtime(s.id)
      const { memory, crossing } = sweep(r.memory.get(pointerId), s.a, s.b, p, t, width)
      if (memory) r.memory.set(pointerId, memory)
      if (!crossing || t - r.born < NEWBORN) continue
      if (t - (r.lastPluck.get(pointerId) ?? -Infinity) < COOLDOWN) continue
      r.lastPluck.set(pointerId, t)
      this.pluck(s, crossing.u, speedToVelocity(crossing.speed))
    }
  }

  /** Drops the side memory of pointers whose id starts with `prefix` (a hand pinched or vanished). */
  forget(prefix: string): void {
    for (const r of this.runtimes.values()) {
      for (const k of [...r.memory.keys()]) if (k.startsWith(prefix)) r.memory.delete(k)
    }
  }

  /** Sounds a string. `u` is where along it (0..1), for the visuals and stereo position. */
  pluck(s: StageString, u: number, velocity: number, opts: { quiet?: boolean } = {}): void {
    const t = this.now()
    const r = this.runtime(s.id)
    const color = INSTRUMENTS[s.instrument].color
    const at = lerpVec(s.a, s.b, u)
    // A real string damps what it was playing when plucked again.
    r.voice?.release()
    r.voice = this.audio.play(s.instrument, {
      midi: this.pitchOf(s),
      velocity,
      pan: clamp((stringMiddle(s).x / this.stage.state.width) * 2 - 1, -1, 1) * 0.7,
    })
    r.vib = { amp: 6 + 16 * velocity, t0: t, pos: clamp(u, 0.08, 0.92) }
    r.flash = { u, t }
    r.touched = t
    this.plucks++
    const quiet = opts.quiet === true
    this.effects.burst(at, color, quiet ? 3 : Math.round(6 + 14 * velocity), 90 + 260 * velocity)
    if (!quiet) this.effects.pop(at, this.labelOf(s), color, t)
  }

  private retune(s: StageString): void {
    const r = this.runtimes.get(s.id)
    if (!r) return
    r.touched = this.now()
    r.voice?.setPitch(this.pitchOf(s))
  }
}
