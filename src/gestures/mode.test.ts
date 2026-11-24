import { describe, expect, it } from 'vitest'
import { allows } from './mode.ts'

describe('mode rules', () => {
  it('lets both modes pluck', () => {
    expect(allows('build', 'pluck')).toBe(true)
    expect(allows('play', 'pluck')).toBe(true)
  })

  it('keeps layout changes in Build', () => {
    for (const action of ['create-string', 'move-endpoint', 'delete-string', 'change-instrument'] as const) {
      expect(allows('build', action)).toBe(true)
      expect(allows('play', action)).toBe(false)
    }
  })

  it('keeps expression gestures in Play', () => {
    expect(allows('play', 'bend-string')).toBe(true)
  })
})
