/**
 * The 24 instruments, in picker order: six to a row, one family per row (Music Maker's palette).
 * This is metadata only. The sound for each id lives in the registry (`registry.ts`).
 */

export const INSTRUMENT_IDS = [
  'guitar',
  'egtr',
  'harp',
  'oud',
  'qanun',
  'sitar',
  'piano',
  'epiano',
  'organ',
  'marimba',
  'kalimba',
  'steelpan',
  'violin',
  'cello',
  'strings',
  'flute',
  'trumpet',
  'voices',
  'bells',
  'synth',
  'bass',
  'sub',
  'drums',
  'handdrums',
] as const

export type InstrumentId = (typeof INSTRUMENT_IDS)[number]

/** Per-instrument mixing: input gain, reverb send, and optional amp drive / presence peak / lowpass. */
export interface MixConfig {
  readonly gain: number
  readonly reverb: number
  readonly drive?: number
  readonly peakHz?: number
  readonly lowpassHz?: number
}

export interface InstrumentInfo {
  readonly id: InstrumentId
  readonly name: string
  readonly color: string
  /**
   * The octave a reference-length string plays in: its base pitch is the C of this octave
   * (MIDI `12 * (octave + 1)`), so guitar (3) is C3. Shorter strings go up from there.
   */
  readonly octave: number
  readonly mix: MixConfig
}

const info = (
  id: InstrumentId,
  name: string,
  color: string,
  octave: number,
  mix: MixConfig,
): readonly [InstrumentId, InstrumentInfo] => [id, { id, name, color, octave, mix }]

export const INSTRUMENTS: Readonly<Record<InstrumentId, InstrumentInfo>> = Object.fromEntries([
  info('guitar', 'Guitar', '#ffd166', 3, { gain: 0.8, reverb: 0.16 }),
  info('egtr', 'Electric guitar', '#ff5d73', 3, { gain: 0.42, reverb: 0.2, drive: 7, lowpassHz: 3600 }),
  info('harp', 'Harp', '#8ff0c0', 4, { gain: 0.85, reverb: 0.3 }),
  info('oud', 'Oud', '#ff9e6b', 3, { gain: 0.85, reverb: 0.14 }),
  info('qanun', 'Qanun', '#c9e265', 4, { gain: 0.8, reverb: 0.24 }),
  info('sitar', 'Sitar', '#e6a0ff', 3, { gain: 0.7, reverb: 0.26, peakHz: 2700 }),
  info('piano', 'Piano', '#dfeaff', 3, { gain: 0.75, reverb: 0.2 }),
  info('epiano', 'Electric piano', '#9fb8ff', 3, { gain: 0.5, reverb: 0.22 }),
  info('organ', 'Organ', '#d9a877', 3, { gain: 0.75, reverb: 0.26 }),
  info('marimba', 'Marimba', '#f2b880', 4, { gain: 0.85, reverb: 0.2 }),
  info('kalimba', 'Kalimba', '#7fe0d0', 4, { gain: 0.85, reverb: 0.3 }),
  info('steelpan', 'Steel pan', '#5fd4f4', 4, { gain: 0.8, reverb: 0.3 }),
  info('violin', 'Violin', '#ffa8c5', 4, { gain: 0.55, reverb: 0.32 }),
  info('cello', 'Cello', '#d98cb3', 2, { gain: 0.7, reverb: 0.3 }),
  info('strings', 'Strings', '#ff8fd0', 3, { gain: 0.5, reverb: 0.35 }),
  info('flute', 'Flute', '#9eeaff', 4, { gain: 0.6, reverb: 0.34 }),
  info('trumpet', 'Trumpet', '#f5b83d', 4, { gain: 0.8, reverb: 0.28 }),
  info('voices', 'Voices', '#d4c5ff', 3, { gain: 2.6, reverb: 0.4 }),
  info('bells', 'Bells', '#fff59a', 5, { gain: 0.5, reverb: 0.4 }),
  info('synth', 'Synth', '#6dff9c', 4, { gain: 0.4, reverb: 0.2 }),
  info('bass', 'Bass', '#7aa8ff', 1, { gain: 1, reverb: 0.03, lowpassHz: 1400 }),
  info('sub', '808 bass', '#5b8cff', 1, { gain: 0.9, reverb: 0 }),
  info('drums', 'Drums', '#ff6b6b', 3, { gain: 0.9, reverb: 0.07 }),
  info('handdrums', 'Hand drums', '#ff8552', 3, { gain: 0.9, reverb: 0.07 }),
]) as Record<InstrumentId, InstrumentInfo>

export function isInstrumentId(value: unknown): value is InstrumentId {
  return typeof value === 'string' && (INSTRUMENT_IDS as readonly string[]).includes(value)
}

/** MIDI pitch a reference-length string plays on this instrument, before key snapping. */
export function baseMidi(id: InstrumentId): number {
  return 12 * (INSTRUMENTS[id].octave + 1)
}
