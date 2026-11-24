import { INSTRUMENTS, type InstrumentId } from './instruments/catalog.ts'
import { makeImpulse } from './reverb.ts'

/**
 * The mixing graph, built the same way on a live `AudioContext` or an `OfflineAudioContext` (for
 * rendering stems):
 *
 *   instrument voices → per-instrument bus (gain, drive, peak, lowpass, reverb send) ─┐
 *                                                                     instruments bus ─┤
 *   beats (scheduled by the beat player) ────────────────────────────────── beats bus ─┼→ master
 *   reverb (shared convolver, fed by the per-instrument sends) ────────────────────────┘
 *   master → highpass → lowpass → compressor → output → destination
 *            └→ echo send → delay (with feedback) → highpass
 *
 * `output` is the final mix: tap it to record. The filters and echo are the performance sweep.
 */
export interface MixGraph {
  readonly ctx: BaseAudioContext
  /** Live playing: every string's instrument bus ends here. */
  readonly instruments: GainNode
  /** For the beat player: connect drum and backing voices here. */
  readonly beats: GainNode
  readonly master: GainNode
  /** The final mix, after the compressor. Connected to the destination already. */
  readonly output: GainNode
  readonly reverb: ConvolverNode
  readonly highpass: BiquadFilterNode
  readonly lowpass: BiquadFilterNode
  readonly echoSend: GainNode
  readonly echoDelay: DelayNode
  readonly noise: AudioBuffer
  /** The input for one instrument on a given bus (created on first use, then reused). */
  instrumentBus(id: InstrumentId, bus?: AudioNode): AudioNode
}

export function createMixGraph(ctx: BaseAudioContext, opts: { volume?: number } = {}): MixGraph {
  const master = new GainNode(ctx, { gain: opts.volume ?? 0.9 })
  const output = new GainNode(ctx, { gain: 0.9 })
  const highpass = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 20, Q: 0.8 })
  const lowpass = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 20000, Q: 0.9 })
  const comp = new DynamicsCompressorNode(ctx, { threshold: -16, knee: 12, ratio: 4, attack: 0.004, release: 0.18 })
  master.connect(highpass).connect(lowpass).connect(comp).connect(output).connect(ctx.destination)

  const echoSend = new GainNode(ctx, { gain: 0 })
  const echoDelay = new DelayNode(ctx, { maxDelayTime: 2, delayTime: 0.4 })
  const feedback = new GainNode(ctx, { gain: 0.42 })
  master.connect(echoSend).connect(echoDelay).connect(feedback).connect(echoDelay)
  echoDelay.connect(highpass)

  const instruments = new GainNode(ctx, { gain: 0.85 })
  const beats = new GainNode(ctx, { gain: 0.8 })
  instruments.connect(master)
  beats.connect(master)

  const reverb = new ConvolverNode(ctx)
  const [l, r] = makeImpulse(ctx.sampleRate)
  if (l && r) {
    const ir = ctx.createBuffer(2, l.length, ctx.sampleRate)
    ir.copyToChannel(l, 0)
    ir.copyToChannel(r, 1)
    reverb.buffer = ir
  }
  reverb.connect(new GainNode(ctx, { gain: 0.9 })).connect(master)

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const nd = noise.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1

  const buses = new Map<AudioNode, Map<InstrumentId, AudioNode>>()
  const instrumentBus = (id: InstrumentId, bus: AudioNode = instruments): AudioNode => {
    let cache = buses.get(bus)
    if (!cache) {
      cache = new Map()
      buses.set(bus, cache)
    }
    const hit = cache.get(id)
    if (hit) return hit
    const input = buildInstrumentBus(ctx, id, bus, reverb)
    cache.set(id, input)
    return input
  }

  return {
    ctx,
    instruments,
    beats,
    master,
    output,
    reverb,
    highpass,
    lowpass,
    echoSend,
    echoDelay,
    noise,
    instrumentBus,
  }
}

/** One instrument's tone shaping and reverb send, from its catalog mix config. */
function buildInstrumentBus(ctx: BaseAudioContext, id: InstrumentId, dest: AudioNode, reverb: AudioNode): AudioNode {
  const cfg = INSTRUMENTS[id].mix
  const input = new GainNode(ctx, { gain: cfg.gain })
  let tail: AudioNode = input
  if (cfg.drive !== undefined) {
    // An amplifier: push the signal into a soft clipper.
    const curve = new Float32Array(1025)
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / 512 - 1) * 1.6) * 0.8
    const pre = new GainNode(ctx, { gain: cfg.drive })
    const shaper = new WaveShaperNode(ctx, { curve, oversample: '2x' })
    tail = tail.connect(pre).connect(shaper)
  }
  if (cfg.peakHz !== undefined) {
    tail = tail.connect(new BiquadFilterNode(ctx, { type: 'peaking', frequency: cfg.peakHz, Q: 1.2, gain: 7 }))
  }
  if (cfg.lowpassHz !== undefined) {
    tail = tail.connect(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: cfg.lowpassHz }))
  }
  tail.connect(dest)
  if (cfg.reverb > 0) tail.connect(new GainNode(ctx, { gain: cfg.reverb })).connect(reverb)
  return input
}
