import { dist, type Vec } from '../geom.ts'
import type { AppStore } from '../state/app.ts'
import type { StageStore, StageString } from '../state/stage.ts'
import {
  HAND_REACH,
  isMerged,
  MIN_NEW_LENGTH,
  MOUSE_REACH,
  nearestBody,
  nearestEndpoint,
  nearestMiddle,
  stringMiddle,
} from '../strings/model.ts'
import { hitPicker, type PickerState, type PickerTarget } from '../ui/picker.ts'
import { NO_EXPRESSION, type ExpressionHandler } from './expression.ts'
import { allows } from './mode.ts'

/**
 * Turns pinches into stage actions, the same way for every hand (up to eight) and the mouse.
 * A "pointer" is one hand's pinch cursor or the mouse; a pinch is a hand's thumb meeting its index
 * finger, or a mouse button press.
 *
 * What a pinch does is decided once, when it starts (its "intent"), from what's under it:
 * 1. An open picker takes every pinch: a tile picks, the close button or outside closes.
 * 2. Hands only: an HTML control (top bar, dropdown) under the pinch gets pressed.
 * 3. Build: an endpoint → grab and move it; drop it on the other end to delete the string.
 * 4. Build: a string's middle → open the instrument picker for it.
 * 5. Play: a string's body → offered to the expression handler (bend).
 * 6. Empty air. Build: hands pair up (the nearest other waiting hand) and stretch a new string
 *    between them; the mouse drags one out. Play: offered to the expression handler (air sweep).
 *
 * Nothing here depends on timing or holding still.
 */

export interface Pointer {
  readonly id: string
  readonly kind: 'hand' | 'mouse'
  readonly pos: Vec
}

type Intent =
  | { readonly type: 'drag'; readonly stringId: number; readonly end: 'a' | 'b' }
  | { readonly type: 'create'; partner: string | null }
  | { readonly type: 'create-mouse'; readonly from: Vec }
  | { readonly type: 'expression' }
  /** Does nothing until released (a pinch spent on a UI press, the picker, or a finished string). */
  | { readonly type: 'spent' }

export interface Preview {
  readonly a: Vec
  readonly b: Vec
  /** Long enough to become a string if released now. */
  readonly ok: boolean
}

/** Effects and outside services the controller calls into. */
export interface GestureHost {
  readonly stage: StageStore
  readonly app: AppStore
  readonly picker: PickerState
  /** Stage y below the top bar. */
  safeTop(): number
  now(): number
  /** Presses the HTML control under a hand's pinch, if there is one. Returns true if it did. */
  pressUi(pos: Vec): boolean
  /** A tile was picked: apply it (and give feedback). */
  choose(target: PickerTarget, instrument: StageString['instrument']): void
  stringCreated(s: StageString): void
  /** The string was deleted by dropping one end on the other. */
  stringMerged(s: StageString): void
  tooShort(): void
  stageFull(): void
}

export class GestureController {
  private readonly intents = new Map<string, Intent>()
  private readonly positions = new Map<string, Vec>()
  private expression: ExpressionHandler = NO_EXPRESSION

  constructor(private readonly host: GestureHost) {}

  setExpressionHandler(handler: ExpressionHandler): void {
    this.expression = handler
  }

  /** True while this pointer's pinch is doing something (so it shouldn't also pluck). */
  isBusy(id: string): boolean {
    return this.intents.has(id)
  }

  /** Endpoints being dragged right now, for highlighting. */
  dragging(): readonly { stringId: number; end: 'a' | 'b' }[] {
    const out: { stringId: number; end: 'a' | 'b' }[] = []
    for (const i of this.intents.values()) if (i.type === 'drag') out.push({ stringId: i.stringId, end: i.end })
    return out
  }

  /** Strings being stretched right now: paired hands, or the mouse drag. */
  previews(): Preview[] {
    const out: Preview[] = []
    for (const [id, intent] of this.intents) {
      const pos = this.positions.get(id)
      if (!pos) continue
      if (intent.type === 'create-mouse') {
        out.push({ a: intent.from, b: pos, ok: dist(intent.from, pos) >= MIN_NEW_LENGTH.mouse })
      } else if (intent.type === 'create' && intent.partner !== null && id < intent.partner) {
        const other = this.positions.get(intent.partner)
        if (other) out.push({ a: pos, b: other, ok: dist(pos, other) >= MIN_NEW_LENGTH.hand })
      }
    }
    return out
  }

  /** Hands pinching in empty air with no partner yet (Build), for a "waiting" marker. */
  waiting(): Vec[] {
    const out: Vec[] = []
    for (const [id, intent] of this.intents) {
      const pos = this.positions.get(id)
      if (pos && intent.type === 'create' && intent.partner === null) out.push(pos)
    }
    return out
  }

  pinchStart(p: Pointer): void {
    this.positions.set(p.id, p.pos)
    this.intents.set(p.id, this.resolve(p))
  }

  pinchMove(p: Pointer): void {
    this.positions.set(p.id, p.pos)
    const intent = this.intents.get(p.id)
    if (!intent) return
    if (intent.type === 'drag') this.host.stage.moveEnd(intent.stringId, intent.end, p.pos)
    else if (intent.type === 'expression') this.expression.move(p.id, p.pos)
  }

  pinchEnd(id: string): void {
    const intent = this.intents.get(id)
    const pos = this.positions.get(id)
    this.intents.delete(id)
    this.positions.delete(id)
    if (!intent || !pos) return
    switch (intent.type) {
      case 'drag':
        this.dropEnd(intent.stringId)
        break
      case 'create':
        this.finishHandCreate(intent, pos)
        break
      case 'create-mouse':
        this.finishCreate(intent.from, pos, MIN_NEW_LENGTH.mouse)
        break
      case 'expression':
        this.expression.release(id)
        break
      case 'spent':
        break
    }
  }

  /** The pointer vanished (hand lost): end its gesture without creating anything. */
  cancel(id: string): void {
    const intent = this.intents.get(id)
    this.intents.delete(id)
    this.positions.delete(id)
    if (!intent) return
    if (intent.type === 'drag') this.host.stage.settle(intent.stringId)
    else if (intent.type === 'expression') this.expression.cancel(id)
    else if (intent.type === 'create' && intent.partner !== null) this.unpair(intent.partner)
  }

  /** Ends every gesture, for a mode switch or a stage load. */
  cancelAll(): void {
    for (const id of [...this.intents.keys()]) this.cancel(id)
  }

  private resolve(p: Pointer): Intent {
    const { stage, app, picker } = this.host
    const open = picker.open
    if (open) {
      const hit = hitPicker(open.layout, p.pos)
      if (hit.kind === 'tile') {
        this.host.choose(open.target, hit.id)
        picker.close()
      } else if (hit.kind !== 'panel') picker.close()
      return { type: 'spent' }
    }
    if (p.kind === 'hand' && this.host.pressUi(p.pos)) return { type: 'spent' }

    const mode = app.state.mode
    const strings = stage.state.strings
    const reach = p.kind === 'hand' ? HAND_REACH : MOUSE_REACH
    if (allows(mode, 'move-endpoint')) {
      const end = nearestEndpoint(strings, p.pos, reach.endpoint)
      if (end) return { type: 'drag', stringId: end.string.id, end: end.end }
    }
    if (allows(mode, 'change-instrument')) {
      const s = nearestMiddle(strings, p.pos, reach.middle)
      if (s) {
        picker.show({ kind: 'string', id: s.id }, stringMiddle(s), stage.state, this.host.safeTop(), this.host.now())
        return { type: 'spent' }
      }
    }
    if (allows(mode, 'bend-string')) {
      const body = nearestBody(strings, p.pos, reach.body)
      if (body && this.expression.pinchString(p, body.string.id, body.u)) return { type: 'expression' }
    }
    if (allows(mode, 'create-string'))
      return p.kind === 'mouse' ? { type: 'create-mouse', from: p.pos } : this.pairUp(p)
    if (allows(mode, 'air-sweep') && this.expression.pinchAir(p)) return { type: 'expression' }
    return { type: 'spent' }
  }

  /** Pairs a new empty-air hand pinch with the nearest waiting one, if any. */
  private pairUp(p: Pointer): Intent {
    let partner: string | null = null
    let best = Infinity
    for (const [id, intent] of this.intents) {
      if (intent.type !== 'create' || intent.partner !== null) continue
      const pos = this.positions.get(id)
      if (!pos) continue
      const d = dist(pos, p.pos)
      if (d < best) {
        best = d
        partner = id
      }
    }
    const partnerIntent = partner === null ? undefined : this.intents.get(partner)
    if (partnerIntent?.type === 'create') partnerIntent.partner = p.id
    return { type: 'create', partner }
  }

  private unpair(id: string): void {
    const intent = this.intents.get(id)
    if (intent?.type === 'create') intent.partner = null
  }

  private finishHandCreate(intent: { partner: string | null }, pos: Vec): void {
    if (intent.partner === null) return
    const other = this.positions.get(intent.partner)
    // The partner's pinch is used up: it does nothing more until it opens.
    this.intents.set(intent.partner, { type: 'spent' })
    if (other) this.finishCreate(pos, other, MIN_NEW_LENGTH.hand)
  }

  private finishCreate(a: Vec, b: Vec, minLength: number): void {
    if (dist(a, b) < minLength) {
      this.host.tooShort()
      return
    }
    const s = this.host.stage.addString(a, b)
    if (s) this.host.stringCreated(s)
    else this.host.stageFull()
  }

  private dropEnd(stringId: number): void {
    const { stage } = this.host
    const s = stage.find(stringId)
    if (!s) return
    if (isMerged(s)) {
      stage.removeString(s.id, 'merged')
      this.host.stringMerged(s)
      return
    }
    stage.settle(s.id)
  }
}
