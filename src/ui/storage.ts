/**
 * Browser storage that never throws. localStorage can be missing or throw (private windows,
 * blocked site data, a full quota), and the app must keep working without it, so every access goes
 * through here.
 */

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/** The page's localStorage, or null when the browser won't give it to us. */
export function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Parsed JSON under `key`, or undefined when it's missing, unreadable, or not JSON. */
export function readJson(storage: StorageLike | null, key: string): unknown {
  try {
    const raw = storage?.getItem(key) ?? null
    return raw === null ? undefined : (JSON.parse(raw) as unknown)
  } catch {
    return undefined
  }
}

/** Stores `value` as JSON. Returns false when the browser refused. */
export function writeJson(storage: StorageLike | null, key: string, value: unknown): boolean {
  if (!storage) return false
  try {
    storage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
