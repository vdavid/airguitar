import type { AppContext } from '../app.ts'
import type { ExpressionHandler } from '../gestures/expression.ts'
import { pullString, SNAP_MIN, snapVelocity } from './shapes.ts'

/**
 * The bend (Play mode, offered by the gesture controller): pinch a string and pull it sideways,
 * and the pitch bends up, more the further you pull. Let go and it snaps back; a deep enough pull
 * plays the string with a twang as it springs back. It doesn't depend on timing: how far you pull
 * is all that matters. Only a deliberate let-go snaps a string; a pinch cut short (hand lost, mode
 * switch) just straightens it.
 */

interface Bending {
  readonly stringId: number
  readonly u: number
  depth: number
}

export function createExpressionHandler(ctx: AppContext): ExpressionHandler {
  const owned = new Map<string, Bending>()

  const bending = (stringId: number): boolean => [...owned.values()].some((o) => o.stringId === stringId)

  const snap = (b: Bending): void => {
    ctx.strings.setPull(b.stringId, null)
    const s = ctx.stage.find(b.stringId)
    const from = ctx.strings.runtime(b.stringId).bend
    ctx.strings.bend(b.stringId, 0)
    if (!s || b.depth < SNAP_MIN) return
    const voice = ctx.strings.pluck(s, b.u, snapVelocity(b.depth))
    // The twang: start part-way up the bend and spring back to pitch.
    voice?.bend(from * 0.5)
    setTimeout(() => voice?.bend(0), 20)
    ctx.strings.runtime(b.stringId).vib.amp = 10 + b.depth * 0.3
  }

  return {
    pinchString(pointer, stringId, u) {
      if (bending(stringId)) return false
      owned.set(pointer.id, { stringId, u, depth: 0 })
      ctx.unlockAudio()
      return true
    },
    move(pointerId, pos) {
      const o = owned.get(pointerId)
      if (!o) return
      const s = ctx.stage.find(o.stringId)
      if (!s) return
      const pull = pullString(s.a, s.b, o.u, pos)
      o.depth = pull.depth
      ctx.strings.setPull(o.stringId, pull.point)
      ctx.strings.bend(o.stringId, pull.cents)
    },
    release(pointerId) {
      const o = owned.get(pointerId)
      owned.delete(pointerId)
      if (o) snap(o)
    },
    cancel(pointerId) {
      const o = owned.get(pointerId)
      owned.delete(pointerId)
      if (!o) return
      // Interrupted: straighten the string and drop the bend, but don't play it.
      ctx.strings.setPull(o.stringId, null)
      ctx.strings.bend(o.stringId, 0)
    },
  }
}

/** Plugs the expression gestures into the gesture controller. */
export function mountExpression(ctx: AppContext): void {
  ctx.gestures.setExpressionHandler(createExpressionHandler(ctx))
}
