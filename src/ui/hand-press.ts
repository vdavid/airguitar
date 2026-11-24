import { closeAllDropdowns, PRESS_OUTSIDE } from './dropdown.ts'

/**
 * Lets hands press HTML controls: a pinch over a button clicks it, the same as a mouse. Pinch
 * positions arrive in client (CSS pixel) coordinates.
 */

const CONTROLS = 'button, [data-hand-press]'

function controlAt(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y)
  const target = el?.closest<HTMLElement>(CONTROLS)
  if (!target || (target instanceof HTMLButtonElement && target.disabled)) return null
  // Only controls drawn over the stage: the top bar, its dropdowns, and dialogs.
  return target.closest('#top, .dd-panel, .modal') ? target : null
}

/**
 * A hand pinched at (x, y). Clicks the control there and returns true; otherwise closes any open
 * dropdown (returning true, so the pinch doesn't also act on the stage) or returns false.
 */
export function pressAt(x: number, y: number): boolean {
  const target = controlAt(x, y)
  if (target) {
    target.click()
    return true
  }
  const hadOpen = closeAllDropdowns()
  document.dispatchEvent(new CustomEvent(PRESS_OUTSIDE))
  return hadOpen
}

const hovered = new Set<HTMLElement>()

/** Highlights the controls under the hands' pinch cursors this frame. */
export function updateHandHover(points: readonly { x: number; y: number }[]): void {
  const now = new Set<HTMLElement>()
  for (const p of points) {
    const el = controlAt(p.x, p.y)
    if (el) now.add(el)
  }
  for (const el of hovered) if (!now.has(el)) el.classList.remove('hand-hover')
  for (const el of now) el.classList.add('hand-hover')
  hovered.clear()
  for (const el of now) hovered.add(el)
}
