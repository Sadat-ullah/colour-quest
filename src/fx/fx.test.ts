import { describe, it, expect, vi } from 'vitest';
import {
  popIn,
  bounceLand,
  pulse,
  squashStretch,
  flashColor,
  starCelebration,
  shake,
  killAnimations,
} from './anim';
import {
  ParticleEmitter,
  particleEmitter,
  spawnSparkles,
  spawnRipple,
} from './particles';
import {
  ConfettiSystem,
  confettiSystem,
  celebrate3Stars,
  burstConfetti,
} from './confetti';

describe('Animation Engine (anim.ts)', () => {
  it('popIn animates scale on a plain canvas object', () => {
    const target = { scale: 0, alpha: 0 };
    const tween = popIn(target, 0.4);
    expect(tween).toBeDefined();
    expect(typeof tween.kill).toBe('function');
    tween.progress(1);
    expect(target.scale).toBeCloseTo(1, 1);
    expect(target.alpha).toBeCloseTo(1, 1);
    tween.kill();
  });

  it('bounceLand animates y and scale on plain object', () => {
    const target = { y: 100, scale: 1 };
    const tween = bounceLand(target);
    expect(tween).toBeDefined();
    tween.progress(1);
    expect(target.y).toBeCloseTo(100, 1);
    expect(target.scale).toBeCloseTo(1, 1);
    tween.kill();
  });

  it('pulse creates an infinite repeating breathing tween', () => {
    const target = { scale: 1 };
    const tween = pulse(target, undefined, { scale: 1.1 });
    expect(tween).toBeDefined();
    expect(tween.repeat()).toBe(-1);
    expect(tween.yoyo()).toBe(true);
    tween.kill();
  });

  it('squashStretch produces squash, stretch and settle', () => {
    const target = { scaleX: 1, scaleY: 1 };
    const onComplete = vi.fn();
    const tl = squashStretch(target, undefined, onComplete);
    expect(tl).toBeDefined();
    tl.progress(1);
    expect(target.scaleX).toBeCloseTo(1, 1);
    expect(target.scaleY).toBeCloseTo(1, 1);
    expect(onComplete).toHaveBeenCalled();
    tl.kill();
  });

  it('flashColor interpolates color and invokes onUpdate callback', () => {
    const onUpdate = vi.fn();
    const onComplete = vi.fn();
    const tween = flashColor('#ffffff', '#ff0000', 0.2, onUpdate, onComplete);
    expect(tween).toBeDefined();
    tween.progress(0.5);
    expect(onUpdate).toHaveBeenCalled();
    tween.progress(1);
    expect(onComplete).toHaveBeenCalled();
    tween.kill();
  });

  it('starCelebration creates staggered 3-star pop-in timeline', () => {
    const stars = [
      { scale: 1, rotation: 0, alpha: 0 },
      { scale: 1, rotation: 0, alpha: 0 },
      { scale: 1, rotation: 0, alpha: 0 },
    ];
    const onComplete = vi.fn();
    const tl = starCelebration(stars, onComplete);
    expect(tl).toBeDefined();
    tl.progress(1);
    expect(stars[0].alpha).toBeCloseTo(1, 1);
    expect(stars[1].alpha).toBeCloseTo(1, 1);
    expect(stars[2].alpha).toBeCloseTo(1, 1);
    expect(onComplete).toHaveBeenCalled();
    tl.kill();
  });

  it('shake animates position and restores base', () => {
    const target = { x: 50 };
    const tl = shake(target, 0.2, 10);
    expect(tl).toBeDefined();
    tl.progress(1);
    expect(target.x).toBeCloseTo(50, 1);
    tl.kill();
  });

  it('killAnimations cancels tweens on target', () => {
    const target = { scale: 1 };
    pulse(target);
    killAnimations(target);
  });
});

describe('Particle System (particles.ts)', () => {
  it('initializes pool with zero active particles', () => {
    const emitter = new ParticleEmitter(100);
    expect(emitter.activeCount).toBe(0);
  });

  it('spawns sparkles and increments active count', () => {
    const emitter = new ParticleEmitter(100);
    emitter.spawnSparkles(100, 200, '#3366ff', 20);
    expect(emitter.activeCount).toBe(20);
  });

  it('spawns expanding ripple', () => {
    const emitter = new ParticleEmitter(50);
    emitter.spawnRipple(150, 250, '#ffaa00', 80);
    expect(emitter.activeCount).toBe(1);
  });

  it('updates particles over time and despawns expired ones without allocating', () => {
    const emitter = new ParticleEmitter(50);
    emitter.spawnSparkles(50, 50, '#00ffcc', 10);
    expect(emitter.activeCount).toBe(10);

    // Simulate 0.016s frame
    emitter.update(0.016);
    expect(emitter.activeCount).toBe(10);

    // Advance beyond lifetime (~1.0s)
    emitter.update(1.5);
    expect(emitter.activeCount).toBe(0);
  });

  it('renders to mock canvas context without error', () => {
    const emitter = new ParticleEmitter(50);
    emitter.spawnSparkles(50, 50, '#ff0055', 5);
    emitter.spawnRipple(50, 50, '#ff0055');

    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;

    expect(() => emitter.draw(mockCtx)).not.toThrow();
    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it('global spawn helpers work as expected', () => {
    particleEmitter.clear();
    spawnSparkles(10, 10, '#ffffff', 5);
    expect(particleEmitter.activeCount).toBe(5);
    spawnRipple(10, 10, '#ffffff');
    expect(particleEmitter.activeCount).toBe(6);
    particleEmitter.clear();
    expect(particleEmitter.activeCount).toBe(0);
  });
});

describe('Confetti System (confetti.ts)', () => {
  it('initializes pool with zero active particles', () => {
    const system = new ConfettiSystem(100);
    expect(system.activeCount).toBe(0);
    expect(system.isRunning).toBe(false);
  });

  it('burst spawns fluttering confetti particles', () => {
    const system = new ConfettiSystem(100);
    system.burst(200, 300, { count: 30 });
    expect(system.activeCount).toBe(30);
    expect(system.isRunning).toBe(true);
  });

  it('celebrate triggers 3-cannon full screen burst', () => {
    const system = new ConfettiSystem(300);
    system.celebrate(1280, 720, 150);
    expect(system.activeCount).toBe(150);
    expect(system.isRunning).toBe(true);
  });

  it('updates confetti with sway and tumbling, despawning when offscreen or dead', () => {
    const system = new ConfettiSystem(50);
    system.burst(100, 100, { count: 10 });
    expect(system.activeCount).toBe(10);

    // Frame update
    system.update(0.016);
    expect(system.activeCount).toBe(10);

    // Large delta time to exceed lifespan
    system.update(6.0);
    expect(system.activeCount).toBe(0);
    expect(system.isRunning).toBe(false);
  });

  it('renders to mock canvas context without error', () => {
    const system = new ConfettiSystem(50);
    system.burst(200, 200, { count: 10 });

    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;

    expect(() => system.draw(mockCtx)).not.toThrow();
    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it('global celebrate3Stars helper functions properly', () => {
    confettiSystem.clear();
    celebrate3Stars(1280, 720);
    expect(confettiSystem.isRunning).toBe(true);
    expect(confettiSystem.activeCount).toBeGreaterThan(0);
    confettiSystem.clear();
    expect(confettiSystem.activeCount).toBe(0);
  });
});
