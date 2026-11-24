import type { AudioEngine } from '../audio/engine.ts'
import { createMixGraph, type MixGraph } from '../audio/graph.ts'
import { getInstrument } from '../audio/instruments/registry.ts'
import type { StageStore } from '../state/stage.ts'
import { Emitter } from '../state/observable.ts'
import { playDrum } from './drums.ts'
import { BEATS, PART_IDS, stepEvents, type BeatId, type PartId } from './patterns.ts'
import { clampBpm, LookaheadScheduler, stepDuration, swingDelay } from './scheduler.ts'

export interface BeatState {
  /** The selected beat; null is "Off". */
  readonly beat: BeatId | null
  readonly parts: ReadonlySet<PartId>
  readonly bpm: number
}

/** Seconds of silence left after the last bar of a stem, for the reverb to ring out. */
export const STEM_TAIL = 2

/**
 * Plays the selected beat into the live mix's `beats` bus, on the audio clock. Picking a beat
 * starts it at that beat's tempo; picking "Off" stops it. Bass and chords read the stage's key and
 * tone at every step, so changing either is heard from the next note on.
 */
export class BeatPlayer {
  private current: BeatState = { beat: null, parts: new Set(PART_IDS), bpm: BEATS.boombap.bpm }
  private readonly scheduler: LookaheadScheduler
  private timer: ReturnType<typeof setInterval> | undefined
  readonly changes = new Emitter<BeatState>()

  constructor(
    private readonly audio: AudioEngine,
    private readonly stage: StageStore,
  ) {
    this.scheduler = new LookaheadScheduler((step, time) => {
      const graph = this.audio.graph
      if (graph && this.current.beat) this.scheduleStep(graph, this.current.beat, this.current.parts, step, time)
    })
  }

  get state(): BeatState {
    return this.current
  }

  get playing(): boolean {
    return this.scheduler.playing
  }

  setBeat(beat: BeatId | null): void {
    if (beat === null) {
      this.stop()
      this.update({ beat: null })
      return
    }
    this.update({ beat, bpm: BEATS[beat].bpm })
    this.start()
  }

  setPart(part: PartId, on: boolean): void {
    const parts = new Set(this.current.parts)
    if (on) parts.add(part)
    else parts.delete(part)
    this.update({ parts })
  }

  setBpm(bpm: number): void {
    this.update({ bpm: clampBpm(bpm) })
  }

  /** Schedules one step of `beat` on any graph (live or offline). */
  scheduleStep(graph: MixGraph, beat: BeatId, parts: ReadonlySet<PartId>, step: number, time: number): void {
    const pattern = BEATS[beat]
    const { key, tone } = this.stage.state
    const t = time + swingDelay(step % 16, pattern.swing, this.current.bpm)
    for (const ev of stepEvents(pattern, step, parts, key, tone)) {
      if (ev.kind === 'drum') {
        playDrum(
          { ctx: graph.ctx, out: graph.instrumentBus('drums', graph.beats), noise: graph.noise },
          ev.drum,
          t,
          ev.velocity,
        )
      } else {
        getInstrument(ev.instrument).play(
          { ctx: graph.ctx, out: graph.instrumentBus(ev.instrument, graph.beats), noise: graph.noise },
          { midi: ev.midi, velocity: ev.velocity, pan: 0, when: t + ev.delay, length: ev.length },
        )
      }
    }
  }

  /**
   * Renders `bars` bars of the current beat with only `parts` on, faster than real time, through
   * the same mix graph as live playing (on an offline context). Every render starts on the same
   * downbeat and has the same length, so stems line up in an editor.
   */
  async render(parts: ReadonlySet<PartId>, bars: number, sampleRate: number, volume: number): Promise<AudioBuffer> {
    const beat = this.current.beat ?? 'boombap'
    const dur = stepDuration(this.current.bpm)
    const length = Math.ceil((bars * 16 * dur + STEM_TAIL) * sampleRate)
    const off = new OfflineAudioContext(2, length, sampleRate)
    const graph = createMixGraph(off, { volume })
    for (let step = 0; step < bars * 16; step++) this.scheduleStep(graph, beat, parts, step, 0.02 + step * dur)
    return off.startRendering()
  }

  private start(): void {
    const ctx = this.audio.start().ctx
    if (!this.scheduler.playing) this.scheduler.start(ctx.currentTime, this.current.bpm)
    this.timer ??= setInterval(() => {
      this.scheduler.pump(ctx.currentTime, this.current.bpm)
    }, 25)
  }

  private stop(): void {
    this.scheduler.stop()
    clearInterval(this.timer)
    this.timer = undefined
  }

  private update(patch: Partial<BeatState>): void {
    this.current = { ...this.current, ...patch }
    this.changes.emit(this.current)
  }
}
