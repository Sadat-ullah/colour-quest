/* ─────────────────────────────────────────────────────────────
 *  particles.ts – High Performance Pooled Particle Engine
 *  Zero per-frame allocations for 60fps canvas visual effects.
 * ───────────────────────────────────────────────────────────── */

export type ParticleKind = 'circle' | 'star' | 'spark' | 'ripple';

export interface Particle {
  active: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  size: number;
  initialSize: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  rotation: number;
  vRot: number;
  // Ripple specific
  currentRadius: number;
  maxRadius: number;
  lineWidth: number;
}

const DEFAULT_POOL_SIZE = 600;
const SPARKLE_HIGHLIGHT_COLORS = ['#FFFFFF', '#FFD700', '#FFF3B0', '#FFFDF0'];

/**
 * Creates an empty particle struct for pre-allocation.
 */
function createEmptyParticle(): Particle {
  return {
    active: false,
    kind: 'circle',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    gravity: 0,
    drag: 0.96,
    size: 4,
    initialSize: 4,
    color: '#FFFFFF',
    alpha: 1,
    life: 0,
    maxLife: 1,
    rotation: 0,
    vRot: 0,
    currentRadius: 0,
    maxRadius: 60,
    lineWidth: 3,
  };
}

/**
 * Draws a 4-point magical curved sparkle star.
 */
function drawSparkleStar(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.quadraticCurveTo(0, 0, 0, r);
  ctx.quadraticCurveTo(0, 0, -r, 0);
  ctx.quadraticCurveTo(0, 0, 0, -r);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draws a 4-point diamond glint spark.
 */
function drawDiamondSpark(ctx: CanvasRenderingContext2D, size: number): void {
  const halfW = size * 0.4;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(halfW, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-halfW, 0);
  ctx.closePath();
  ctx.fill();
}

/**
 * ParticleEmitter manages, simulates, and renders pooled particles.
 * Designed for zero runtime allocations and maximum 60fps throughput.
 */
export class ParticleEmitter {
  private pool: Particle[];
  private _activeCount = 0;
  private readonly capacity: number;

  constructor(capacity = DEFAULT_POOL_SIZE) {
    this.capacity = capacity;
    this.pool = new Array<Particle>(capacity);
    for (let i = 0; i < capacity; i++) {
      this.pool[i] = createEmptyParticle();
    }
  }

  /**
   * Current number of active simulated particles.
   */
  public get activeCount(): number {
    return this._activeCount;
  }

  /**
   * Resets all particles to inactive state immediately.
   */
  public clear(): void {
    for (let i = 0; i < this._activeCount; i++) {
      this.pool[i].active = false;
    }
    this._activeCount = 0;
  }

  /**
   * Acquires a particle from the pool using swap-with-last semantics.
   * If pool is full, recycles the particle with lowest remaining life.
   */
  private acquire(): Particle {
    if (this._activeCount < this.capacity) {
      const p = this.pool[this._activeCount];
      p.active = true;
      this._activeCount++;
      return p;
    }

    // Pool saturated: locate particle with least remaining life
    let minLifeIndex = 0;
    let minLife = this.pool[0].life;
    for (let i = 1; i < this._activeCount; i++) {
      if (this.pool[i].life < minLife) {
        minLife = this.pool[i].life;
        minLifeIndex = i;
      }
    }
    return this.pool[minLifeIndex];
  }

  /**
   * Spawns a burst of colourful sparkle particles shooting outward with gravity and fade.
   *
   * @param x Burst center X
   * @param y Burst center Y
   * @param color Primary color hex
   * @param count Number of particles (default: 22)
   */
  public spawnSparkles(x: number, y: number, color: string, count = 22): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      p.x = x;
      p.y = y;

      // Particle kind distribution: 50% stars, 35% glowing circles, 15% sparks
      const kindRoll = Math.random();
      if (kindRoll < 0.50) {
        p.kind = 'star';
        p.initialSize = 6 + Math.random() * 6;
      } else if (kindRoll < 0.85) {
        p.kind = 'circle';
        p.initialSize = 3 + Math.random() * 4;
      } else {
        p.kind = 'spark';
        p.initialSize = 4 + Math.random() * 5;
      }
      p.size = p.initialSize;

      // Colour variation: mix base colour with sparkling white and golds
      const colorRoll = Math.random();
      if (colorRoll < 0.55) {
        p.color = color;
      } else if (colorRoll < 0.80) {
        p.color = SPARKLE_HIGHLIGHT_COLORS[0]; // Pure white
      } else if (colorRoll < 0.92) {
        p.color = SPARKLE_HIGHLIGHT_COLORS[1]; // Gold
      } else {
        p.color = SPARKLE_HIGHLIGHT_COLORS[2]; // Soft yellow
      }

      // Outward velocity with slight upward pop
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 240;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - (30 + Math.random() * 70); // upward bias

      p.gravity = 220 + Math.random() * 120;
      p.drag = 0.955;
      p.maxLife = 0.45 + Math.random() * 0.45;
      p.life = p.maxLife;
      p.alpha = 1;

      p.rotation = Math.random() * Math.PI * 2;
      p.vRot = (Math.random() - 0.5) * 14;
    }
  }

  /**
   * Spawns an expanding animated ring/ripple effect at the given point.
   *
   * @param x Center X
   * @param y Center Y
   * @param color Ring stroke color
   * @param maxRadius Maximum expansion radius (default: 65)
   */
  public spawnRipple(x: number, y: number, color: string, maxRadius = 65): void {
    const p = this.acquire();
    p.kind = 'ripple';
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.gravity = 0;
    p.drag = 1.0;
    p.color = color;
    p.size = 6; // start radius
    p.currentRadius = 6;
    p.maxRadius = maxRadius;
    p.lineWidth = 4;
    p.maxLife = 0.42;
    p.life = p.maxLife;
    p.alpha = 0.95;
    p.rotation = 0;
    p.vRot = 0;
  }

  /**
   * Internal single physics tick.
   */
  private step(step: number): void {
    let i = 0;
    while (i < this._activeCount) {
      const p = this.pool[i];
      p.life -= step;

      if (p.life <= 0) {
        // Despawn particle: swap with last active particle
        p.active = false;
        this._activeCount--;
        if (i < this._activeCount) {
          const lastActive = this.pool[this._activeCount];
          this.pool[this._activeCount] = p;
          this.pool[i] = lastActive;
        }
        // Retest index i since a new particle was swapped in
        continue;
      }

      const progress = 1 - p.life / p.maxLife;

      if (p.kind === 'ripple') {
        // Expanding ring
        p.currentRadius = p.size + (p.maxRadius - p.size) * progress;
        p.alpha = Math.max(0, 1 - progress);
      } else {
        // Flying sparkles
        const dragFactor = Math.pow(p.drag, step * 60);
        p.vx *= dragFactor;
        p.vy += p.gravity * step;
        p.vy *= dragFactor;

        p.x += p.vx * step;
        p.y += p.vy * step;
        p.rotation += p.vRot * step;

        p.alpha = Math.max(0, p.life / p.maxLife);
        p.size = p.initialSize * (0.2 + 0.8 * (p.life / p.maxLife));
      }

      i++;
    }
  }

  /**
   * Updates all active particles by dt seconds.
   * Handles variable frame rates gracefully via micro-stepping with zero allocations.
   *
   * @param dt Delta time in seconds (e.g. 0.016 for 60fps)
   */
  public update(dt: number): void {
    if (this._activeCount === 0 || dt <= 0) return;

    // Cap excessive delta time to 10 seconds to avoid runaway loops
    let remaining = Math.min(dt, 10.0);
    const maxStep = 0.05;

    while (remaining > 0 && this._activeCount > 0) {
      const step = remaining > maxStep ? maxStep : remaining;
      this.step(step);
      remaining -= step;
    }
  }

  /**
   * Draws all active particles onto the specified 2D rendering context.
   *
   * @param ctx Target CanvasRenderingContext2D
   */
  public draw(ctx: CanvasRenderingContext2D): void {
    if (this._activeCount === 0) return;

    ctx.save();

    for (let i = 0; i < this._activeCount; i++) {
      const p = this.pool[i];
      if (p.alpha <= 0.01) continue;

      ctx.globalAlpha = p.alpha;

      if (p.kind === 'ripple') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.lineWidth * (p.life / p.maxLife));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.currentRadius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'circle') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'star') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        drawSparkleStar(ctx, p.size);
        ctx.restore();
      } else if (p.kind === 'spark') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        drawDiamondSpark(ctx, p.size);
        ctx.restore();
      }
    }

    ctx.restore();
  }
}

/**
 * Shared singleton instance for game-wide particle effects.
 */
export const particleEmitter = new ParticleEmitter();

/**
 * Spawns sparkles using the default particle emitter.
 */
export function spawnSparkles(x: number, y: number, color: string, count?: number): void {
  particleEmitter.spawnSparkles(x, y, color, count);
}

/**
 * Spawns an expanding ripple using the default particle emitter.
 */
export function spawnRipple(x: number, y: number, color: string): void {
  particleEmitter.spawnRipple(x, y, color);
}
