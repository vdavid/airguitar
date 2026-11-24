import { clamp } from '../geom.ts'
import { snapToScale, type ToneId } from './theory.ts'

/**
 * One pitch per string, set by its length, like a real string: frequency goes with 1/length, so
 * halving a string raises it an octave. Then it snaps to the key + tone so every string sounds in
 * key ("Free" skips the snap).
 *
 * Lengths are relative to the stage diagonal, so the same gesture gives the same note at any
 * stage size.
 */

/** A string this long (relative to the stage diagonal) plays the instrument's base note. */
export const REF_REL_LENGTH = 0.75
/** Shorter strings than this play as if they were this long (about 3.4 octaves above the base). */
export const MIN_REL_LENGTH = 0.07
/** Longer strings than this play as if they were this long (a few semitones below the base). */
export const MAX_REL_LENGTH = 1

/** Continuous pitch (MIDI, fractional) for a string, before snapping. */
export function rawPitch(lengthPx: number, stageDiagonalPx: number, baseMidi: number): number {
  const rel = clamp(lengthPx / stageDiagonalPx, MIN_REL_LENGTH, MAX_REL_LENGTH)
  return baseMidi + 12 * Math.log2(REF_REL_LENGTH / rel)
}

/** The pitch a string plays: length → pitch, snapped to the key + tone. */
export function stringPitch(
  lengthPx: number,
  stageDiagonalPx: number,
  baseMidi: number,
  key: number,
  tone: ToneId,
): number {
  return snapToScale(rawPitch(lengthPx, stageDiagonalPx, baseMidi), key, tone)
}
