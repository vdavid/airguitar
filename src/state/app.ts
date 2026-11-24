import { Emitter } from './observable.ts'

/**
 * Session state that isn't part of a saved stage: the Build/Play mode and the input source.
 */

export type Mode = 'build' | 'play'
export type InputSource = 'idle' | 'camera' | 'mouse'

export interface AppState {
  readonly mode: Mode
  readonly input: InputSource
}

export class AppStore {
  private current: AppState = { mode: 'build', input: 'idle' }
  readonly changes = new Emitter<AppState>()

  get state(): AppState {
    return this.current
  }

  setMode(mode: Mode): void {
    if (mode === this.current.mode) return
    this.current = { ...this.current, mode }
    this.changes.emit(this.current)
  }

  setInput(input: InputSource): void {
    this.current = { ...this.current, input }
    this.changes.emit(this.current)
  }
}
