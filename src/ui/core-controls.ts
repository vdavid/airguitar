import { INSTRUMENTS } from '../audio/instruments/catalog.ts'
import { allows, MODE_KEYS, MODES, modeForKey } from '../gestures/mode.ts'
import { KEY_NAMES, TONE_ORDER, TONES, type ToneId } from '../music/theory.ts'
import { iconSvg } from '../render/icons.ts'
import type { AppStore, Mode } from '../state/app.ts'
import type { StageStore } from '../state/stage.ts'
import { selectDropdown } from './dropdown.ts'
import { ICON } from './icons.ts'
import { iconButton, type TopBar } from './topbar.ts'

/** The core's own top bar controls: brand, Build/Mixed/Play, key, tone, and the new-string instrument. */
export function mountCoreControls(
  bar: TopBar,
  deps: { stage: StageStore; app: AppStore; openNewStringPicker: () => void; unlockAudio: () => void },
): void {
  const { stage, app } = deps

  const brand = document.createElement('div')
  brand.className = 'brand'
  brand.innerHTML = 'Air <b>guitar</b>'
  bar.mount(brand, { slot: 'start', order: 0 })

  // Build / Mixed / Play: a three-button segmented control, also on the B, M, and P keys.
  const modes = document.createElement('div')
  modes.className = 'segmented'
  modes.setAttribute('role', 'radiogroup')
  modes.setAttribute('aria-label', 'Mode')
  const modeButton = (mode: Mode, icon: string, label: string): HTMLButtonElement => {
    const b = iconButton({
      icon,
      label,
      onClick: () => {
        deps.unlockAudio()
        app.setMode(mode)
      },
    })
    b.setAttribute('role', 'radio')
    return b
  }
  const modeButtons: Record<Mode, HTMLButtonElement> = {
    build: modeButton('build', ICON.build, `Build (${MODE_KEYS.build}): make, move, and change strings`),
    mixed: modeButton('mixed', ICON.mixed, `Mixed (${MODE_KEYS.mixed}): play and move ends, the strings stay`),
    play: modeButton('play', ICON.play, `Play (${MODE_KEYS.play}): just play, the layout stays put`),
  }
  modes.append(...MODES.map((m) => modeButtons[m]))
  bar.mount(modes, { slot: 'start', order: 10 })

  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
    const mode = modeForKey(e.key)
    if (!mode || isTyping(e.target) || document.querySelector('.modal.open')) return
    e.preventDefault()
    deps.unlockAudio()
    app.setMode(mode)
  })

  const key = selectDropdown({
    icon: ICON.key,
    label: 'Key',
    options: KEY_NAMES.map((name, i) => ({ value: i, label: name })),
    value: stage.state.key,
    columns: 4,
    onChange: (v) => {
      deps.unlockAudio()
      stage.setKey(v)
    },
  })
  bar.mount(key.element, { slot: 'start', order: 20 })

  const tone = selectDropdown<ToneId>({
    icon: ICON.tone,
    label: 'Tone: strings snap to the notes of this scale. Free means no snapping.',
    options: TONE_ORDER.map((id) => ({ value: id, label: TONES[id].name })),
    value: stage.state.tone,
    onChange: (v) => {
      deps.unlockAudio()
      stage.setTone(v)
    },
  })
  bar.mount(tone.element, { slot: 'start', order: 30 })

  const instrument = iconButton({
    icon: '',
    label: 'Instrument for new strings',
    onClick: () => {
      deps.unlockAudio()
      deps.openNewStringPicker()
    },
  })
  instrument.classList.add('instrument-btn')
  bar.mount(instrument, { slot: 'start', order: 40 })

  const render = (): void => {
    const mode = app.state.mode
    for (const m of MODES) modeButtons[m].setAttribute('aria-checked', String(mode === m))
    key.setValue(stage.state.key)
    tone.setValue(stage.state.tone)
    const info = INSTRUMENTS[stage.state.newStringInstrument]
    instrument.innerHTML = iconSvg(info.id, 22)
    instrument.style.color = info.color
    instrument.title = `New strings play: ${info.name}`
    instrument.disabled = !allows(mode, 'create-string')
  }
  render()
  app.changes.subscribe(render)
  stage.changes.subscribe(render)
}

/** True when a key press is going into a text field. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}
