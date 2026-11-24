import type { AppContext } from './app.ts'
import { mountBeats } from './beats/controls.ts'
import { mountRecording } from './record/controls.ts'
import { mountExpression } from './expression/handler.ts'
import { mountCoreControls } from './ui/core-controls.ts'
import { mountHelp } from './help/dialog.ts'
import { mountSettings } from './settings/dialog.ts'
import { mountSetups } from './setups/dialog.ts'

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
  mountExpression(ctx)
  mountBeats(ctx)
  mountRecording(ctx)
  mountSetups(ctx)
  mountHelp(ctx)
  mountSettings(ctx)
}
