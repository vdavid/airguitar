import type { Mode } from '../state/app.ts'

/**
 * What each mode allows.
 * - Build: make and change the layout (and still pluck); a string's middle opens the picker.
 * - Mixed: play, and move ends to re-pitch strings. No making, removing, or re-instrumenting;
 *   dropping an end on the other keeps a minimum length (`strings/model.ts` `keepApart`).
 * - Play: play only; expression gestures (bend) that don't change the layout.
 */
export type Action = 'pluck' | 'create-string' | 'move-endpoint' | 'delete-string' | 'change-instrument' | 'bend-string'

/** The modes in top bar order. */
export const MODES: readonly Mode[] = ['build', 'mixed', 'play']

const RULES: Readonly<Record<Action, readonly Mode[]>> = {
  pluck: ['build', 'mixed', 'play'],
  'create-string': ['build'],
  'move-endpoint': ['build', 'mixed'],
  'delete-string': ['build'],
  'change-instrument': ['build'],
  'bend-string': ['mixed', 'play'],
}

export function allows(mode: Mode, action: Action): boolean {
  return RULES[action].includes(mode)
}

/** The keyboard shortcut for each mode. */
export const MODE_KEYS: Readonly<Record<Mode, string>> = { build: 'B', mixed: 'M', play: 'P' }

/** The mode a key switches to (B, M, P, either case), or null. */
export function modeForKey(key: string): Mode | null {
  const k = key.toUpperCase()
  return MODES.find((m) => MODE_KEYS[m] === k) ?? null
}
