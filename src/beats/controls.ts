import type { AppContext } from '../app.ts'
import { checklistDropdown, selectDropdown } from '../ui/dropdown.ts'
import { iconButton } from '../ui/topbar.ts'
import './beats.css'
import { BEAT_ICON } from './icons.ts'
import { BEAT_IDS, BEATS, PART_IDS, type BeatId, type PartId } from './patterns.ts'
import { MAX_BPM, MIN_BPM } from './scheduler.ts'

const PART_LABELS: Readonly<Record<PartId, string>> = {
  kick: 'Kick',
  snare: 'Snare',
  hats: 'Hats',
  bass: 'Bass',
  chords: 'Chords',
}

type BeatChoice = BeatId | 'off'

/**
 * The beat controls in the top bar (orders 100–199): the beat dropdown (incl. off, with the tempo
 * at its bottom) and the parts checklist. The player itself is `ctx.beats`.
 */
export function mountBeats(ctx: AppContext): void {
  const player = ctx.beats

  // Tempo: − value +, inside the beat dropdown's panel.
  const value = document.createElement('span')
  value.className = 'bpm-value'
  const nudge = (d: number): void => {
    ctx.unlockAudio()
    player.setBpm(player.state.bpm + d)
  }
  const slower = iconButton({
    icon: BEAT_ICON.minus,
    label: 'Slower',
    onClick: () => {
      nudge(-4)
    },
  })
  const faster = iconButton({
    icon: BEAT_ICON.plus,
    label: 'Faster',
    onClick: () => {
      nudge(4)
    },
  })
  const tempo = document.createElement('div')
  tempo.className = 'tempo'
  const tempoLabel = document.createElement('span')
  tempoLabel.className = 'tempo-label'
  tempoLabel.textContent = 'Tempo'
  tempo.append(tempoLabel, slower, value, faster)

  const beat = selectDropdown<BeatChoice>({
    icon: BEAT_ICON.beat,
    label: 'Beat: a backing rhythm in your key',
    options: [{ value: 'off', label: 'Off' }, ...BEAT_IDS.map((id) => ({ value: id, label: BEATS[id].name }))],
    value: 'off',
    footer: tempo,
    onChange: (v) => {
      ctx.unlockAudio()
      player.setBeat(v === 'off' ? null : v)
    },
  })
  ctx.topBar.mount(beat.element, { slot: 'end', order: 100 })

  const parts = checklistDropdown<PartId>({
    icon: BEAT_ICON.parts,
    label: 'Beat parts: switch drums, bass, and chords on or off',
    text: '',
    items: PART_IDS.map((p) => ({ value: p, label: PART_LABELS[p], checked: player.state.parts.has(p) })),
    onToggle: (p, on) => {
      player.setPart(p, on)
    },
  })
  ctx.topBar.mount(parts.element, { slot: 'end', order: 110 })

  const render = (): void => {
    const s = player.state
    beat.setValue(s.beat ?? 'off')
    value.textContent = `${s.bpm} BPM`
    slower.disabled = s.bpm <= MIN_BPM
    faster.disabled = s.bpm >= MAX_BPM
    for (const p of PART_IDS) parts.setChecked(p, s.parts.has(p))
  }
  player.changes.subscribe(render)
  render()
}
