import { parseSnapshot, type StageSnapshot } from '../state/stage.ts'
import { readJson, writeJson, type StorageLike } from '../ui/storage.ts'

/**
 * Named setups: whole-stage snapshots the player saved, kept in this browser. Everything read
 * back is validated, since storage and files hold whatever was put there.
 */

export const SETUPS_KEY = 'airguitar-setups-v1'
export const MAX_NAME_LENGTH = 40
/** Files bigger than this aren't setups (a full stage is a few kB). */
export const MAX_FILE_BYTES = 1_000_000

export interface SavedSetup {
  readonly name: string
  /** Epoch milliseconds. */
  readonly saved: number
  readonly stage: StageSnapshot
}

/** Trims and shortens a typed name; an empty one becomes "Setup N". */
export function cleanName(raw: string, existingCount: number): string {
  const name = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH).trim()
  return name || `Setup ${existingCount + 1}`
}

/** Reads a stored list, dropping entries that don't hold a valid stage. */
export function parseSetups(data: unknown): SavedSetup[] {
  if (!Array.isArray(data)) return []
  const out: SavedSetup[] = []
  for (const item of data as unknown[]) {
    if (typeof item !== 'object' || item === null) continue
    const rec = item as Record<string, unknown>
    if (typeof rec['name'] !== 'string' || rec['name'].trim() === '') continue
    try {
      const stage = parseSnapshot(rec['stage'])
      const saved = typeof rec['saved'] === 'number' && Number.isFinite(rec['saved']) ? rec['saved'] : 0
      out.push({ name: rec['name'].slice(0, MAX_NAME_LENGTH), saved, stage })
    } catch {
      // A broken entry is skipped; the rest still load.
    }
  }
  return out
}

/** Adds a setup, or replaces the one with the same name (case-insensitive). */
export function upsertSetup(
  list: readonly SavedSetup[],
  setup: SavedSetup,
): { readonly list: SavedSetup[]; readonly updated: boolean } {
  const key = setup.name.toLocaleLowerCase()
  const at = list.findIndex((s) => s.name.toLocaleLowerCase() === key)
  if (at < 0) return { list: [...list, setup], updated: false }
  return { list: list.map((s, i) => (i === at ? setup : s)), updated: true }
}

export function loadSetups(storage: StorageLike | null): SavedSetup[] {
  return parseSetups(readJson(storage, SETUPS_KEY))
}

export function saveSetups(storage: StorageLike | null, list: readonly SavedSetup[]): boolean {
  return writeJson(storage, SETUPS_KEY, list)
}

/** A safe download name, like `airguitar-my-harp.json`. */
export function setupFileName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `airguitar-${slug || 'setup'}.json`
}

/** The file form: the snapshot itself plus its name, so `StageStore.load` reads it as is. */
export function setupToFile(name: string, stage: StageSnapshot): string {
  return JSON.stringify({ ...stage, name }, null, 2)
}

/** Parses a setup file's text into a snapshot and a name. Throws a readable Error when it isn't one. */
export function setupFromFile(text: string, fileName: string): { name: string; stage: StageSnapshot } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file isn’t a setup.')
  }
  const stage = parseSnapshot(data)
  const rec = data as Record<string, unknown>
  const fromFile = fileName.replace(/\.json$/i, '').replace(/^airguitar-/, '')
  const name = typeof rec['name'] === 'string' && rec['name'].trim() ? rec['name'] : fromFile
  return { name: cleanName(name, 0), stage }
}
