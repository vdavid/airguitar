import type { AppContext } from './app.ts'
import { mountCoreControls } from './ui/core-controls.ts'

/**
 * Every feature mounts itself here, one line each, in top bar order. A feature gets the shared
 * `AppContext` and wires its own controls, sounds, and state listeners; nothing else in the core
 * needs to change to add one. See AGENTS.md § Seams.
 */
export function mountFeatures(ctx: AppContext): void {
  mountCoreControls(ctx.topBar, {
    stage: ctx.stage,
    app: ctx.app,
    unlockAudio: ctx.unlockAudio,
    openNewStringPicker: () => {
      ctx.openPicker({ kind: 'new-strings' })
    },
  })
  // Agent A (instruments, expression gestures): mountExpression(ctx)
  // Agent B (beats, recording, export): mountBeats(ctx), mountRecording(ctx)
  // Agent C (settings, help, setups): mountSetups(ctx), mountHelp(ctx), mountSettings(ctx)
}
