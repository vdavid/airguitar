import { describe, expect, it } from 'vitest'
import { allows, MODES, modeForKey } from './mode.ts'

describe('mode rules', () => {
  it('lets every mode pluck', () => {
    for (const mode of MODES) expect(allows(mode, 'pluck')).toBe(true)
  })

  it('keeps making, removing, and re-instrumenting strings in Build', () => {
    for (const action of ['create-string', 'delete-string', 'change-instrument'] as const) {
      expect(allows('build', action)).toBe(true)
      expect(allows('mixed', action)).toBe(false)
      expect(allows('play', action)).toBe(false)
    }
  })

  it('lets Build and Mixed move ends, but not Play', () => {
    expect(allows('build', 'move-endpoint')).toBe(true)
    expect(allows('mixed', 'move-endpoint')).toBe(true)
    expect(allows('play', 'move-endpoint')).toBe(false)
  })

  it('bends in Mixed and Play, not in Build (the middle opens the picker there)', () => {
    expect(allows('build', 'bend-string')).toBe(false)
    expect(allows('mixed', 'bend-string')).toBe(true)
    expect(allows('play', 'bend-string')).toBe(true)
  })

  it('orders the modes Build, Mixed, Play', () => {
    expect(MODES).toEqual(['build', 'mixed', 'play'])
  })
})

describe('mode keys', () => {
  it('maps B, M, and P in either case', () => {
    expect(modeForKey('b')).toBe('build')
    expect(modeForKey('M')).toBe('mixed')
    expect(modeForKey('p')).toBe('play')
  })

  it('ignores other keys', () => {
    expect(modeForKey('x')).toBeNull()
    expect(modeForKey('Escape')).toBeNull()
  })
})
