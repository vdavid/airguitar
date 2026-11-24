/**
 * The one-line top bar. Each feature mounts its own controls into a slot, at an order number, so
 * features don't edit each other's code:
 *
 * - `start` slot (left): brand 0, Build/Play 10, key 20, tone 30, new-string instrument 40.
 * - `end` slot (right): beats 100–199, recording 200–299, setups/help/settings 300–399.
 *
 * Use `iconButton` and the dropdowns in `dropdown.ts` for a consistent look: SVG icons with an
 * `aria-label` and a tooltip, no text labels (the bar has to fit on one line).
 */

export type TopBarSlot = 'start' | 'end'

export class TopBar {
  readonly element: HTMLElement
  private readonly slots: Record<TopBarSlot, HTMLElement>

  constructor(element: HTMLElement) {
    this.element = element
    element.replaceChildren()
    const start = document.createElement('div')
    start.className = 'bar-slot'
    const spacer = document.createElement('div')
    spacer.className = 'spacer'
    const end = document.createElement('div')
    end.className = 'bar-slot'
    element.append(start, spacer, end)
    this.slots = { start, end }
  }

  /** Adds `el` to a slot, sorted by `order`. Returns a function that removes it. */
  mount(el: HTMLElement, opts: { slot: TopBarSlot; order: number }): () => void {
    el.dataset['order'] = String(opts.order)
    const slot = this.slots[opts.slot]
    const after = [...slot.children].find((c) => Number((c as HTMLElement).dataset['order']) > opts.order)
    slot.insertBefore(el, after ?? null)
    return () => {
      el.remove()
    }
  }
}

export interface IconButtonOptions {
  readonly icon: string
  /** Accessible name and tooltip. */
  readonly label: string
  readonly onClick: (e: MouseEvent) => void
  /** Optional visible text next to the icon (keep it short). */
  readonly text?: string
}

export function iconButton(opts: IconButtonOptions): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = opts.text === undefined ? 'sq' : ''
  b.setAttribute('aria-label', opts.label)
  b.title = opts.label
  b.innerHTML = opts.icon
  if (opts.text !== undefined) {
    const span = document.createElement('span')
    span.textContent = opts.text
    b.append(span)
  }
  b.addEventListener('click', opts.onClick)
  return b
}

/** A small group wrapper (a few controls that belong together). */
export function group(...children: HTMLElement[]): HTMLElement {
  const g = document.createElement('div')
  g.className = 'group'
  g.append(...children)
  return g
}
