import { isInstrumentId, type InstrumentId } from '../audio/instruments/catalog.ts'
import { clamp, type Vec } from '../geom.ts'
import { isKey, isToneId, type ToneId } from '../music/theory.ts'
import { Emitter } from './observable.ts'

/**
 * The stage: everything a setup saves and restores. Plain data, so it serializes to JSON as is.
 * Coordinates are stage units (the logical canvas, 1280 × 720 in landscape), not CSS pixels.
 *
 * All changes go through `StageStore` so listeners (audio, UI, a future undo) hear about them.
 */

export interface StageString {
  readonly id: number
  /** The low end: the left end, or the bottom end of a steep string (see `orient`). */
  readonly a: Vec
  readonly b: Vec
  readonly instrument: InstrumentId
}

export interface StageState {
  readonly width: number
  readonly height: number
  readonly key: number
  readonly tone: ToneId
  /** What a newly stretched string plays. */
  readonly newStringInstrument: InstrumentId
  readonly strings: readonly StageString[]
}

/** The saved form: the state plus a version, for setups files and storage. */
export interface StageSnapshot extends StageState {
  readonly version: 1
}

export type StageChange =
  | { readonly type: 'string-added'; readonly string: StageString }
  | { readonly type: 'string-removed'; readonly string: StageString; readonly reason: 'merged' | 'cleared' | 'other' }
  | { readonly type: 'string-moved'; readonly string: StageString }
  | { readonly type: 'string-instrument'; readonly string: StageString }
  | { readonly type: 'key' | 'tone' | 'new-string-instrument' | 'size' }
  | { readonly type: 'loaded' }

export const MAX_STRINGS = 16
export const LANDSCAPE = { width: 1280, height: 720 } as const

export const DEFAULT_STAGE: StageState = {
  ...LANDSCAPE,
  key: 9, // A
  tone: 'pentamin',
  newStringInstrument: 'guitar',
  strings: [],
}

/** Swaps the ends so `a` is the low end: the left end, or the bottom end of a steep string. */
export function orient<T extends { a: Vec; b: Vec }>(s: T): T {
  const dx = s.b.x - s.a.x
  const dy = s.b.y - s.a.y
  const swap = Math.abs(dx) >= Math.abs(dy) ? dx < 0 : dy > 0
  return swap ? { ...s, a: s.b, b: s.a } : s
}

export class StageStore {
  private current: StageState
  private nextId: number
  readonly changes = new Emitter<StageChange>()

  constructor(initial: StageState = DEFAULT_STAGE) {
    this.current = initial
    this.nextId = Math.max(0, ...initial.strings.map((s) => s.id)) + 1
  }

  get state(): StageState {
    return this.current
  }

  get diagonal(): number {
    return Math.hypot(this.current.width, this.current.height)
  }

  find(id: number): StageString | undefined {
    return this.current.strings.find((s) => s.id === id)
  }

  /** Returns the new string, or null when the stage is full. */
  addString(a: Vec, b: Vec, instrument = this.current.newStringInstrument): StageString | null {
    if (this.current.strings.length >= MAX_STRINGS) return null
    const string = orient({ id: this.nextId++, a: { ...a }, b: { ...b }, instrument })
    this.update({ strings: [...this.current.strings, string] })
    this.changes.emit({ type: 'string-added', string })
    return string
  }

  removeString(id: number, reason: 'merged' | 'cleared' | 'other' = 'other'): void {
    const string = this.find(id)
    if (!string) return
    this.update({ strings: this.current.strings.filter((s) => s.id !== id) })
    this.changes.emit({ type: 'string-removed', string, reason })
  }

  /** Moves one end. Doesn't re-orient (that would swap ends mid-drag); call `settle` on release. */
  moveEnd(id: number, end: 'a' | 'b', to: Vec): void {
    const p = { x: clamp(to.x, 0, this.current.width), y: clamp(to.y, 0, this.current.height) }
    this.replace(id, (s) => ({ ...s, [end]: p }), 'string-moved')
  }

  /** Re-orients a string after a drag. */
  settle(id: number): void {
    this.replace(id, orient, 'string-moved')
  }

  setInstrument(id: number, instrument: InstrumentId): void {
    this.replace(id, (s) => ({ ...s, instrument }), 'string-instrument')
  }

  setKey(key: number): void {
    this.update({ key: ((Math.round(key) % 12) + 12) % 12 })
    this.changes.emit({ type: 'key' })
  }

  setTone(tone: ToneId): void {
    this.update({ tone })
    this.changes.emit({ type: 'tone' })
  }

  setNewStringInstrument(instrument: InstrumentId): void {
    this.update({ newStringInstrument: instrument })
    this.changes.emit({ type: 'new-string-instrument' })
  }

  /** Changes the stage size (landscape/vertical), scaling string positions to fit. */
  setSize(width: number, height: number): void {
    const sx = width / this.current.width
    const sy = height / this.current.height
    const scale = (p: Vec): Vec => ({ x: p.x * sx, y: p.y * sy })
    this.update({
      width,
      height,
      strings: this.current.strings.map((s) => orient({ ...s, a: scale(s.a), b: scale(s.b) })),
    })
    this.changes.emit({ type: 'size' })
  }

  clear(): void {
    for (const s of this.current.strings) this.removeString(s.id, 'cleared')
  }

  snapshot(): StageSnapshot {
    return structuredClone({ version: 1, ...this.current })
  }

  /** Replaces the whole stage. Throws on a malformed snapshot (see `parseSnapshot`). */
  load(snapshot: unknown): void {
    const parsed = parseSnapshot(snapshot)
    this.clear()
    const { version: _version, ...state } = parsed
    this.current = state
    this.nextId = Math.max(0, ...state.strings.map((s) => s.id)) + 1
    this.changes.emit({ type: 'loaded' })
  }

  private update(patch: Partial<StageState>): void {
    this.current = { ...this.current, ...patch }
  }

  private replace(id: number, fn: (s: StageString) => StageString, type: 'string-moved' | 'string-instrument'): void {
    let changed: StageString | undefined
    const strings = this.current.strings.map((s) => {
      if (s.id !== id) return s
      changed = fn(s)
      return changed
    })
    if (!changed) return
    this.update({ strings })
    this.changes.emit({ type, string: changed })
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isVec = (v: unknown): v is Vec => isRecord(v) && isFiniteNumber(v['x']) && isFiniteNumber(v['y'])

/**
 * Validates untrusted data (a setups file, browser storage) into a snapshot. Throws an Error with
 * a readable message when it doesn't fit. Extra strings beyond `MAX_STRINGS` are dropped.
 */
export function parseSnapshot(data: unknown): StageSnapshot {
  if (!isRecord(data)) throw new Error('Not a stage setup.')
  if (data['version'] !== 1) throw new Error('Unknown setup version.')
  const { width, height, key, tone, newStringInstrument, strings } = data
  if (!isFiniteNumber(width) || !isFiniteNumber(height) || width <= 0 || height <= 0) {
    throw new Error('The setup has no valid stage size.')
  }
  if (!isKey(key)) throw new Error('The setup has no valid key.')
  if (!isToneId(tone)) throw new Error('The setup has no valid tone.')
  if (!isInstrumentId(newStringInstrument)) throw new Error('The setup has an unknown instrument.')
  if (!Array.isArray(strings)) throw new Error('The setup has no strings list.')
  const seen = new Set<number>()
  const parsed: StageString[] = []
  for (const s of strings.slice(0, MAX_STRINGS)) {
    if (!isRecord(s) || !isVec(s['a']) || !isVec(s['b']) || !isInstrumentId(s['instrument'])) {
      throw new Error('The setup has a broken string.')
    }
    const id = s['id']
    if (!isFiniteNumber(id) || !Number.isInteger(id) || id <= 0 || seen.has(id)) {
      throw new Error('The setup has a string without a valid id.')
    }
    seen.add(id)
    parsed.push(
      orient({ id, a: { x: s['a'].x, y: s['a'].y }, b: { x: s['b'].x, y: s['b'].y }, instrument: s['instrument'] }),
    )
  }
  return { version: 1, width, height, key, tone, newStringInstrument, strings: parsed }
}
