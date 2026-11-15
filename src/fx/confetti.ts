/* ─────────────────────────────────────────────────────────────
 *  confetti.ts – Full-Screen Celebration Confetti System
 *  High-performance fluttering ribbons, paper flakes & celebration bursts.
 * ───────────────────────────────────────────────────────────── */
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../shared/constants';

export type ConfettiShape = 'ribbon' | 'square' | 'circle' | 'star';

export interface ConfettiColorPair {
  front: string;
  back: string;
}

export interface ConfettiParticle {
  active: boolean;
  shape: ConfettiShape;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  maxVy: number;
  width: number;
  height: number;
  color: string;
  backColor: string;
  alpha: number;
  life: number;
  maxLife: number;
  rotation: number;
  vRot: number;
  wobble: number;
  wobbleSpeed: number;
  swayPhase: number;
  swaySpeed: number;
  swayStrength: number;
}

export interface ConfettiBurstOptions {
  count?: number;
  spreadAngle?: number;  // In radians, default Math.PI / 3 (60 deg)
  launchAngle?: number;  // In radians, default -Math.PI / 2 (-90 deg, straight up)
  minSpeed?: number;
  maxSpeed?: number;
  gravity?: number;
  shapes?: ConfettiShape[];
  colors?: ConfettiColorPair[];
}

const DEFAULT_CONFETTI_CAPACITY = 600;

// Joyful, multi-colour palette tailored for celebration visual flair
export const CELEBRATION_PALETTE: ConfettiColorPair[] = [
  { front: '#FFD700', back: '#D4AF37' }, // Gold
  { front: '#FF3366', back: '#C71B49' }, // Coral red / pink
  { front: '#00F5D4', back: '#00BAA1' }, // Turquoise
  { front: '#7B2CBF', back: '#5A189A' }, // Royal purple
  { front: '#3A86FF', back: '#1E62D0' }, // Electric blue
  { front: '#FF70A6', back: '#D94880' }, // Bubblegum
  { front: '#52B788', back: '#388B63' }, // Fresh green
  { front: '#FF9F1C', back: '#D17506' }, // Bright orange
  { front: '#FEE440', back: '#CFB719' }, // Vivid yellow
  { front: '#9B5DE5', back: '#7537BF' }, // Lilac purple
  { front: '#48CAE4', back: '#2A9CB4' }, // Sky cyan
];

/**
 * Creates an empty confetti particle structure for the pre-allocated pool.
 */
function createEmptyConfetti(): ConfettiParticle {
  return {
    active: false,
    shape: 'ribbon',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    gravity: 240,
    drag: 0.982,
    maxVy: 220,
    width: 8,
    height: 18,
    color: '#FFD700',
    backColor: '#D4AF37',
    alpha: 1,
    life: 0,
    maxLife: 3.5,
    rotation: 0,
    vRot: 0,
    wobble: 0,
    wobbleSpeed: 8,
    swayPhase: 0,
    swaySpeed: 4,
    swayStrength: 80,
  };
}

/**
 * Draws a 4-point celebration sparkle star for star-shaped confetti.
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
 * High-performance full-screen celebration confetti system.
 * Zero runtime allocations with realistic 3D paper tumbling and air sway.
 */
export class ConfettiSystem {
  private pool: ConfettiParticle[];
  private _activeCount = 0;
  private readonly capacity: number;
  private screenWidth = DESIGN_WIDTH;
  private screenHeight = DESIGN_HEIGHT;

  constructor(capacity = DEFAULT_CONFETTI_CAPACITY) {
    this.capacity = capacity;
    this.pool = new Array<ConfettiParticle>(capacity);
    for (let i = 0; i < capacity; i++) {
      this.pool[i] = createEmptyConfetti();
    }
  }

  /**
   * Current number of active fluttering confetti pieces.
   */
  public get activeCount(): number {
    return this._activeCount;
  }

  /**
   * Whether confetti is currently active and animating.
   */
  public get isRunning(): boolean {
    return this._activeCount > 0;
  }

  /**
   * Sets the bounds used for screen-space falloffs.
   */
  public setBounds(width: number, height: number): void {
    this.screenWidth = width > 0 ? width : DESIGN_WIDTH;
    this.screenHeight = height > 0 ? height : DESIGN_HEIGHT;
  }

  /**
   * Resets all confetti to inactive state immediately.
   */
  public clear(): void {
    for (let i = 0; i < this._activeCount; i++) {
      this.pool[i].active = false;
    }
    this._activeCount = 0;
  }

  /**
   * Acquires a pooled particle using O(1) swap-with-last semantics.
   */
  private acquire(): ConfettiParticle {
    if (this._activeCount < this.capacity) {
      const p = this.pool[this._activeCount];
      p.active = true;
      this._activeCount++;
      return p;
    }

    // Pool saturated: recycle oldest particle with least remaining life
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
   * Emits a directional confetti burst from a specific coordinate.
   *
   * @param x Source X
   * @param y Source Y
   * @param options Configuration options for velocities, colors, and spread
   */
  public burst(x: number, y: number, options?: ConfettiBurstOptions): void {
    const count = options?.count ?? 45;
    const launchAngle = options?.launchAngle ?? -Math.PI / 2; // Straight up
    const spreadAngle = options?.spreadAngle ?? Math.PI / 3;  // 60 degrees spread
    const minSpeed = options?.minSpeed ?? 450;
    const maxSpeed = options?.maxSpeed ?? 850;
    const gravity = options?.gravity ?? 260;
    const palette = options?.colors && options.colors.length > 0 ? options.colors : CELEBRATION_PALETTE;

    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      p.x = x;
      p.y = y;

      // Color pair
      const colorPair = palette[Math.floor(Math.random() * palette.length)];
      p.color = colorPair.front;
      p.backColor = colorPair.back;

      // Shape distribution: 55% ribbons, 25% squares, 12% circles, 8% stars
      const shapeRoll = Math.random();
      if (shapeRoll < 0.55) {
        p.shape = 'ribbon';
        p.width = 6 + Math.random() * 5;
        p.height = 14 + Math.random() * 12;
      } else if (shapeRoll < 0.80) {
        p.shape = 'square';
        const s = 8 + Math.random() * 6;
        p.width = s;
        p.height = s;
      } else if (shapeRoll < 0.92) {
        p.shape = 'circle';
        const r = 8 + Math.random() * 6;
        p.width = r;
        p.height = r;
      } else {
        p.shape = 'star';
        const r = 9 + Math.random() * 6;
        p.width = r;
        p.height = r;
      }

      // Physics: Directional spray with randomized speed
      const angle = launchAngle + (Math.random() - 0.5) * spreadAngle;
      const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;

      p.gravity = gravity + (Math.random() - 0.5) * 60;
      p.drag = 0.981;
      p.maxVy = 160 + Math.random() * 90; // Terminal falling velocity

      p.maxLife = 2.8 + Math.random() * 1.8;
      p.life = p.maxLife;
      p.alpha = 1;

      // Tumbling & aerodynamic flutter
      p.rotation = Math.random() * Math.PI * 2;
      p.vRot = (Math.random() - 0.5) * 8;
      p.wobble = Math.random() * Math.PI * 2;
      p.wobbleSpeed = 6 + Math.random() * 10;
      p.swayPhase = Math.random() * Math.PI * 2;
      p.swaySpeed = 2 + Math.random() * 3.5;
      p.swayStrength = 70 + Math.random() * 60;
    }
  }

  /**
   * Full-screen celebration confetti burst when completing a level with 3 stars!
   * Fires synchronised left, right, and center cannons for maximum grandeur.
   *
   * @param width Viewport width (default: DESIGN_WIDTH)
   * @param height Viewport height (default: DESIGN_HEIGHT)
   * @param count Total number of particles across all cannons (default: 200)
   */
  public celebrate(
    width = this.screenWidth,
    height = this.screenHeight,
    count = 200
  ): void {
    this.setBounds(width, height);

    const cannonCount = Math.floor(count * 0.38);
    const centerCount = count - cannonCount * 2;

    // Left cannon: shoots up and right towards center
    this.burst(width * 0.12, height * 0.96, {
      count: cannonCount,
      launchAngle: -Math.PI * 0.32, // ~ -58 degrees
      spreadAngle: Math.PI * 0.34,
      minSpeed: 520,
      maxSpeed: 920,
    });

    // Right cannon: shoots up and left towards center
    this.burst(width * 0.88, height * 0.96, {
      count: cannonCount,
      launchAngle: -Math.PI * 0.68, // ~ -122 degrees
      spreadAngle: Math.PI * 0.34,
      minSpeed: 520,
      maxSpeed: 920,
    });

    // Center fountain shower: fires directly upward
    this.burst(width * 0.5, height * 0.85, {
      count: centerCount,
      launchAngle: -Math.PI / 2,
      spreadAngle: Math.PI * 0.5,
      minSpeed: 440,
      maxSpeed: 780,
    });
  }

  /**
   * Internal single physics tick for confetti.
   */
  private step(step: number): void {
    const maxY = this.screenHeight + 50;

    let i = 0;
    while (i < this._activeCount) {
      const p = this.pool[i];
      p.life -= step;

      // Despawn condition: life exhausted or fallen off bottom of screen
      if (p.life <= 0 || p.y > maxY) {
        p.active = false;
        this._activeCount--;
        if (i < this._activeCount) {
          const lastActive = this.pool[this._activeCount];
          this.pool[this._activeCount] = p;
          this.pool[i] = lastActive;
        }
        continue;
      }

      // Air resistance damping on horizontal velocity
      const dragFactor = Math.pow(p.drag, step * 60);
      p.vx *= dragFactor;

      // Gravity and terminal velocity
      p.vy += p.gravity * step;
      if (p.vy > p.maxVy) {
        p.vy = p.maxVy;
      }

      // Lateral atmospheric sway
      p.swayPhase += p.swaySpeed * step;
      const swayForce = Math.sin(p.swayPhase) * p.swayStrength * step;

      p.x += (p.vx + swayForce) * step;
      p.y += p.vy * step;

      // 3D rotation and tumbling
      p.rotation += p.vRot * step;
      p.wobble += p.wobbleSpeed * step;

      // Smooth fade-out near end of life or bottom edge
      if (p.life < 0.6) {
        p.alpha = Math.max(0, p.life / 0.6);
      } else if (p.y > this.screenHeight - 80) {
        p.alpha = Math.max(0, (maxY - p.y) / 130);
      } else {
        p.alpha = 1;
      }

      i++;
    }
  }

  /**
   * Updates all active confetti pieces by dt seconds.
   * Implements air resistance, lateral sway, 3D tumbling, and bounds clipping with zero allocations.
   *
   * @param dt Delta time in seconds
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
   * Draws all active confetti pieces onto the specified 2D rendering context.
   * Emulates 3D paper rotation by scaling along the local axis and alternating front/back lighting.
   *
   * @param ctx Target CanvasRenderingContext2D
   */
  public draw(ctx: CanvasRenderingContext2D): void {
    if (this._activeCount === 0) return;

    ctx.save();

    for (let i = 0; i < this._activeCount; i++) {
      const p = this.pool[i];
      if (p.alpha <= 0.01) continue;

      // 3D paper tumbling: scaleX oscillates between -1 and 1
      const scaleX = Math.cos(p.wobble);
      const isFront = scaleX >= 0;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(scaleX, 1);

      ctx.fillStyle = isFront ? p.color : p.backColor;

      if (p.shape === 'ribbon') {
        ctx.fillRect(-p.width * 0.5, -p.height * 0.5, p.width, p.height);
      } else if (p.shape === 'square') {
        ctx.fillRect(-p.width * 0.5, -p.width * 0.5, p.width, p.width);
      } else if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.width * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'star') {
        drawSparkleStar(ctx, p.width * 0.6);
      }

      ctx.restore();
    }

    ctx.restore();
  }
}

/**
 * Shared singleton instance for game-wide celebration confetti.
 */
export const confettiSystem = new ConfettiSystem();

/**
 * Triggers a full-screen celebration confetti burst when completing a level with 3 stars!
 *
 * @param width Viewport width (default: DESIGN_WIDTH)
 * @param height Viewport height (default: DESIGN_HEIGHT)
 */
export function celebrate3Stars(width?: number, height?: number): void {
  confettiSystem.celebrate(width, height);
}

/**
 * Triggers a directional or localized confetti burst.
 *
 * @param x Origin X
 * @param y Origin Y
 * @param count Number of confetti pieces
 */
export function burstConfetti(x: number, y: number, count?: number): void {
  confettiSystem.burst(x, y, { count });
}
