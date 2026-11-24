import type { AudioEngine } from '../audio/engine.ts'
import type { StageStore } from '../state/stage.ts'
import { PcmTap } from './tap.ts'
import { interleave16 } from './wav.ts'

export type RecordMode = 'video' | 'audio'

/** A finished recording. The sound is always kept uncompressed, for WAV and MP3. */
export interface Take {
  /** The video with sound, or null for a sound-only take (or a browser that can't record video). */
  readonly video: Blob | null
  readonly videoExt: 'mp4' | 'webm'
  /** Interleaved 16-bit stereo. */
  readonly pcm: readonly Int16Array[]
  readonly sampleRate: number
}

const MIME_CANDIDATES = [
  'video/mp4;codecs="avc1.64001F,mp4a.40.2"',
  'video/mp4;codecs="avc1.42E01F,mp4a.40.2"',
  'video/mp4;codecs="avc1,mp4a.40.2"',
  'video/webm;codecs="vp9,opus"',
  'video/webm;codecs="vp8,opus"',
  'video/webm',
]

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
}

/**
 * Records the performance: the stage canvas (which already has the camera picture, strings, and
 * hands drawn on it) with the final mix as its sound, or the sound alone. The canvas is copied
 * each frame into a fixed-size canvas at the stage's size (1280 × 720 or 720 × 1280), so the video
 * keeps one resolution even if the window is resized mid-take.
 */
export class Recorder {
  /** Null when the browser can't run the tap (no AudioWorklet). */
  private tap: Promise<PcmTap | null> | null = null
  private streamDest: MediaStreamAudioDestinationNode | null = null
  private media: MediaRecorder | null = null
  private chunks: Blob[] = []
  private mime = ''
  private frame = 0
  private active = false

  constructor(
    private readonly audio: AudioEngine,
    private readonly stage: StageStore,
    private readonly stageCanvas: HTMLCanvasElement,
  ) {}

  get recording(): boolean {
    return this.active
  }

  /** Starts a take. Returns the mode actually used (video falls back to sound without MediaRecorder). */
  async start(mode: RecordMode): Promise<RecordMode> {
    if (this.active) return mode
    const graph = this.audio.start()
    const ctx = this.audio.ctx
    if (!ctx) throw new Error('Audio didn’t start.')
    this.tap ??= PcmTap.create(ctx, graph.output).catch((err: unknown) => {
      console.warn("The sound tap didn't start; video takes recover their sound from the video file.", err)
      return null
    })
    const tap = await this.tap
    let used = mode
    this.chunks = []
    this.media = null
    if (mode === 'video' && typeof MediaRecorder === 'undefined') used = 'audio'
    if (used === 'video') {
      this.streamDest ??= (() => {
        const d = new MediaStreamAudioDestinationNode(ctx, { channelCount: 2 })
        graph.output.connect(d)
        return d
      })()
      const stream = this.compositeStream()
      for (const track of this.streamDest.stream.getAudioTracks()) stream.addTrack(track)
      this.mime = pickMime()
      const opts: MediaRecorderOptions = { videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 192_000 }
      if (this.mime) opts.mimeType = this.mime
      const media = new MediaRecorder(stream, opts)
      media.ondataavailable = (e) => {
        if (e.data.size) this.chunks.push(e.data)
      }
      media.start(1000)
      this.media = media
    }
    if (!tap && used === 'audio') throw new Error("This browser can't record sound on its own.")
    tap?.start()
    this.active = true
    return used
  }

  async stop(): Promise<Take> {
    const ctx = this.audio.ctx
    if (!this.active || !ctx || !this.tap) throw new Error('Not recording.')
    this.active = false
    const tap = await this.tap
    const [pcm, video] = await Promise.all([tap ? tap.stop() : Promise.resolve([]), this.stopVideo()])
    const videoExt = this.mime.startsWith('video/mp4') ? 'mp4' : 'webm'
    if (pcm.length === 0 && video)
      return { video, videoExt, pcm: await pcmFromVideo(ctx, video), sampleRate: ctx.sampleRate }
    return { video, videoExt, pcm, sampleRate: ctx.sampleRate }
  }

  private compositeStream(): MediaStream {
    const { width, height } = this.stage.state
    const out = document.createElement('canvas')
    out.width = width
    out.height = height
    const g = out.getContext('2d')
    const draw = (): void => {
      g?.drawImage(this.stageCanvas, 0, 0, width, height)
      this.frame = requestAnimationFrame(draw)
    }
    cancelAnimationFrame(this.frame)
    draw()
    return out.captureStream(30)
  }

  private stopVideo(): Promise<Blob | null> {
    const media = this.media
    if (!media) return Promise.resolve(null)
    return new Promise((resolve) => {
      media.onstop = () => {
        cancelAnimationFrame(this.frame)
        for (const t of media.stream.getVideoTracks()) t.stop()
        this.media = null
        resolve(new Blob(this.chunks, { type: this.mime || 'video/webm' }))
      }
      media.stop()
    })
  }
}

/** If the live tap caught nothing, recover the sound from the recorded video file. */
async function pcmFromVideo(ctx: BaseAudioContext, video: Blob): Promise<Int16Array[]> {
  try {
    const buf = await ctx.decodeAudioData(await video.arrayBuffer())
    const left = buf.getChannelData(0)
    return [interleave16(left, buf.numberOfChannels > 1 ? buf.getChannelData(1) : left)]
  } catch {
    return []
  }
}
