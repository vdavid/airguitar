import { describe, expect, it } from 'vitest'
import { DEFAULT_STAGE, type StageSnapshot } from '../state/stage.ts'
import type { StorageLike } from '../ui/storage.ts'
import {
  cleanName,
  loadSetups,
  MAX_NAME_LENGTH,
  parseSetups,
  saveSetups,
  setupFileName,
  setupFromFile,
  setupToFile,
  SETUPS_KEY,
  upsertSetup,
  type SavedSetup,
} from './store.ts'

const stage: StageSnapshot = {
  version: 1,
  ...DEFAULT_STAGE,
  strings: [{ id: 1, a: { x: 100, y: 300 }, b: { x: 700, y: 300 }, instrument: 'harp' }],
}
const setup = (name: string, saved = 1): SavedSetup => ({ name, saved, stage })

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

describe('cleanName', () => {
  it('trims, collapses spaces, shortens, and fills in a default', () => {
    expect(cleanName('  my   harp ', 0)).toBe('my harp')
    expect(cleanName('   ', 2)).toBe('Setup 3')
    expect(cleanName('x'.repeat(99), 0)).toHaveLength(MAX_NAME_LENGTH)
  })
})

describe('parseSetups', () => {
  it('keeps valid entries and drops broken ones', () => {
    const list = parseSetups([
      setup('Good'),
      { name: 'No stage' },
      { name: '', stage },
      { name: 'Bad stage', stage: { version: 2 } },
      'junk',
      { name: 'No date', stage },
    ])
    expect(list.map((s) => s.name)).toEqual(['Good', 'No date'])
    expect(list[1]?.saved).toBe(0)
    expect(parseSetups({ not: 'a list' })).toEqual([])
  })
})

describe('upsertSetup', () => {
  it('adds new names and replaces same names, ignoring case', () => {
    const one = upsertSetup([], setup('Harp', 1))
    expect(one).toEqual({ list: [setup('Harp', 1)], updated: false })
    const two = upsertSetup(one.list, setup('Band', 2))
    const three = upsertSetup(two.list, setup('harp', 3))
    expect(three.updated).toBe(true)
    expect(three.list.map((s) => [s.name, s.saved])).toEqual([
      ['harp', 3],
      ['Band', 2],
    ])
  })
})

describe('storage', () => {
  it('round-trips and survives junk', () => {
    const st = memoryStorage()
    expect(saveSetups(st, [setup('A')])).toBe(true)
    expect(loadSetups(st)).toEqual([setup('A')])
    st.data.set(SETUPS_KEY, '{oops')
    expect(loadSetups(st)).toEqual([])
    expect(loadSetups(null)).toEqual([])
  })
})

describe('files', () => {
  it('makes safe file names', () => {
    expect(setupFileName('Árvíztűrő tükörfúrógép!')).toBe('airguitar-arvizturo-tukorfurogep.json')
    expect(setupFileName('   ')).toBe('airguitar-setup.json')
  })

  it('round-trips a setup through a file', () => {
    const text = setupToFile('My harp', stage)
    expect(setupFromFile(text, 'whatever.json')).toEqual({ name: 'My harp', stage })
  })

  it('names a nameless file after the file', () => {
    expect(setupFromFile(JSON.stringify(stage), 'airguitar-night-jam.json').name).toBe('night-jam')
  })

  it('throws readable errors', () => {
    expect(() => setupFromFile('nope', 'x.json')).toThrow('isn’t a setup')
    expect(() => setupFromFile('{"version":1}', 'x.json')).toThrow('stage size')
  })
})
