import { ICON } from './icons.ts'

/**
 * Dropdowns for the top bar. They're built from plain buttons (no native `<select>`), so a hand's
 * pinch can open them and pick an option the same way it presses any button. Two kinds:
 * `selectDropdown` (pick one) and `checklistDropdown` (toggle several).
 *
 * An open dropdown closes on Escape, on a press outside it, or on a hand press outside it (the
 * `airguitar:press-outside` event, see `pressAt` in `hand-press.ts`).
 */

export const PRESS_OUTSIDE = 'airguitar:press-outside'

const openDropdowns = new Set<() => void>()

/** Closes every open dropdown. Returns true if one was open. */
export function closeAllDropdowns(): boolean {
  const had = openDropdowns.size > 0
  for (const close of [...openDropdowns]) close()
  return had
}

interface Base {
  readonly element: HTMLElement
  readonly button: HTMLButtonElement
  readonly panel: HTMLElement
  close(): void
}

function base(opts: { icon: string; label: string }): Base {
  const element = document.createElement('div')
  element.className = 'dropdown'
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'dd-button'
  button.setAttribute('aria-label', opts.label)
  button.setAttribute('aria-haspopup', 'menu')
  button.setAttribute('aria-expanded', 'false')
  button.title = opts.label
  const panel = document.createElement('div')
  panel.className = 'dd-panel'
  panel.setAttribute('role', 'menu')
  panel.hidden = true
  element.append(button, panel)

  const onOutside = (e: Event): void => {
    if (e instanceof PointerEvent && e.target instanceof Node && element.contains(e.target)) return
    close()
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      close()
      button.focus()
    }
  }
  function close(): void {
    if (panel.hidden) return
    panel.hidden = true
    button.setAttribute('aria-expanded', 'false')
    openDropdowns.delete(close)
    document.removeEventListener('pointerdown', onOutside, true)
    document.removeEventListener(PRESS_OUTSIDE, onOutside)
    document.removeEventListener('keydown', onKey)
  }
  function open(): void {
    closeAllDropdowns()
    panel.hidden = false
    button.setAttribute('aria-expanded', 'true')
    openDropdowns.add(close)
    document.addEventListener('pointerdown', onOutside, true)
    document.addEventListener(PRESS_OUTSIDE, onOutside)
    document.addEventListener('keydown', onKey)
  }
  button.addEventListener('click', () => {
    if (panel.hidden) open()
    else close()
  })
  return { element, button, panel, close }
}

function setButtonFace(button: HTMLButtonElement, icon: string, text: string): void {
  button.innerHTML = `${icon}<span class="dd-value"></span>${ICON.chevron}`
  const value = button.querySelector('.dd-value')
  if (value) value.textContent = text
}

export interface SelectOption<T> {
  readonly value: T
  readonly label: string
  /** Shorter text for the closed button (defaults to `label`). */
  readonly short?: string
  /** Optional SVG shown before the label. */
  readonly icon?: string
}

export interface SelectDropdown<T> {
  readonly element: HTMLElement
  setValue(value: T): void
  setDisabled(disabled: boolean): void
}

/** Pick one of several options. The closed button shows an icon and the current value. */
export function selectDropdown<T>(opts: {
  icon: string
  label: string
  options: readonly SelectOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Lay options out in this many columns (e.g. 4 for the 12 keys). */
  columns?: number
  /** Extra controls under the options (for example, the beat's tempo). Pressing them keeps the panel open. */
  footer?: HTMLElement
}): SelectDropdown<T> {
  const b = base(opts)
  if (opts.columns !== undefined) {
    b.panel.classList.add('dd-grid')
    b.panel.style.setProperty('--cols', String(opts.columns))
  }
  let current = opts.value
  const items = opts.options.map((o) => {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'dd-item'
    item.setAttribute('role', 'menuitemradio')
    item.innerHTML = `${o.icon ?? ''}<span></span>`
    const span = item.querySelector('span')
    if (span) span.textContent = o.label
    item.addEventListener('click', () => {
      b.close()
      if (o.value !== current) opts.onChange(o.value)
    })
    b.panel.append(item)
    return { item, option: o }
  })
  if (opts.footer) b.panel.append(opts.footer)
  const render = (): void => {
    const sel = opts.options.find((o) => o.value === current)
    setButtonFace(b.button, sel?.icon ?? opts.icon, sel?.short ?? sel?.label ?? '')
    for (const { item, option } of items) item.setAttribute('aria-checked', String(option.value === current))
  }
  render()
  return {
    element: b.element,
    setValue(value) {
      current = value
      render()
    },
    setDisabled(disabled) {
      b.button.disabled = disabled
      if (disabled) b.close()
    },
  }
}

export interface ChecklistItem<T> {
  readonly value: T
  readonly label: string
  readonly checked: boolean
}

export interface ChecklistDropdown<T> {
  readonly element: HTMLElement
  setChecked(value: T, checked: boolean): void
}

/** Toggle several items on and off (for example, beat parts). Stays open while toggling. */
export function checklistDropdown<T>(opts: {
  icon: string
  label: string
  /** Text on the closed button. */
  text: string
  items: readonly ChecklistItem<T>[]
  onToggle: (value: T, checked: boolean) => void
}): ChecklistDropdown<T> {
  const b = base(opts)
  setButtonFace(b.button, opts.icon, opts.text)
  const rows = new Map<T, HTMLButtonElement>()
  for (const it of opts.items) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'dd-item dd-check'
    item.setAttribute('role', 'menuitemcheckbox')
    item.setAttribute('aria-checked', String(it.checked))
    item.innerHTML = `<span class="dd-box">${ICON.check}</span><span></span>`
    const span = item.querySelector('span:last-child')
    if (span) span.textContent = it.label
    item.addEventListener('click', () => {
      const checked = item.getAttribute('aria-checked') !== 'true'
      item.setAttribute('aria-checked', String(checked))
      opts.onToggle(it.value, checked)
    })
    b.panel.append(item)
    rows.set(it.value, item)
  }
  return {
    element: b.element,
    setChecked(value, checked) {
      rows.get(value)?.setAttribute('aria-checked', String(checked))
    },
  }
}
