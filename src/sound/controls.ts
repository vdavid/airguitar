import type { AppContext } from '../app.ts'
import { RANGES, snapToRange } from '../settings/persist.ts'
import { panelDropdown } from '../ui/dropdown.ts'
import { ICON } from '../ui/icons.ts'
import { dialogButton } from '../ui/modal.ts'
import './sound.css'

type Key = 'brightness' | 'echo'

interface Row {
  readonly key: Key
  readonly label: string
  readonly low: string
  readonly high: string
  /** Accessible names for the − and + buttons. */
  readonly less: string
  readonly more: string
  /** The value text next to the label. */
  readonly show: (v: number) => string
}

const ROWS: readonly Row[] = [
  {
    key: 'brightness',
    label: 'Tone',
    low: 'Dark',
    high: 'Bright',
    less: 'Darker',
    more: 'Brighter',
    show: (v) => (v >= 1 ? 'Open' : `${String(Math.round(v * 100))}%`),
  },
  {
    key: 'echo',
    label: 'Echo',
    low: 'Off',
    high: 'Lots',
    less: 'Less echo',
    more: 'More echo',
    show: (v) => (v <= 0 ? 'Off' : `${String(Math.round(v * 100))}%`),
  },
]

/**
 * The sound controls in the top bar (order 50): one button whose panel has Tone (the mix lowpass,
 * dark to bright, fully open by default) and Echo (a dotted eighth at the beat's tempo, off by
 * default). Both are settings (`brightness`, `echo`), so they persist with the rest; `app.ts`
 * applies them to the audio. The button turns amber while either one changes the sound.
 */
export function mountSound(ctx: AppContext): void {
  const content = document.createElement('div')
  content.className = 'sound'
  const renders = ROWS.map((row) => slider(ctx, row, content))

  const dd = panelDropdown({ icon: ICON.sound, label: 'Sound: tone and echo', content })
  ctx.topBar.mount(dd.element, { slot: 'end', order: 50 })

  const render = (): void => {
    for (const r of renders) r()
    const s = ctx.settings.state
    dd.button.classList.toggle('sound-on', s.brightness < 1 || s.echo > 0)
  }
  ctx.settings.changes.subscribe(render)
  render()
}

function slider(ctx: AppContext, row: Row, parent: HTMLElement): () => void {
  const r = RANGES[row.key]
  const id = `sound-${row.key}`
  const head = document.createElement('div')
  head.className = 'sound-head'
  const label = document.createElement('label')
  label.htmlFor = id
  label.textContent = row.label
  const value = document.createElement('span')
  value.className = 'sound-value'
  head.append(label, value)

  const input = document.createElement('input')
  input.type = 'range'
  input.id = id
  input.min = String(r.min)
  input.max = String(r.max)
  input.step = String(r.step)
  const set = (v: number): void => {
    ctx.unlockAudio()
    ctx.settings.set({ [row.key]: snapToRange(v, r) })
  }
  input.addEventListener('input', () => {
    set(Number(input.value))
  })
  // Hands can't drag a slider, so − and + step it by a tenth of its range.
  const nudge = (dir: number) => (): void => {
    set(ctx.settings.state[row.key] + (dir * (r.max - r.min)) / 10)
  }
  const less = dialogButton('−', nudge(-1))
  less.className = 'sq'
  less.setAttribute('aria-label', row.less)
  const more = dialogButton('+', nudge(1))
  more.className = 'sq'
  more.setAttribute('aria-label', row.more)
  const stepper = document.createElement('div')
  stepper.className = 'stepper'
  stepper.append(less, input, more)

  const ends = document.createElement('div')
  ends.className = 'sound-ends'
  const low = document.createElement('span')
  low.textContent = row.low
  const high = document.createElement('span')
  high.textContent = row.high
  ends.append(low, high)

  const block = document.createElement('div')
  block.className = 'sound-row'
  block.append(head, stepper, ends)
  parent.append(block)

  return () => {
    const v = ctx.settings.state[row.key]
    input.value = String(v)
    value.textContent = row.show(v)
    less.disabled = v <= r.min
    more.disabled = v >= r.max
  }
}
