import type { InstrumentId } from './catalog.ts'
import { GUITAR } from './karplus.ts'
import { createPluckedInstrument } from './plucked.ts'
import type { Instrument } from './types.ts'

/**
 * Which sound each instrument id makes. The catalog (`catalog.ts`) lists all 24 for the picker;
 * an id with no registered sound yet plays the guitar, so every tile works.
 *
 * Add an instrument: implement `Instrument` in its own file and register it in `REGISTERED` below.
 */

const guitar = createPluckedInstrument('guitar', GUITAR)

const REGISTERED: Partial<Record<InstrumentId, Instrument>> = {
  guitar,
}

export function getInstrument(id: InstrumentId): Instrument {
  return REGISTERED[id] ?? guitar
}

/** True when the id has its own sound (not the guitar placeholder). */
export function hasOwnSound(id: InstrumentId): boolean {
  return REGISTERED[id] !== undefined
}
