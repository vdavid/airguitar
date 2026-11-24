import { describe, expect, it } from 'vitest'
import { StageStore } from '../state/stage.ts'
import { parseSession, serializeSession, type Session } from './session.ts'

function sample(): Session {
  const stage = new StageStore()
  stage.addString({ x: 100, y: 100 }, { x: 500, y: 120 }, 'harp')
  stage.setKey(2)
  stage.setTone('free')
  stage.setSize(720, 1280)
  return serializeSession({
    stage: stage.snapshot(),
    mode: 'mixed',
    beat: { beat: 'house', parts: new Set(['kick', 'bass']), bpm: 131 },
  })
}

describe('session autosave', () => {
  it('round-trips through JSON', () => {
    const saved = sample()
    const back = parseSession(JSON.parse(JSON.stringify(saved)) as unknown)
    expect(back).toEqual(saved)
    expect(back?.stage.strings[0]?.instrument).toBe('harp')
    expect(back?.stage.width).toBe(720)
    expect(back?.beat.parts).toEqual(['kick', 'bass'])
  })

  it('keeps "Off" as no beat', () => {
    const saved = { ...sample(), beat: { beat: null, parts: [], bpm: 90 } }
    expect(parseSession(saved)?.beat.beat).toBeNull()
  })

  it('returns null for missing, corrupt, or old-version saves', () => {
    expect(parseSession(undefined)).toBeNull()
    expect(parseSession('nope')).toBeNull()
    expect(parseSession({ ...sample(), version: 0 })).toBeNull()
    expect(parseSession({ ...sample(), mode: 'jam' })).toBeNull()
    expect(parseSession({ ...sample(), stage: { ...sample().stage, tone: 'jazz' } })).toBeNull()
    expect(parseSession({ ...sample(), beat: { beat: 'polka', parts: [], bpm: 100 } })).toBeNull()
    expect(parseSession({ ...sample(), beat: { beat: null, parts: 'kick', bpm: 100 } })).toBeNull()
    expect(parseSession({ ...sample(), beat: { beat: null, parts: [], bpm: 'fast' } })).toBeNull()
  })

  it('drops unknown parts and clamps the tempo', () => {
    const back = parseSession({ ...sample(), beat: { beat: 'lofi', parts: ['kick', 'cowbell'], bpm: 9999 } })
    expect(back?.beat.parts).toEqual(['kick'])
    expect(back?.beat.bpm).toBeLessThan(9999)
  })
})
