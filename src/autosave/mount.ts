import type { AppContext } from '../app.ts'
import { browserStorage, readJson, writeJson } from '../ui/storage.ts'
import { parseSession, serializeSession, SESSION_KEY } from './session.ts'

/** Saves this long after the last change, so a drag doesn't write on every frame. */
const SAVE_DELAY_MS = 400

/**
 * Autosave: restores the last session on load (stage, mode, beat), then saves it, debounced, on
 * every change and right away when the page is hidden or closed. A missing or bad save leaves the
 * empty stage. A restored beat starts on the first click or key press (browsers keep audio off
 * until then).
 */
export function mountAutosave(ctx: AppContext): void {
  const storage = browserStorage()

  const saved = parseSession(readJson(storage, SESSION_KEY))
  if (saved) {
    try {
      ctx.stage.load(saved.stage)
      ctx.app.setMode(saved.mode)
      ctx.beats.restore({ beat: saved.beat.beat, parts: new Set(saved.beat.parts), bpm: saved.beat.bpm })
    } catch (err: unknown) {
      console.warn('Couldn’t restore the last session.', err)
    }
    if (saved.beat.beat !== null) {
      const resume = (): void => {
        removeEventListener('pointerdown', resume, true)
        removeEventListener('keydown', resume, true)
        ctx.unlockAudio()
        ctx.beats.resume()
      }
      addEventListener('pointerdown', resume, true)
      addEventListener('keydown', resume, true)
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  const save = (): void => {
    clearTimeout(timer)
    timer = undefined
    writeJson(
      storage,
      SESSION_KEY,
      serializeSession({ stage: ctx.stage.snapshot(), mode: ctx.app.state.mode, beat: ctx.beats.state }),
    )
  }
  const later = (): void => {
    clearTimeout(timer)
    timer = setTimeout(save, SAVE_DELAY_MS)
  }
  ctx.stage.changes.subscribe(later)
  ctx.app.changes.subscribe(later)
  ctx.beats.changes.subscribe(later)
  addEventListener('pagehide', save)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save()
  })
}
