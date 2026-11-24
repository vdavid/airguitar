/**
 * Every instrument has a range it sounds good in. Strings span about 3.8 octaves (`music/pitch.ts`),
 * which is more than most instruments have, so a pitch outside the range folds back in by whole
 * octaves (Music Maker did the same). The note name stays; only the octave changes.
 */

export interface Range {
  /** Lowest MIDI note that sounds good. */
  readonly lo: number
  /** Highest MIDI note that sounds good. At least an octave above `lo`. */
  readonly hi: number
}

/** Folds `midi` into the range by octaves. Fractional pitches fold with their nearest note. */
export function fitRange(midi: number, range: Range): number {
  const near = Math.round(midi)
  let m = near
  while (m > range.hi) m -= 12
  while (m < range.lo) m += 12
  return midi + (m - near)
}
