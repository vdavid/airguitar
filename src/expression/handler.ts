import type { AppContext } from '../app.ts'
import type { Vec } from '../geom.ts'
import type { ExpressionHandler } from '../gestures/expression.ts'
import { pullString, SNAP_MIN, snapVelocity, sweepAmounts } from './shapes.ts'

/**
 * The expression gestures (Play mode, offered by the gesture controller):
 * - Pinch a string and pull it sideways: the pitch bends up, more the further you pull. Let go and
 *   it snaps back; a deep enough pull plays the string with a twang as it springs back.
 * - Pinch in empty air and drag: down darkens the whole mix, up thins it, sideways adds echo (a
 *   dotted eighth at the beat's tempo). Letting go clears it.
 * Neither depends on timing: how far you pull is all that matters. Only a deliberate let-go snaps a
 * string; a pinch cut short (hand lost, mode switch) just straightens it.
 */

interface Bending {
  readonly type: 'bend'
  readonly stringId: number
  readonly u: number
  depth: number
}

interface Sweeping {
  readonly type: 'sweep'
  readonly from: Vec
}

type Owned = Bending | Sweeping

export function createExpressionHandler(ctx: AppContext): ExpressionHandler {
  const owned = new Map<string, Owned>()

  const bending = (stringId: number): boolean =>
    [...owned.values()].some((o) => o.type === 'bend' && o.stringId === stringId)
  const sweeping = (): boolean => [...owned.values()].some((o) => o.type === 'sweep')

  const endSweep = (): void => {
    ctx.audio.setSweep(0, 0, 0)
    ctx.effects.sweep = null
  }

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
      owned.set(pointer.id, { type: 'bend', stringId, u, depth: 0 })
      ctx.unlockAudio()
      return true
    },
    pinchAir(pointer) {
      if (sweeping()) return false
      owned.set(pointer.id, { type: 'sweep', from: pointer.pos })
      ctx.unlockAudio()
      ctx.effects.sweep = { from: pointer.pos, to: pointer.pos, dark: 0, thin: 0, echo: 0 }
      return true
    },
    move(pointerId, pos) {
      const o = owned.get(pointerId)
      if (!o) return
      if (o.type === 'sweep') {
        const a = sweepAmounts(o.from, pos)
        ctx.audio.setSweep(a.dark, a.thin, a.echo, ctx.beats.state.bpm)
        ctx.effects.sweep = { from: o.from, to: pos, ...a }
        return
      }
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
      if (!o) return
      if (o.type === 'sweep') endSweep()
      else snap(o)
    },
    cancel(pointerId) {
      const o = owned.get(pointerId)
      owned.delete(pointerId)
      if (!o) return
      if (o.type === 'sweep') {
        endSweep()
        return
      }
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
