import type { BeatPlayer } from '../beats/player.ts'
import { STEM_TAIL } from '../beats/player.ts'
import { BEATS, PART_IDS, type PartId } from '../beats/patterns.ts'
import { stepDuration } from '../beats/scheduler.ts'
import { KEY_NAMES, TONES, type ToneId } from '../music/theory.ts'
import { wavFromChannels } from './wav.ts'
import { zipParts, type ZipEntry } from './zip.ts'

export const STEM_BARS = 4

/**
 * Beat-part stems: each part that's on, rendered alone, plus the full beat, as WAVs in one zip.
 * Rendered offline (faster than real time) at the current tempo and key, all the same length and
 * starting on the same downbeat, so they line up when dropped into an editor.
 */
export async function renderStems(
  player: BeatPlayer,
  opts: { sampleRate: number; volume: number; key: number; tone: ToneId; onStatus: (text: string) => void },
): Promise<{ blob: Blob; count: number }> {
  const s = player.state
  if (s.beat === null) throw new Error('Pick a beat first. Stems are made from its parts.')
  const beat = BEATS[s.beat]
  const on = PART_IDS.filter((p) => s.parts.has(p))
  if (on.length === 0) throw new Error('Switch on a beat part first. Stems are made from those.')
  const safe = (t: string): string => t.replace(/[^\w +-]+/g, '').trim()
  const jobs: { name: string; parts: ReadonlySet<PartId> }[] = [
    ...on.map((p) => ({ name: `Beat - ${safe(beat.labels[p])}`, parts: new Set([p]) })),
    { name: 'Full beat', parts: new Set(on) },
  ]
  const files: ZipEntry[] = []
  const lines: string[] = []
  for (const [i, job] of jobs.entries()) {
    opts.onStatus(`Rendering ${i + 1} of ${jobs.length}: ${job.name}`)
    await new Promise((r) => setTimeout(r, 0))
    const buf = await player.render(job.parts, STEM_BARS, opts.sampleRate, opts.volume)
    const left = buf.getChannelData(0)
    const w = wavFromChannels(left, buf.numberOfChannels > 1 ? buf.getChannelData(1) : left, buf.sampleRate)
    const file = `${String(i + 1).padStart(2, '0')} ${job.name}.wav`
    files.push({ name: file, bytes: w.bytes })
    lines.push(`${file}  (peak ${w.peak.toFixed(2)})`)
  }
  const secs = STEM_BARS * 16 * stepDuration(s.bpm)
  const info = [
    'Air guitar stems',
    '',
    `Tempo: ${s.bpm} BPM`,
    `Key: ${KEY_NAMES[opts.key] ?? '?'} ${TONES[opts.tone].name}`,
    `Beat: ${beat.name}`,
    `Length: ${STEM_BARS} bars (${secs.toFixed(2)} s) plus ${STEM_TAIL} s for the reverb to ring out.`,
    `Every file starts on the same downbeat. Trim each to ${secs.toFixed(2)} s to loop it.`,
    'Live playing isn’t in the stems; record a take for that.',
    '',
    ...lines,
  ].join('\r\n')
  files.push({ name: 'About these stems.txt', bytes: new TextEncoder().encode(info) })
  return { blob: new Blob(zipParts(files), { type: 'application/zip' }), count: jobs.length }
}
