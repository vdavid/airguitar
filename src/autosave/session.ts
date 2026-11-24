import { isBeatId, PART_IDS, type BeatId, type PartId } from '../beats/patterns.ts'
import { clampBpm } from '../beats/scheduler.ts'
import { MODES } from '../gestures/mode.ts'
import type { Mode } from '../state/app.ts'
import { parseSnapshot, type StageSnapshot } from '../state/stage.ts'

/**
 * The autosaved session: everything needed to reopen the app where it was left. The stage (strings,
 * key, tone, shape, new-string instrument) reuses the setups snapshot and its validation; the mode
 * and the beat ride along. Sound sliders are settings, which persist on their own.
 */

export const SESSION_KEY = 'airguitar-session-v1'

export interface Session {
  readonly version: 1
  readonly stage: StageSnapshot
  readonly mode: Mode
  readonly beat: { readonly beat: BeatId | null; readonly parts: readonly PartId[]; readonly bpm: number }
}

export function serializeSession(from: {
  stage: StageSnapshot
  mode: Mode
  beat: { beat: BeatId | null; parts: ReadonlySet<PartId>; bpm: number }
}): Session {
  return {
    version: 1,
    stage: from.stage,
    mode: from.mode,
    beat: { beat: from.beat.beat, parts: PART_IDS.filter((p) => from.beat.parts.has(p)), bpm: from.beat.bpm },
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Validates a stored session. Null for anything missing, corrupt, or from another version. */
export function parseSession(data: unknown): Session | null {
  if (!isRecord(data) || data['version'] !== 1) return null
  const { mode, beat } = data
  if (typeof mode !== 'string' || !MODES.includes(mode as Mode)) return null
  if (!isRecord(beat)) return null
  const id = beat['beat']
  if (id !== null && !isBeatId(id)) return null
  const parts = beat['parts']
  const bpm = beat['bpm']
  if (!Array.isArray(parts) || typeof bpm !== 'number' || !Number.isFinite(bpm)) return null
  let stage: StageSnapshot
  try {
    stage = parseSnapshot(data['stage'])
  } catch {
    return null
  }
  return {
    version: 1,
    stage,
    mode: mode as Mode,
    beat: { beat: id, parts: PART_IDS.filter((p) => parts.includes(p)), bpm: clampBpm(bpm) },
  }
}
