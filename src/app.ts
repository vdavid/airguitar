import { AudioEngine } from './audio/engine.ts'
import { BeatPlayer } from './beats/player.ts'
import { baseMidi, INSTRUMENTS, type InstrumentId } from './audio/instruments/catalog.ts'
import { GestureController } from './gestures/controller.ts'
import type { Vec } from './geom.ts'
import { Effects } from './render/effects.ts'
import { AppStore } from './state/app.ts'
import { SettingsStore } from './state/settings.ts'
import { StageStore } from './state/stage.ts'
import { stringMiddle } from './strings/model.ts'
import { StringPlayer } from './strings/player.ts'
import { pressAt } from './ui/hand-press.ts'
import { toast } from './ui/messages.ts'
import { PickerState, type PickerTarget } from './ui/picker.ts'
import { TopBar } from './ui/topbar.ts'

/**
 * The app's services, created once at boot and handed to every feature (`features.ts`). Features
 * plug in through these: mount controls on `topBar`, connect sound to `audio.graph`, read and
 * replace the stage through `stage`, register an expression handler on `gestures`, and so on.
 */
export interface AppContext {
  readonly stage: StageStore
  readonly app: AppStore
  readonly settings: SettingsStore
  readonly audio: AudioEngine
  /** The backing beat. Its `state.bpm` is the session tempo (the Echo follows it). */
  readonly beats: BeatPlayer
  readonly topBar: TopBar
  readonly gestures: GestureController
  readonly strings: StringPlayer
  readonly picker: PickerState
  readonly effects: Effects
  /** Seconds, on the same clock as everything else (performance.now based). */
  readonly now: () => number
  /** Stage units ↔ client (CSS pixel) coordinates, for the current layout. */
  readonly toClient: (p: Vec) => Vec
  readonly toStage: (clientX: number, clientY: number) => Vec
  /** Stage y just below the top bar. */
  readonly safeTop: () => number
  /** Starts audio (call from a user gesture). */
  readonly unlockAudio: () => void
  readonly openPicker: (target: PickerTarget, anchor?: Vec) => void
  /** A short, quiet note on an instrument: the picked string's pitch, or the instrument's base note. */
  readonly previewInstrument: (instrument: InstrumentId) => void
  readonly toast: (message: string, ms?: number) => void
}

export function createApp(canvas: HTMLCanvasElement, top: HTMLElement): AppContext {
  const now = (): number => performance.now() / 1000
  const stage = new StageStore()
  const app = new AppStore()
  const settings = new SettingsStore()
  const audio = new AudioEngine()
  const effects = new Effects()
  const picker = new PickerState()
  const topBar = new TopBar(top)
  const strings = new StringPlayer(stage, audio, effects, now)
  const beats = new BeatPlayer(audio, stage)

  const applyColor = (): void => {
    audio.setColor(settings.state.brightness, settings.state.echo, beats.state.bpm)
  }
  settings.changes.subscribe((s) => {
    audio.setVolume(s.volume)
    applyColor()
  })
  beats.changes.subscribe(applyColor)

  const toClient = (p: Vec): Vec => {
    const r = canvas.getBoundingClientRect()
    return { x: r.left + (p.x * r.width) / stage.state.width, y: r.top + (p.y * r.height) / stage.state.height }
  }
  const toStage = (x: number, y: number): Vec => {
    const r = canvas.getBoundingClientRect()
    return { x: ((x - r.left) * stage.state.width) / r.width, y: ((y - r.top) * stage.state.height) / r.height }
  }
  const safeTop = (): number => {
    const r = canvas.getBoundingClientRect()
    const bar = top.getBoundingClientRect()
    return Math.min(Math.max(0, ((bar.bottom - r.top) * stage.state.height) / r.height), stage.state.height * 0.3)
  }

  /** A short sound so a choice can be heard: the string's own pitch, or the instrument's base note. */
  const previewInstrument = (instrument: InstrumentId): void => {
    const target = picker.open?.target
    const s = target?.kind === 'string' ? stage.find(target.id) : undefined
    const midi = s ? strings.pitchOf({ ...s, instrument }) : baseMidi(instrument) + stage.state.key
    audio.play(instrument, { midi, velocity: 0.35, pan: 0 })
  }

  const openPicker = (target: PickerTarget, anchor?: Vec): void => {
    const s = target.kind === 'string' ? stage.find(target.id) : undefined
    const at = anchor ?? (s ? stringMiddle(s) : { x: stage.state.width / 2, y: stage.state.height / 2 })
    picker.show(target, at, stage.state, safeTop(), now())
  }

  const gestures = new GestureController({
    stage,
    app,
    picker,
    safeTop,
    now,
    pressUi: (pos) => {
      const c = toClient(pos)
      const pressed = pressAt(c.x, c.y)
      if (pressed) effects.ripple(pos, now())
      return pressed
    },
    choose: (target, instrument) => {
      const color = INSTRUMENTS[instrument].color
      if (target.kind === 'string') {
        stage.setInstrument(target.id, instrument)
        const s = stage.find(target.id)
        if (s) strings.pluck(s, 0.5, 0.55, { quiet: true })
      } else {
        stage.setNewStringInstrument(instrument)
        previewInstrument(instrument)
      }
      const open = picker.open
      if (open) effects.burst({ x: open.layout.panel.x + 40, y: open.layout.panel.y + 27 }, color, 10, 120)
    },
    stringCreated: (s) => {
      effects.burst(stringMiddle(s), '#ffffff', 14, 120)
    },
    stringMerged: (s) => {
      effects.burst(stringMiddle(s), INSTRUMENTS[s.instrument].color, 26, 200)
      audio.zip((stringMiddle(s).x / stage.state.width) * 2 - 1)
    },
    tooShort: () => {
      toast('Pull your hands further apart to make a string.')
    },
    stageFull: () => {
      toast('That’s the most strings the stage holds. Remove one to add another.')
    },
  })

  app.changes.subscribe(() => {
    // A mode switch ends whatever gesture was going on, and the picker is Build only.
    gestures.cancelAll()
    picker.close()
  })
  stage.changes.subscribe((c) => {
    if (c.type === 'loaded' || c.type === 'size') {
      gestures.cancelAll()
      picker.close()
    }
    if (c.type === 'string-removed' && picker.open?.target.kind === 'string' && picker.open.target.id === c.string.id) {
      picker.close()
    }
  })

  return {
    stage,
    app,
    settings,
    audio,
    beats,
    topBar,
    gestures,
    strings,
    picker,
    effects,
    now,
    toClient,
    toStage,
    safeTop,
    unlockAudio: () => {
      audio.start()
    },
    openPicker,
    previewInstrument,
    toast,
  }
}
