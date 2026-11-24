import type { InstrumentId } from './catalog.ts'
import { drums, handDrums } from './drums.ts'
import { subBass, synth } from './electronic.ts'
import { epiano, organInstrument, piano } from './keys.ts'
import { bells, kalimba, marimba, steelpan } from './mallets.ts'
import { cello, fluteInstrument, strings, trumpetInstrument, violin, voicesInstrument } from './orchestra.ts'
import { bass, electricGuitar, guitar, harp, oud, qanun, sitar } from './plucked.ts'
import { fitRange } from './range.ts'
import type { Instrument } from './types.ts'

/**
 * Which sound each instrument id makes. The catalog (`catalog.ts`) lists all 24 for the picker
 * (names, colors, octaves, mix); this maps each id to its synthesized sound, one file per family.
 */
const REGISTERED: Readonly<Record<InstrumentId, Instrument>> = {
  guitar,
  egtr: electricGuitar,
  harp,
  oud,
  qanun,
  sitar,
  piano,
  epiano,
  organ: organInstrument,
  marimba,
  kalimba,
  steelpan,
  violin,
  cello,
  strings,
  flute: fluteInstrument,
  trumpet: trumpetInstrument,
  voices: voicesInstrument,
  bells,
  synth,
  bass,
  sub: subBass,
  drums,
  handdrums: handDrums,
}

export function getInstrument(id: InstrumentId): Instrument {
  return REGISTERED[id]
}

/** The pitch an instrument actually sounds for `midi`, after folding into its range. */
export function soundingPitch(id: InstrumentId, midi: number): number {
  const range = getInstrument(id).range
  return range ? fitRange(midi, range) : midi
}
