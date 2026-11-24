import { clamp, dist, type Vec } from '../geom.ts'
import { OPEN, OPEN_HAND, pinchPoint, pinchRatio, updatePinch, type PinchState } from '../gestures/pinch.ts'
import { dedupeHands, matchHands } from './match.ts'

/**
 * Keeps up to eight hands steady across frames: matches detections to known hands, smooths their
 * landmarks, and runs each hand's pinch. Every hand is independent; it doesn't matter whose it is.
 */

/** A hand missing for longer than this (seconds) is gone. */
const LOST_AFTER = 0.25
/** After a pinch opens, the hand waits this long (seconds) before plucking, so the release doesn't pluck. */
const PLUCK_AFTER_RELEASE = 0.25

export interface TrackedHand {
  /** Stable for as long as the hand stays tracked. */
  readonly id: number
  landmarks: Vec[]
  wrist: Vec
  seen: number
  pinch: PinchState
  ratio: number
  cursor: Vec
  lastRelease: number
}

export interface HandEvents {
  pinchDown(hand: TrackedHand): void
  pinchMove(hand: TrackedHand): void
  pinchUp(hand: TrackedHand): void
  lost(hand: TrackedHand): void
}

export class HandTracker {
  hands: TrackedHand[] = []
  private nextId = 1

  /** Feeds one frame of detections (stage units). */
  update(detections: readonly (readonly Vec[])[], t: number, sensitivity: number, events: HandEvents): void {
    const dets = dedupeHands(detections).filter((d) => d.length >= 21)
    const match = matchHands(
      this.hands.map((h) => h.wrist),
      dets.map((d) => d[0] ?? { x: 0, y: 0 }),
    )
    const updated = new Set<TrackedHand>()
    dets.forEach((det, i) => {
      const j = match[i] ?? -1
      const known = j >= 0 ? this.hands[j] : undefined
      const hand = known ?? this.newHand(det, t)
      if (!known) this.hands.push(hand)
      this.step(hand, det, t, sensitivity, events)
      updated.add(hand)
    })
    for (const h of [...this.hands]) {
      if (updated.has(h) || t - h.seen <= LOST_AFTER) continue
      this.hands = this.hands.filter((x) => x !== h)
      events.lost(h)
    }
  }

  /** A hand that's open (not pinching, not just released) plucks with its fingertips. */
  canPluck(h: TrackedHand, t: number, sensitivity: number): boolean {
    return !h.pinch.pinching && t - h.lastRelease > PLUCK_AFTER_RELEASE && h.ratio > OPEN_HAND * sensitivity
  }

  private newHand(det: readonly Vec[], t: number): TrackedHand {
    return {
      id: this.nextId++,
      landmarks: det.map((p) => ({ ...p })),
      wrist: det[0] ?? { x: 0, y: 0 },
      seen: t,
      pinch: OPEN,
      ratio: 1,
      cursor: pinchPoint(det),
      lastRelease: -Infinity,
    }
  }

  private step(h: TrackedHand, det: readonly Vec[], t: number, sensitivity: number, events: HandEvents): void {
    h.wrist = det[0] ?? h.wrist
    h.seen = t
    // Adaptive smoothing: small moves (jitter) are damped, big moves follow at once.
    h.landmarks = det.map((p, k) => {
      const prev = h.landmarks[k] ?? p
      const a = clamp(dist(p, prev) / 14, 0.4, 1)
      return { x: prev.x + a * (p.x - prev.x), y: prev.y + a * (p.y - prev.y) }
    })
    h.ratio = pinchRatio(h.landmarks)
    h.cursor = pinchPoint(h.landmarks)
    const { state, event } = updatePinch(h.pinch, h.ratio, sensitivity)
    h.pinch = state
    if (event === 'down') events.pinchDown(h)
    else if (event === 'up') {
      h.lastRelease = t
      events.pinchUp(h)
    } else if (state.pinching) events.pinchMove(h)
  }
}
