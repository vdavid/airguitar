import type { AppContext } from '../app.ts'
import { LANDSCAPE } from '../state/stage.ts'
import { selectDropdown } from '../ui/dropdown.ts'
import { createModal, dialogButton, type Modal } from '../ui/modal.ts'
import { iconButton } from '../ui/topbar.ts'
import { RECORD_ICON } from './icons.ts'
import { encodeMp3, MP3_RATES } from './mp3.ts'
import { Recorder, type RecordMode, type Take } from './recorder.ts'
import './record.css'
import { renderStems } from './stems.ts'
import { deinterleave, wavFromPcm16 } from './wav.ts'

type Shape = 'landscape' | 'vertical'

/** Takes stop by themselves after ten minutes (about 110 MB of sound in memory). */
const MAX_SECONDS = 600

const stamp = (): string => {
  const d = new Date()
  const z = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`
}

const mb = (bytes: number): string => `${(bytes / 1048576).toFixed(1)} MB`

function download(blob: Blob, name: string): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => {
    URL.revokeObjectURL(a.href)
  }, 4000)
}

/**
 * Recording in the top bar (orders 200–299): what to record (video with sound, or sound only),
 * the stage shape (landscape or vertical), the record button, and beat stems. A finished take
 * opens a dialog to save it as video (MP4 or WebM), MP3, or WAV.
 */
export function mountRecording(ctx: AppContext): void {
  const canvas = document.getElementById('stage')
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing #stage')
  const recorder = new Recorder(ctx.audio, ctx.stage, canvas)
  const dialog = new TakeDialog()
  let mode: RecordMode = 'video'

  const modeDd = selectDropdown<RecordMode>({
    icon: RECORD_ICON.video,
    label: 'What to record',
    options: [
      { value: 'video', label: 'Video with sound', short: '', icon: RECORD_ICON.video },
      { value: 'audio', label: 'Sound only', short: '', icon: RECORD_ICON.audio },
    ],
    value: mode,
    onChange: (v) => {
      mode = v
    },
  })
  ctx.topBar.mount(modeDd.element, { slot: 'end', order: 200 })

  const shapeOf = (): Shape => (ctx.stage.state.width >= ctx.stage.state.height ? 'landscape' : 'vertical')
  const shapeDd = selectDropdown<Shape>({
    icon: RECORD_ICON.landscape,
    label: 'Stage shape: landscape, or vertical for phones',
    options: [
      { value: 'landscape', label: 'Landscape', short: '', icon: RECORD_ICON.landscape },
      { value: 'vertical', label: 'Vertical', short: '', icon: RECORD_ICON.vertical },
    ],
    value: shapeOf(),
    onChange: (v) => {
      if (recorder.recording) {
        ctx.toast('Stop the recording before changing the shape.')
        shapeDd.setValue(shapeOf())
        return
      }
      if (v === 'vertical') ctx.stage.setSize(LANDSCAPE.height, LANDSCAPE.width)
      else ctx.stage.setSize(LANDSCAPE.width, LANDSCAPE.height)
    },
  })
  ctx.stage.changes.subscribe((c) => {
    if (c.type === 'size' || c.type === 'loaded') shapeDd.setValue(shapeOf())
  })
  ctx.topBar.mount(shapeDd.element, { slot: 'end', order: 210 })

  let startedAt = 0
  let timer: ReturnType<typeof setInterval> | undefined
  let busy = false
  const recBtn = iconButton({
    icon: RECORD_ICON.record,
    label: 'Record',
    text: '',
    onClick: () => {
      void toggle()
    },
  })
  recBtn.classList.add('rec-btn')
  const recTime = recBtn.querySelector('span')
  const showIdle = (): void => {
    recBtn.classList.remove('recording')
    recBtn.innerHTML = RECORD_ICON.record
    if (recTime) {
      recTime.textContent = ''
      recBtn.append(recTime)
    }
    recBtn.title = 'Record'
    recBtn.setAttribute('aria-label', 'Record')
  }
  const showRecording = (): void => {
    recBtn.classList.add('recording')
    recBtn.innerHTML = RECORD_ICON.stop
    if (recTime) recBtn.append(recTime)
    recBtn.title = 'Stop recording'
    recBtn.setAttribute('aria-label', 'Stop recording')
  }
  showIdle()

  async function toggle(): Promise<void> {
    if (busy) return
    busy = true
    try {
      if (recorder.recording) await stop()
      else await start()
    } catch (err) {
      console.error(err)
      ctx.toast(`Recording failed: ${err instanceof Error ? err.message : String(err)}`)
      showIdle()
    } finally {
      busy = false
    }
  }

  async function start(): Promise<void> {
    ctx.unlockAudio()
    const used = await recorder.start(mode)
    if (used !== mode) ctx.toast('This browser can’t record video, so only the sound is being recorded.')
    startedAt = performance.now()
    showRecording()
    timer = setInterval(() => {
      const s = Math.floor((performance.now() - startedAt) / 1000)
      if (recTime) recTime.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
      if (s >= MAX_SECONDS) {
        ctx.toast('Ten minutes reached, so the recording stopped.')
        void toggle()
      }
    }, 250)
  }

  async function stop(): Promise<void> {
    clearInterval(timer)
    const take = await recorder.stop()
    showIdle()
    dialog.show(take, `airguitar-${stamp()}`)
  }
  ctx.topBar.mount(recBtn, { slot: 'end', order: 220 })

  let rendering = false
  const stemsBtn = iconButton({
    icon: RECORD_ICON.stems,
    label: 'Save the beat parts as separate WAV files (a zip)',
    onClick: () => {
      if (rendering) return
      const ac = ctx.audio.start().ctx
      rendering = true
      stemsBtn.disabled = true
      renderStems(ctx.beats, {
        sampleRate: ac.sampleRate,
        volume: ctx.settings.state.volume,
        key: ctx.stage.state.key,
        tone: ctx.stage.state.tone,
        onStatus: (text) => {
          ctx.toast(text, 8000)
        },
      })
        .then(({ blob, count }) => {
          const name = `airguitar-stems-${stamp()}.zip`
          download(blob, name)
          ctx.toast(`Saved ${count} stems as ${name}.`)
        })
        .catch((err: unknown) => {
          ctx.toast(err instanceof Error ? err.message : String(err))
        })
        .finally(() => {
          rendering = false
          stemsBtn.disabled = false
        })
    },
  })
  ctx.topBar.mount(stemsBtn, { slot: 'end', order: 230 })
}

/** The "Your recording" dialog: a preview, and buttons to save the take in each format. */
class TakeDialog {
  private readonly modal: Modal = createModal({ id: 'take-dialog', title: 'Your recording' })
  private readonly video = document.createElement('video')
  private readonly audio = document.createElement('audio')
  private readonly note = document.createElement('p')
  private readonly saveVideo = dialogButton(
    'Save video',
    () => {
      if (this.take?.video) download(this.take.video, `${this.name}.${this.take.videoExt}`)
    },
    { primary: true },
  )
  private readonly saveMp3 = dialogButton('Save audio (.mp3)', () => {
    void this.downloadMp3()
  })
  private readonly saveWav = dialogButton('Save audio (.wav)', () => {
    if (this.wav) download(this.wav, `${this.name}.wav`)
  })
  private take: Take | null = null
  private name = ''
  private wav: Blob | null = null
  private mp3: Blob | null = null
  private urls: string[] = []

  constructor() {
    this.modal.element.classList.add('take-modal')
    this.video.controls = true
    this.video.playsInline = true
    this.audio.controls = true
    this.note.className = 'small'
    const actions = document.createElement('div')
    actions.className = 'actions'
    const close = dialogButton('Close', () => {
      this.modal.close()
    })
    actions.append(this.saveVideo, this.saveMp3, this.saveWav, close)
    this.modal.card.append(this.video, this.audio, this.note, actions)
    // However the dialog closes (button, backdrop, Escape), stop the preview.
    new MutationObserver(() => {
      if (!this.modal.isOpen) {
        this.video.pause()
        this.audio.pause()
      }
    }).observe(this.modal.element, { attributes: true, attributeFilter: ['class'] })
  }

  show(take: Take, name: string): void {
    this.reset()
    this.take = take
    this.name = name
    const frames = take.pcm.reduce((n, c) => n + c.length / 2, 0)
    this.wav = frames > 0 ? new Blob([wavFromPcm16(take.pcm, take.sampleRate)], { type: 'audio/wav' }) : null
    const hasVideo = take.video !== null
    const title = this.modal.card.querySelector('h2')
    if (title) title.textContent = hasVideo ? 'Your recording' : 'Your sound recording'
    this.video.hidden = !hasVideo
    this.audio.hidden = hasVideo || !this.wav
    this.saveVideo.hidden = !hasVideo
    if (take.video) {
      this.video.src = this.url(take.video)
      this.saveVideo.textContent = `Save video (.${take.videoExt}, ${mb(take.video.size)})`
    } else if (this.wav) {
      this.audio.src = this.url(this.wav)
    }
    this.saveMp3.textContent = 'Save audio (.mp3)'
    this.saveMp3.disabled = !this.wav || !MP3_RATES.includes(take.sampleRate)
    this.saveMp3.classList.toggle('primary', !hasVideo)
    this.saveWav.textContent = this.wav ? `Save audio (.wav, ${mb(this.wav.size)})` : 'Save audio (.wav)'
    this.saveWav.disabled = !this.wav
    this.note.textContent = !this.wav
      ? 'No sound was captured in this take, so there’s no audio file to save.'
      : hasVideo && take.videoExt !== 'mp4'
        ? 'This browser records video as WebM. The audio files play everywhere.'
        : ''
    this.modal.open()
  }

  private async downloadMp3(): Promise<void> {
    const take = this.take
    if (!take || !this.wav || this.saveMp3.disabled) return
    const b = this.saveMp3
    b.disabled = true
    try {
      if (!this.mp3) {
        const { left, right } = deinterleave(take.pcm)
        this.mp3 = await encodeMp3(left, right, take.sampleRate, (k) => {
          b.textContent = `Making MP3… ${Math.round(k * 100)}%`
        })
      }
      b.textContent = `Save audio (.mp3, ${mb(this.mp3.size)})`
      download(this.mp3, `${this.name}.mp3`)
      b.disabled = false
    } catch (err) {
      console.error(err)
      b.textContent = 'MP3 failed. Save the WAV instead'
    }
  }

  private url(blob: Blob): string {
    const u = URL.createObjectURL(blob)
    this.urls.push(u)
    return u
  }

  private reset(): void {
    this.video.removeAttribute('src')
    this.audio.removeAttribute('src')
    for (const u of this.urls) URL.revokeObjectURL(u)
    this.urls = []
    this.mp3 = null
  }
}
