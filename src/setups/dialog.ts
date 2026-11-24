import type { AppContext } from '../app.ts'
import { KEY_NAMES, TONES } from '../music/theory.ts'
import type { StageSnapshot } from '../state/stage.ts'
import { ICON } from '../ui/icons.ts'
import { createModal, dialogButton, section } from '../ui/modal.ts'
import { browserStorage } from '../ui/storage.ts'
import { iconButton } from '../ui/topbar.ts'
import { STARTERS, starterSnapshot } from './starters.ts'
import {
  cleanName,
  loadSetups,
  MAX_FILE_BYTES,
  MAX_NAME_LENGTH,
  saveSetups,
  setupFileName,
  setupFromFile,
  setupToFile,
  upsertSetup,
} from './store.ts'

/**
 * The Setups dialog: start from a ready-made layout, save the stage under a name (in this
 * browser), load or delete saved ones, and move a setup between computers as a file.
 */

/** "8 strings · A minor pentatonic" */
export function describeStage(s: StageSnapshot): string {
  const n = s.strings.length
  const tone = s.tone === 'free' ? 'free tuning' : `${KEY_NAMES[s.key] ?? ''} ${TONES[s.tone].name.toLowerCase()}`
  return `${String(n)} ${n === 1 ? 'string' : 'strings'} · ${tone}`
}

export function mountSetups(ctx: AppContext): void {
  const storage = browserStorage()
  const modal = createModal({
    id: 'setups-modal',
    title: 'Setups',
    wide: true,
    onOpen: () => {
      ctx.picker.close()
      renderList()
    },
  })

  const load = (stage: StageSnapshot, message: string): boolean => {
    try {
      ctx.unlockAudio()
      ctx.stage.load(stage)
      modal.close()
      ctx.toast(message)
      return true
    } catch (err) {
      ctx.toast(err instanceof Error ? err.message : 'That setup didn’t load.', 4500)
      return false
    }
  }

  // Ready-made layouts.
  const tiles = document.createElement('div')
  tiles.className = 'tiles'
  for (const st of STARTERS) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'tile'
    b.dataset['starter'] = st.id
    const name = document.createElement('b')
    name.textContent = st.name
    const desc = document.createElement('span')
    desc.textContent = st.description
    b.append(name, desc)
    b.addEventListener('click', () => {
      const { width, height } = ctx.stage.state
      load(starterSnapshot(st, height > width), `${st.name} is on the stage.`)
    })
    tiles.append(b)
  }

  // Saved setups.
  const list = document.createElement('div')
  list.className = 'setup-list'
  const renderList = (): void => {
    const setups = loadSetups(storage)
    list.replaceChildren()
    if (setups.length === 0) {
      const p = document.createElement('p')
      p.className = 'small'
      p.textContent = 'Nothing saved yet. Build a stage you like, then save it here.'
      list.append(p)
      return
    }
    setups.forEach((s, i) => {
      const row = document.createElement('div')
      row.className = 'mrow'
      const grow = document.createElement('span')
      grow.className = 'grow'
      const name = document.createElement('b')
      name.textContent = s.name
      const small = document.createElement('small')
      small.textContent = describeStage(s.stage)
      grow.append(name, small)
      const loadBtn = dialogButton('Load', () => {
        load(s.stage, `Loaded “${s.name}”.`)
      })
      const del = dialogButton('Delete', () => {
        const now = loadSetups(storage)
        if (
          saveSetups(
            storage,
            now.filter((_, j) => j !== i),
          )
        )
          ctx.toast(`Deleted “${s.name}”.`)
        renderList()
      })
      del.setAttribute('aria-label', `Delete “${s.name}”`)
      row.append(grow, loadBtn, del)
      list.append(row)
    })
  }

  // Save row.
  const saveRow = document.createElement('div')
  saveRow.className = 'saverow'
  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.maxLength = MAX_NAME_LENGTH
  nameInput.placeholder = 'Name this setup'
  nameInput.setAttribute('aria-label', 'Setup name')
  const nothingToSave = (): boolean => {
    if (ctx.stage.state.strings.length > 0) return false
    ctx.toast('There’s nothing on the stage to save yet.')
    return true
  }
  const save = (): void => {
    if (nothingToSave()) return
    const current = loadSetups(storage)
    const name = cleanName(nameInput.value, current.length)
    const { list: next, updated } = upsertSetup(current, { name, saved: Date.now(), stage: ctx.stage.snapshot() })
    if (!saveSetups(storage, next)) {
      ctx.toast('This browser won’t keep setups. Use “Save to a file” instead.', 4500)
      return
    }
    nameInput.value = ''
    ctx.toast(updated ? `Updated “${name}”.` : `Saved “${name}”.`)
    renderList()
  }
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save()
  })
  saveRow.append(nameInput, dialogButton('Save current stage', save, { primary: true }))

  const note = document.createElement('p')
  note.className = 'small'
  note.textContent =
    'A setup keeps the strings, their instruments, the key, and the tone. Saved setups stay in this browser; a file can go to another computer.'

  // Files.
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = '.json,application/json'
  fileInput.className = 'hidden-input'
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    fileInput.value = ''
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      ctx.toast('That file is too big to be a setup.')
      return
    }
    file
      .text()
      .then((text) => {
        const { name, stage } = setupFromFile(text, file.name)
        load(stage, `Loaded “${name}”.`)
      })
      .catch((err: unknown) => {
        ctx.toast(err instanceof Error ? err.message : 'That file couldn’t be read.', 4500)
      })
  })
  const toFile = (): void => {
    if (nothingToSave()) return
    const name = cleanName(nameInput.value, 0)
    const url = URL.createObjectURL(new Blob([setupToFile(name, ctx.stage.snapshot())], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = setupFileName(nameInput.value.trim() || 'setup')
    a.click()
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 10_000)
  }

  const actions = document.createElement('div')
  actions.className = 'actions'
  actions.append(
    dialogButton('Save to a file', toFile),
    dialogButton('Load from a file', () => {
      fileInput.click()
    }),
    dialogButton('Clear the stage', () => {
      ctx.stage.clear()
      modal.close()
      ctx.toast('The stage is empty.')
    }),
    dialogButton('Close', () => {
      modal.close()
    }),
    fileInput,
  )

  modal.card.append(section('Start from a layout'), tiles, section('Your setups'), list, saveRow, note, actions)

  const button = iconButton({
    icon: ICON.setups,
    label: 'Setups: save, load, and ready-made layouts',
    onClick: () => {
      modal.open()
    },
  })
  ctx.topBar.mount(button, { slot: 'end', order: 300 })
}
