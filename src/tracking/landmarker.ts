import type { HandLandmarker } from '@mediapipe/tasks-vision'
import type { Vec } from '../geom.ts'

/**
 * The camera and MediaPipe's hand landmarker, up to eight hands. The MediaPipe bundle loads lazily
 * (mouse mode never pays for it); its WebAssembly runtime is served from our own origin
 * (`/mediapipe/`, see `vite.config.ts`) and the model from Google's model storage.
 */

export const MAX_HANDS = 8
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export class Tracker {
  readonly video: HTMLVideoElement
  private landmarker: HandLandmarker | null = null
  private lastVideoTime = -1
  /** Smoothed cost of one detection (ms), for skipping frames when the machine can't keep up. */
  private costMs = 0
  private skip = false
  private frames = 0
  private fpsT = 0
  /** Detections per second, for the debug overlay. */
  fps = 0
  delegate: 'GPU' | 'CPU' | '' = ''

  constructor(video: HTMLVideoElement) {
    this.video = video
  }

  get ready(): boolean {
    return this.landmarker !== null
  }

  async start(onStatus: (message: string) => void): Promise<void> {
    if (!('mediaDevices' in navigator)) throw new Error('This browser can’t open a camera from here.')
    onStatus('Waiting for camera permission…')
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    })
    this.video.srcObject = stream
    await this.video.play()
    onStatus('Loading the hand tracker…')
    const vision = await import('@mediapipe/tasks-vision')
    const files = await vision.FilesetResolver.forVisionTasks(new URL('/mediapipe', location.href).href)
    const make = (delegate: 'GPU' | 'CPU'): Promise<HandLandmarker> =>
      vision.HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO',
        numHands: MAX_HANDS,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
    try {
      this.landmarker = await make('GPU')
      this.delegate = 'GPU'
    } catch {
      this.landmarker = await make('CPU')
      this.delegate = 'CPU'
    }
  }

  /**
   * Runs the landmarker on the newest video frame, if there is one, and returns each hand's 21
   * landmarks in stage units (mirrored, matching the "cover"-fitted selfie view). Returns null when
   * there's no new frame, or when it skips one to keep the frame rate up: with many hands, a slow
   * machine detects on every other frame and the drawing stays smooth.
   */
  detect(now: number, stage: { width: number; height: number }): Vec[][] | null {
    const v = this.video
    if (!this.landmarker || v.readyState < 2 || v.currentTime === this.lastVideoTime) return null
    if (this.costMs > 24) {
      this.skip = !this.skip
      if (this.skip) return null
    }
    this.lastVideoTime = v.currentTime
    const t0 = performance.now()
    const result = this.landmarker.detectForVideo(v, t0)
    this.costMs = this.costMs * 0.9 + (performance.now() - t0) * 0.1
    this.frames++
    if (now - this.fpsT > 1) {
      this.fps = Math.round(this.frames / (now - this.fpsT))
      this.frames = 0
      this.fpsT = now
    }
    const { width: W, height: H } = stage
    const vw = v.videoWidth || W
    const vh = v.videoHeight || H
    const sc = Math.max(W / vw, H / vh)
    const ox = (W - vw * sc) / 2
    const oy = (H - vh * sc) / 2
    return result.landmarks.map((hand) => hand.map((p) => ({ x: W - (p.x * vw * sc + ox), y: p.y * vh * sc + oy })))
  }
}
