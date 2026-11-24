import { interleave16 } from './wav.ts'

/**
 * A tap on the final mix that keeps the sound uncompressed while recording, so it can be saved as
 * WAV or MP3 afterwards. An AudioWorklet copies blocks to the main thread (without
 * worklets, a video take recovers its sound from the video file). The tap's output goes through
 * a muted gain to the destination, because a node that leads nowhere isn't processed.
 */

const WORKLET = `
class PcmTap extends AudioWorkletProcessor {
  constructor() {
    super()
    this.on = false
    this.l = new Float32Array(4096)
    this.r = new Float32Array(4096)
    this.n = 0
    this.port.onmessage = (e) => { this.on = e.data.on; if (!this.on) this.flush() }
  }
  flush() {
    if (this.n) { this.port.postMessage({ l: this.l.slice(0, this.n), r: this.r.slice(0, this.n) }); this.n = 0 }
  }
  process(inputs) {
    const i = inputs[0]
    if (this.on && i && i[0]) {
      const L = i[0], R = i[1] || i[0]
      if (this.n + L.length > 4096) this.flush()
      this.l.set(L, this.n); this.r.set(R, this.n); this.n += L.length
    }
    return true
  }
}
registerProcessor('airguitar-pcm-tap', PcmTap)
`

interface TapMessage {
  readonly l: Float32Array
  readonly r: Float32Array
}

export class PcmTap {
  private chunks: Int16Array[] = []
  private recording = false

  private constructor(private readonly setOn: (on: boolean) => void) {}

  static async create(ctx: AudioContext, source: AudioNode): Promise<PcmTap> {
    const mute = new GainNode(ctx, { gain: 0 })
    mute.connect(ctx.destination)
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }))
    try {
      await ctx.audioWorklet.addModule(url)
    } finally {
      URL.revokeObjectURL(url)
    }
    const node = new AudioWorkletNode(ctx, 'airguitar-pcm-tap', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 2,
      channelCountMode: 'explicit',
    })
    const tap = new PcmTap((on) => {
      node.port.postMessage({ on })
    })
    node.port.onmessage = (e: MessageEvent<TapMessage>) => {
      tap.push(e.data.l, e.data.r)
    }
    source.connect(node).connect(mute)
    return tap
  }

  /** Starts a new take (drops whatever the last one captured). */
  start(): void {
    this.chunks = []
    this.recording = true
    this.setOn(true)
  }

  /**
   * Stops and returns the take's interleaved 16-bit chunks. Waits a moment so the worklet's last
   * block arrives.
   */
  async stop(): Promise<Int16Array[]> {
    this.setOn(false)
    await new Promise((r) => setTimeout(r, 200))
    this.recording = false
    const out = this.chunks
    this.chunks = []
    return out
  }

  private push(l: Float32Array, r: Float32Array): void {
    if (this.recording) this.chunks.push(interleave16(l, r))
  }
}
