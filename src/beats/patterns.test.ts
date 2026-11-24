import { describe, expect, it } from 'vitest'
import { BEAT_IDS, BEATS, PART_IDS, scaleDegree, stepEvents, type PartId } from './patterns.ts'

const ALL = new Set<PartId>(PART_IDS)
const only = (...parts: PartId[]): Set<PartId> => new Set(parts)

describe('beat patterns', () => {
  it('has 16 steps in every bar of every part', () => {
    for (const id of BEAT_IDS) {
      const b = BEATS[id]
      for (const bars of [b.kick, b.snare, b.hats, b.bass, b.chords]) {
        expect(bars.length).toBeGreaterThan(0)
        for (const bar of bars) expect(bar).toMatch(/^[-xXo0358]{16}$/)
      }
    }
  })

  it('starts every beat with an accented downbeat', () => {
    for (const id of BEAT_IDS) expect(BEATS[id].kick[0]?.[0]).toBe('X')
  })
})

describe('scaleDegree', () => {
  const major = [0, 2, 4, 5, 7, 9, 11]
  it('maps degrees to notes, wrapping into the next octave', () => {
    expect(scaleDegree(major, 0, 3, 0)).toBe(48) // C3
    expect(scaleDegree(major, 0, 3, 4)).toBe(55) // G3
    expect(scaleDegree(major, 0, 3, 7)).toBe(60) // C4
    expect(scaleDegree(major, 9, 1, 2)).toBe(12 * 2 + 9 + 4) // C♯ in A, octave 1
  })
})

describe('stepEvents', () => {
  it('plays only the parts that are on', () => {
    const ev = stepEvents(BEATS.boombap, 0, only('kick'), 0, 'major')
    expect(ev).toEqual([{ kind: 'drum', part: 'kick', drum: 'kick', velocity: 1 }])
    expect(stepEvents(BEATS.boombap, 0, new Set(), 0, 'major')).toEqual([])
  })

  it('uses per-beat drum sounds', () => {
    const ev = stepEvents(BEATS.maqsum, 0, only('kick'), 0, 'major')
    expect(ev[0]).toMatchObject({ drum: 'dum' })
    const clap = stepEvents(BEATS.house, 4, only('snare'), 0, 'major')
    expect(clap[0]).toMatchObject({ drum: 'clap', velocity: 0.95 })
  })

  it('plays open hats on "o"', () => {
    const ev = stepEvents(BEATS.house, 2, only('hats'), 0, 'major')
    expect(ev[0]).toMatchObject({ drum: 'ohat' })
  })

  it('alternates bars', () => {
    // Boom bap's second kick bar has a hit on step 9; the first doesn't.
    expect(stepEvents(BEATS.boombap, 9, only('kick'), 0, 'major')).toEqual([])
    expect(stepEvents(BEATS.boombap, 16 + 9, only('kick'), 0, 'major')).toHaveLength(1)
  })

  it('follows the key: bass on the root, moving with the progression', () => {
    // Bar 0 of a major progression is the I chord: the root, in octave 1 (≤ E3).
    const inC = stepEvents(BEATS.boombap, 0, only('bass'), 0, 'major')
    expect(inC).toEqual([
      { kind: 'note', part: 'bass', instrument: 'bass', midi: 24, velocity: 0.85, delay: 0, length: 1 },
    ])
    const inA = stepEvents(BEATS.boombap, 0, only('bass'), 9, 'major')
    expect(inA[0]).toMatchObject({ midi: 33 })
    // Bar 1 is the V chord: G.
    const bar1 = stepEvents(BEATS.boombap, 16, only('bass'), 0, 'major')
    expect(bar1[0]).toMatchObject({ midi: 31 })
  })

  it('builds chords from the tone’s parent scale, strummed', () => {
    const major = stepEvents(BEATS.boombap, 0, only('chords'), 0, 'major')
    expect(major.map((e) => (e.kind === 'note' ? e.midi : 0))).toEqual([48, 52, 55])
    expect(major.map((e) => (e.kind === 'note' ? e.delay : -1))).toEqual([0, 0.012, 0.024])
    // Minor pentatonic's parent is minor: a minor triad.
    const minor = stepEvents(BEATS.boombap, 0, only('chords'), 0, 'pentamin')
    expect(minor.map((e) => (e.kind === 'note' ? e.midi : 0))).toEqual([48, 51, 55])
    // "Free" falls back to major.
    const free = stepEvents(BEATS.boombap, 0, only('chords'), 0, 'free')
    expect(free.map((e) => (e.kind === 'note' ? e.midi : 0))).toEqual([48, 52, 55])
  })

  it('shortens or lengthens chords per beat, never the bass', () => {
    const ev = stepEvents(BEATS.boombap, 0, only('bass', 'chords'), 0, 'major')
    expect(ev.map((e) => (e.kind === 'note' ? e.length : 0))).toEqual([1, 0.6, 0.6, 0.6])
  })

  it('adds sevenths where the beat asks for them, and keeps chords at or below E5', () => {
    const lofi = stepEvents(BEATS.lofi, 0, only('chords'), 11, 'major')
    expect(lofi).toHaveLength(4)
    for (const e of lofi) if (e.kind === 'note') expect(e.midi).toBeLessThanOrEqual(76)
  })

  it('plays everything on a busy step', () => {
    const kinds = stepEvents(BEATS.boombap, 0, ALL, 0, 'major').map((e) => e.part)
    expect(kinds).toEqual(['kick', 'hats', 'bass', 'chords', 'chords', 'chords'])
  })
})
