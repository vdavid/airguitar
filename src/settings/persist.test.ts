import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../state/settings.ts'
import type { StorageLike } from '../ui/storage.ts'
import { loadSettings, parseSettings, RANGES, saveSettings, SETTINGS_KEY, snapToRange } from './persist.ts'

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v)
    },
  }
}

describe('parseSettings', () => {
  it('falls back to defaults for junk', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('nope')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings({ volume: 'loud', debug: 1 })).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps valid fields and clamps numbers into range', () => {
    const s = parseSettings({ volume: 4, cameraDim: -1, pinchSensitivity: 1.23, allFingers: true, extra: 5 })
    expect(s.volume).toBe(1)
    expect(s.cameraDim).toBe(0)
    expect(s.pinchSensitivity).toBe(1.25)
    expect(s.allFingers).toBe(true)
    expect(s.showLabels).toBe(DEFAULT_SETTINGS.showLabels)
    expect(Object.keys(s).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort())
  })

  it('ignores non-finite numbers', () => {
    expect(parseSettings({ volume: Number.NaN }).volume).toBe(DEFAULT_SETTINGS.volume)
  })
})

describe('snapToRange', () => {
  it('rounds to the step without float noise', () => {
    expect(snapToRange(0.295, RANGES.cameraDim)).toBe(0.3)
    expect(snapToRange(0.6000000001, RANGES.pinchSensitivity)).toBe(0.6)
  })
})

describe('load and save', () => {
  it('round-trips through storage', () => {
    const st = memoryStorage()
    const changed = { ...DEFAULT_SETTINGS, volume: 0.5, debug: true }
    expect(saveSettings(st, changed)).toBe(true)
    expect(loadSettings(st)).toEqual(changed)
  })

  it('survives missing, broken, and throwing storage', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS)
    const st = memoryStorage()
    st.data.set(SETTINGS_KEY, '{not json')
    expect(loadSettings(st)).toEqual(DEFAULT_SETTINGS)
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('full')
      },
    }
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS)
    expect(saveSettings(throwing, DEFAULT_SETTINGS)).toBe(false)
    expect(saveSettings(null, DEFAULT_SETTINGS)).toBe(false)
  })
})
