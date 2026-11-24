import type { AppContext } from '../app.ts'
import { ICON } from '../ui/icons.ts'
import { createModal, dialogButton } from '../ui/modal.ts'
import { browserStorage } from '../ui/storage.ts'
import { iconButton } from '../ui/topbar.ts'
import { loadSettings, RANGES, saveSettings, snapToRange } from './persist.ts'

/**
 * The Settings dialog (Music Maker's, minus the looper's "snap layers to the beat"). Settings load
 * from this browser at boot and save on every change.
 */

type NumberKey = keyof typeof RANGES
type BoolKey = 'allFingers' | 'showSkeleton' | 'showLabels' | 'debug'

interface Row {
  readonly key: NumberKey | BoolKey
  readonly label: string
  readonly help?: string
}

const ROWS: readonly Row[] = [
  {
    key: 'pinchSensitivity',
    label: 'Pinch sensitivity',
    help: 'Higher closes the pinch sooner. Lower needs your fingers to touch.',
  },
  { key: 'allFingers', label: 'Play with every fingertip', help: 'Off: only the index finger plucks.' },
  { key: 'showSkeleton', label: 'Show hand outline' },
  { key: 'showLabels', label: 'Show note names on strings', help: 'Turn off for a cleaner picture when filming.' },
  { key: 'cameraDim', label: 'Darken the camera picture' },
  { key: 'volume', label: 'Volume' },
  { key: 'debug', label: 'Show tracking data', help: 'Frame rate and pinch readings, for troubleshooting.' },
]

const isNumberKey = (k: Row['key']): k is NumberKey => k in RANGES

export function mountSettings(ctx: AppContext): void {
  const storage = browserStorage()
  ctx.settings.set(loadSettings(storage))
  ctx.settings.changes.subscribe((s) => {
    saveSettings(storage, s)
  })

  const renders: (() => void)[] = []
  const modal = createModal({
    id: 'settings-modal',
    title: 'Settings',
    onOpen: () => {
      for (const r of renders) r()
    },
  })
  const grid = document.createElement('div')
  grid.className = 'set'
  for (const row of ROWS) {
    const id = `set-${row.key}`
    const label = document.createElement(isNumberKey(row.key) ? 'label' : 'div')
    label.className = 'label'
    if (label instanceof HTMLLabelElement) label.htmlFor = id
    label.id = `${id}-label`
    label.textContent = row.label
    if (row.help !== undefined) {
      const small = document.createElement('small')
      small.textContent = row.help
      label.append(small)
    }
    const control = isNumberKey(row.key) ? slider(ctx, row.key, id, renders) : toggle(ctx, row.key, id, renders)
    grid.append(label, control)
  }
  modal.card.append(grid)
  const actions = document.createElement('div')
  actions.className = 'actions'
  actions.append(
    dialogButton(
      'Done',
      () => {
        modal.close()
      },
      { primary: true },
    ),
  )
  modal.card.append(actions)

  const button = iconButton({
    icon: ICON.settings,
    label: 'Settings',
    onClick: () => {
      modal.open()
    },
  })
  ctx.topBar.mount(button, { slot: 'end', order: 320 })
}

function slider(ctx: AppContext, key: NumberKey, id: string, renders: (() => void)[]): HTMLElement {
  const r = RANGES[key]
  const wrap = document.createElement('div')
  wrap.className = 'stepper'
  const input = document.createElement('input')
  input.type = 'range'
  input.id = id
  input.min = String(r.min)
  input.max = String(r.max)
  input.step = String(r.step)
  const set = (v: number): void => {
    ctx.settings.set({ [key]: snapToRange(v, r) })
    input.value = String(ctx.settings.state[key])
  }
  input.addEventListener('input', () => {
    set(Number(input.value))
  })
  // Hands can't drag a slider, so − and + step it by a tenth of its range.
  const nudge =
    (dir: number): (() => void) =>
    () => {
      set(ctx.settings.state[key] + dir * Math.max(r.step, (r.max - r.min) / 10))
    }
  const less = dialogButton('−', nudge(-1))
  less.className = 'sq'
  less.setAttribute('aria-label', 'Less')
  const more = dialogButton('+', nudge(1))
  more.className = 'sq'
  more.setAttribute('aria-label', 'More')
  wrap.append(less, input, more)
  renders.push(() => {
    input.value = String(ctx.settings.state[key])
  })
  return wrap
}

function toggle(ctx: AppContext, key: BoolKey, id: string, renders: (() => void)[]): HTMLElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.id = id
  b.className = 'switch'
  b.setAttribute('role', 'switch')
  b.setAttribute('aria-labelledby', `${id}-label`)
  const render = (): void => {
    b.setAttribute('aria-checked', String(ctx.settings.state[key]))
  }
  b.addEventListener('click', () => {
    ctx.settings.set({ [key]: !ctx.settings.state[key] })
    render()
  })
  renders.push(render)
  return b
}
