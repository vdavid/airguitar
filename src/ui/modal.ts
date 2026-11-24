import './dialogs.css'
import { closeAllDropdowns } from './dropdown.ts'

/**
 * A dialog in Music Maker's look (`.modal` backdrop, `.card` panel). One is open at a time.
 *
 * Hands: the backdrop and the card are `data-hand-press` targets, so a pinch anywhere over an open
 * dialog lands on it and never falls through to the stage. A pinch on the backdrop (outside the
 * card) closes the dialog; a pinch on the card's background does nothing. Escape closes it too.
 */

export interface Modal {
  readonly element: HTMLElement
  /** The card: put the dialog's content here. */
  readonly card: HTMLElement
  open(): void
  close(): void
  readonly isOpen: boolean
}

const openModals = new Set<Modal>()

export function closeAllModals(): void {
  for (const m of [...openModals]) m.close()
}

export function createModal(opts: {
  /** Element id, for tests and debugging. */
  readonly id: string
  readonly title: string
  readonly wide?: boolean
  readonly onOpen?: () => void
}): Modal {
  const element = document.createElement('div')
  element.className = 'modal'
  element.id = opts.id
  element.dataset['handPress'] = ''
  const card = document.createElement('div')
  card.className = opts.wide === true ? 'card wide' : 'card'
  card.dataset['handPress'] = ''
  card.setAttribute('role', 'dialog')
  card.setAttribute('aria-modal', 'true')
  const h2 = document.createElement('h2')
  h2.textContent = opts.title
  h2.id = `${opts.id}-title`
  card.setAttribute('aria-labelledby', h2.id)
  card.append(h2)
  element.append(card)
  document.body.append(element)

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') modal.close()
  }
  let returnFocus: HTMLElement | null = null

  const modal: Modal = {
    element,
    card,
    get isOpen() {
      return element.classList.contains('open')
    },
    open() {
      if (modal.isOpen) return
      closeAllDropdowns()
      closeAllModals()
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      opts.onOpen?.()
      element.classList.add('open')
      openModals.add(modal)
      document.addEventListener('keydown', onKey)
      card.querySelector<HTMLElement>('.primary, button')?.focus({ preventScroll: true })
    },
    close() {
      if (!modal.isOpen) return
      element.classList.remove('open')
      openModals.delete(modal)
      document.removeEventListener('keydown', onKey)
      returnFocus?.focus({ preventScroll: true })
      returnFocus = null
    },
  }
  element.addEventListener('click', (e) => {
    if (e.target === element) modal.close()
  })
  return modal
}

/** A text button for a dialog's actions row. */
export function dialogButton(text: string, onClick: () => void, opts: { primary?: boolean } = {}): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = text
  if (opts.primary === true) b.className = 'primary'
  b.addEventListener('click', onClick)
  return b
}

/** A small heading inside a dialog. */
export function section(title: string): HTMLHeadingElement {
  const h = document.createElement('h3')
  h.textContent = title
  return h
}
