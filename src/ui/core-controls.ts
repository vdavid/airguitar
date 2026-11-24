import { INSTRUMENTS } from '../audio/instruments/catalog.ts'
import { allows } from '../gestures/mode.ts'
import { KEY_NAMES, TONE_ORDER, TONES, type ToneId } from '../music/theory.ts'
import { iconSvg } from '../render/icons.ts'
import type { AppStore, Mode } from '../state/app.ts'
import type { StageStore } from '../state/stage.ts'
import { selectDropdown } from './dropdown.ts'
import { ICON } from './icons.ts'
import { iconButton, type TopBar } from './topbar.ts'

/** The core's own top bar controls: brand, Build/Play, key, tone, and the new-string instrument. */
export function mountCoreControls(
  bar: TopBar,
  deps: { stage: StageStore; app: AppStore; openNewStringPicker: () => void; unlockAudio: () => void },
): void {
  const { stage, app } = deps

  const brand = document.createElement('div')
  brand.className = 'brand'
  brand.innerHTML = 'Air <b>guitar</b>'
  bar.mount(brand, { slot: 'start', order: 0 })

  // Build / Play: a two-button segmented toggle.
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
  const buildBtn = modeButton('build', ICON.build, 'Build: make, move, and change strings')
  const playBtn = modeButton('play', ICON.play, 'Play: just play, the layout stays put')
  modes.append(buildBtn, playBtn)
  bar.mount(modes, { slot: 'start', order: 10 })

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
    buildBtn.setAttribute('aria-checked', String(mode === 'build'))
    playBtn.setAttribute('aria-checked', String(mode === 'play'))
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
