import type { Mode } from '../state/app.ts'

/**
 * What each mode allows. Build: make and change the layout (and still pluck). Play: play only;
 * expression gestures (bend, air sweep) that don't change the layout live here.
 */
export type Action =
  | 'pluck'
  | 'create-string'
  | 'move-endpoint'
  | 'delete-string'
  | 'change-instrument'
  | 'bend-string'
  | 'air-sweep'

const RULES: Readonly<Record<Action, readonly Mode[]>> = {
  pluck: ['build', 'play'],
  'create-string': ['build'],
  'move-endpoint': ['build'],
  'delete-string': ['build'],
  'change-instrument': ['build'],
  'bend-string': ['play'],
  // In Build, a pinch in empty air starts a string, so the air sweep is Play only.
  'air-sweep': ['play'],
}

export function allows(mode: Mode, action: Action): boolean {
  return RULES[action].includes(mode)
}
