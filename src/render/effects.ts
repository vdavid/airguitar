import type { Vec } from '../geom.ts'

/** Short-lived visuals: spark particles, floating note names, and press ripples. */

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  age: number
  readonly color: string
}

export interface Pop {
  readonly x: number
  readonly y: number
  readonly text: string
  readonly color: string
  readonly t: number
}

export interface Ripple {
  readonly x: number
  readonly y: number
  readonly t: number
}

/** The air sweep in progress: where the pinch started, where it is, and the amounts (0..1). */
export interface SweepView {
  readonly from: Vec
  readonly to: Vec
  readonly dark: number
  readonly thin: number
  readonly echo: number
}

const MAX_PARTICLES = 600
const MAX_POPS = 32

export class Effects {
  readonly particles: Particle[] = []
  pops: Pop[] = []
  ripples: Ripple[] = []
  /** Set while a pinch sweeps the filter and echo in empty air (Play mode). */
  sweep: SweepView | null = null

  /** A spray of sparks from `p`. */
  burst(p: Vec, color: string, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const v = speed * (0.25 + Math.random() * 0.75)
      this.particles.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 30,
        life: 0.35 + Math.random() * 0.5,
        age: 0,
        color,
      })
    }
    if (this.particles.length > MAX_PARTICLES) this.particles.splice(0, this.particles.length - MAX_PARTICLES)
  }

  /** A note name that floats up from `p` and fades. */
  pop(p: Vec, text: string, color: string, t: number): void {
    this.pops.push({ x: p.x, y: p.y - 16, text, color, t })
    if (this.pops.length > MAX_POPS) this.pops.shift()
  }

  ripple(p: Vec, t: number): void {
    this.ripples.push({ x: p.x, y: p.y, t })
  }

  /** Advances particles (gravity, drag) and drops expired effects. */
  step(dt: number, t: number): void {
    const P = this.particles
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]
      if (!p) continue
      p.age += dt
      if (p.age >= p.life) {
        P.splice(i, 1)
        continue
      }
      p.vy += 260 * dt
      p.vx *= 0.985
      p.x += p.vx * dt
      p.y += p.vy * dt
    }
    this.pops = this.pops.filter((p) => t - p.t < 0.9)
    this.ripples = this.ripples.filter((r) => t - r.t < 0.45)
  }
}
