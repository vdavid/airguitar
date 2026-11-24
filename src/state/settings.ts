import { Emitter } from './observable.ts'

/**
 * User settings. The core reads them every frame; the Settings dialog (and its persistence) writes
 * them through `SettingsStore.set`.
 */
export interface Settings {
  /** Scales the pinch thresholds. Higher closes the pinch sooner; lower needs fingers to touch. */
  readonly pinchSensitivity: number
  /** Off: only the index fingertip plucks. On: every fingertip does. */
  readonly allFingers: boolean
  readonly showSkeleton: boolean
  /** Note names on strings. */
  readonly showLabels: boolean
  /** 0..1 dark overlay on the camera picture. */
  readonly cameraDim: number
  /** 0..1 master volume. */
  readonly volume: number
  /** Frame rate and pinch readings, for troubleshooting. */
  readonly debug: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  pinchSensitivity: 1,
  allFingers: false,
  showSkeleton: true,
  showLabels: true,
  cameraDim: 0.28,
  volume: 0.9,
  debug: false,
}

export class SettingsStore {
  private current: Settings
  readonly changes = new Emitter<Settings>()

  constructor(initial: Settings = DEFAULT_SETTINGS) {
    this.current = initial
  }

  get state(): Settings {
    return this.current
  }

  set(patch: Partial<Settings>): void {
    this.current = { ...this.current, ...patch }
    this.changes.emit(this.current)
  }
}
