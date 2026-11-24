import { clamp } from '../geom.ts'
import { DEFAULT_SETTINGS, type Settings } from '../state/settings.ts'
import { readJson, writeJson, type StorageLike } from '../ui/storage.ts'

/** Settings persistence: validated on the way in, since storage holds whatever was there before. */

export const SETTINGS_KEY = 'airguitar-settings-v1'

export interface Range {
  readonly min: number
  readonly max: number
  readonly step: number
}

/** Slider ranges (Music Maker's), also used to clamp stored values. */
export const RANGES = {
  pinchSensitivity: { min: 0.6, max: 1.7, step: 0.05 },
  cameraDim: { min: 0, max: 0.7, step: 0.02 },
  volume: { min: 0, max: 1, step: 0.02 },
} as const satisfies Partial<Record<keyof Settings, Range>>

type NumberKey = keyof typeof RANGES
type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings]

const NUMBER_KEYS = Object.keys(RANGES) as NumberKey[]
const BOOL_KEYS: readonly BoolKey[] = ['allFingers', 'showSkeleton', 'showLabels', 'debug']

/** Rounds to the range's step and clamps into it. */
export function snapToRange(value: number, r: Range): number {
  const stepped = Math.round((value - r.min) / r.step) * r.step + r.min
  return clamp(Number(stepped.toFixed(4)), r.min, r.max)
}

/** Builds settings from untrusted data: valid fields are kept, everything else falls back to defaults. */
export function parseSettings(data: unknown): Settings {
  const out: Record<string, number | boolean> = { ...DEFAULT_SETTINGS }
  if (typeof data !== 'object' || data === null) return DEFAULT_SETTINGS
  const rec = data as Record<string, unknown>
  for (const k of NUMBER_KEYS) {
    const v = rec[k]
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = snapToRange(v, RANGES[k])
  }
  for (const k of BOOL_KEYS) {
    const v = rec[k]
    if (typeof v === 'boolean') out[k] = v
  }
  return out as unknown as Settings
}

export function loadSettings(storage: StorageLike | null): Settings {
  return parseSettings(readJson(storage, SETTINGS_KEY))
}

export function saveSettings(storage: StorageLike | null, settings: Settings): boolean {
  return writeJson(storage, SETTINGS_KEY, settings)
}
