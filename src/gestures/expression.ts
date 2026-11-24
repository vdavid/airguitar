import type { Vec } from '../geom.ts'
import type { Pointer } from './controller.ts'

/**
 * Expression gestures: things a pinch does that don't change the layout (bend a string, sweep the
 * filter/echo in empty air). The gesture controller offers a pinch to the handler only when the
 * mode allows that action (see `mode.ts`); the handler returns true to own the pinch, and then
 * receives its moves and release.
 *
 * The default handler does nothing. Agent A plugs in the real one via
 * `GestureController.setExpressionHandler`.
 */
export interface ExpressionHandler {
  /** A pinch landed on a string's body (`u` is 0..1 along it), in a mode that allows bending. */
  pinchString(pointer: Pointer, stringId: number, u: number): boolean
  /** A pinch landed in empty air, in a mode that allows the air sweep. */
  pinchAir(pointer: Pointer): boolean
  /** An owned pinch moved. */
  move(pointerId: string, pos: Vec): void
  /** An owned pinch was let go on purpose. */
  release(pointerId: string): void
  /** An owned pinch was interrupted (the hand was lost, the mode changed): undo it quietly. */
  cancel(pointerId: string): void
}

export const NO_EXPRESSION: ExpressionHandler = {
  pinchString: () => false,
  pinchAir: () => false,
  move: () => undefined,
  release: () => undefined,
  cancel: () => undefined,
}
