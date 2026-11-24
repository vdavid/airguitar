import type { AppContext } from '../app.ts'
import { checklistDropdown, selectDropdown } from '../ui/dropdown.ts'
import { group, iconButton } from '../ui/topbar.ts'
import './beats.css'
import { BEAT_ICON } from './icons.ts'
import { BEAT_IDS, BEATS, PART_IDS, type BeatId, type PartId } from './patterns.ts'
import { BeatPlayer } from './player.ts'
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
 * The beat controls in the top bar (orders 100–199): the beat (incl. off), its parts, and the
 * tempo. Returns the player, so recording can render stems from it.
 */
export function mountBeats(ctx: AppContext): BeatPlayer {
  const player = new BeatPlayer(ctx.audio, ctx.stage)

  const beat = selectDropdown<BeatChoice>({
    icon: BEAT_ICON.beat,
    label: 'Beat: a backing rhythm in your key',
    options: [{ value: 'off', label: 'Off' }, ...BEAT_IDS.map((id) => ({ value: id, label: BEATS[id].name }))],
    value: 'off',
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

  const value = document.createElement('span')
  value.className = 'bpm-value'
  value.title = 'Tempo in beats per minute'
  const nudge = (d: number): void => {
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
  const tempo = group(slower, value, faster)
  tempo.classList.add('tempo')
  ctx.topBar.mount(tempo, { slot: 'end', order: 120 })

  const render = (): void => {
    const s = player.state
    beat.setValue(s.beat ?? 'off')
    value.textContent = String(s.bpm)
    slower.disabled = s.bpm <= MIN_BPM
    faster.disabled = s.bpm >= MAX_BPM
    tempo.classList.toggle('idle', s.beat === null)
    for (const p of PART_IDS) parts.setChecked(p, s.parts.has(p))
  }
  player.changes.subscribe(render)
  render()
  return player
}
