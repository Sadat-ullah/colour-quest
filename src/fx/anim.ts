/* ─────────────────────────────────────────────────────────────
 *  anim.ts – GSAP Animation Helpers for Colour Quest
 *  High-performance, tweenable animation primitives for 2D Canvas & DOM.
 * ───────────────────────────────────────────────────────────── */
import { gsap } from 'gsap';

export interface PulseOptions {
  scale?: number;
  duration?: number;
  repeat?: number;
  yoyo?: boolean;
}

export interface FlashColorOptions {
  yoyo?: boolean;
  ease?: string;
}

export interface SquashStretchOptions {
  intensity?: number;
  duration?: number;
}

/**
 * Checks if target is an HTMLElement (or SVGElement).
 */
function isDOMElement(target: unknown): target is HTMLElement | SVGElement {
  return typeof HTMLElement !== 'undefined' && target instanceof HTMLElement;
}

/**
 * Pop-in animation with back overshoot.
 * Uses `back.out(1.7)` for cheerful, bouncy entry.
 * Supports both DOM elements and plain JavaScript canvas objects (animating scale, scaleX/Y, opacity/alpha).
 *
 * @param target DOM element or canvas render object
 * @param duration Duration in seconds (default: 0.45)
 * @param onUpdate Optional callback on each frame
 * @param onComplete Optional callback when animation finishes
 * @returns GSAP Tween instance
 */
export function popIn(
  target: any,
  duration = 0.45,
  onUpdate?: () => void,
  onComplete?: () => void
): gsap.core.Tween {
  if (!target) {
    throw new Error('[anim.popIn] Target cannot be null or undefined');
  }

  if (isDOMElement(target)) {
    return gsap.fromTo(
      target,
      { scale: 0, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration,
        ease: 'back.out(1.7)',
        onUpdate,
        onComplete,
      }
    );
  }

  // Plain JS Object (e.g. Canvas renderable)
  const fromVars: Record<string, number> = {};
  const toVars: Record<string, any> = {
    duration,
    ease: 'back.out(1.7)',
    onUpdate,
    onComplete,
  };

  if ('scaleX' in target && 'scaleY' in target) {
    fromVars.scaleX = 0;
    fromVars.scaleY = 0;
    toVars.scaleX = typeof target.scaleX === 'number' && target.scaleX !== 0 ? target.scaleX : 1;
    toVars.scaleY = typeof target.scaleY === 'number' && target.scaleY !== 0 ? target.scaleY : 1;
  } else {
    fromVars.scale = 0;
    toVars.scale = typeof target.scale === 'number' && target.scale !== 0 ? target.scale : 1;
  }

  if ('alpha' in target) {
    fromVars.alpha = 0;
    toVars.alpha = typeof target.alpha === 'number' && target.alpha !== 0 ? target.alpha : 1;
  } else if ('opacity' in target) {
    fromVars.opacity = 0;
    toVars.opacity = typeof target.opacity === 'number' && target.opacity !== 0 ? target.opacity : 1;
  }

  return gsap.fromTo(target, fromVars, toVars);
}

/**
 * Bouncy landing animation with elastic settle.
 * Simulates an object dropping down into place with an elastic bounce.
 *
 * @param target DOM element or canvas render object
 * @param onUpdate Optional frame callback
 * @param onComplete Optional completion callback
 * @param duration Duration in seconds (default: 0.7)
 * @returns GSAP Tween instance
 */
export function bounceLand(
  target: any,
  onUpdate?: () => void,
  onComplete?: () => void,
  duration = 0.7
): gsap.core.Tween {
  if (!target) {
    throw new Error('[anim.bounceLand] Target cannot be null or undefined');
  }

  if (isDOMElement(target)) {
    return gsap.fromTo(
      target,
      { y: -60, scaleX: 0.88, scaleY: 1.15, opacity: 0 },
      {
        y: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        duration,
        ease: 'elastic.out(1, 0.4)',
        onUpdate,
        onComplete,
      }
    );
  }

  // Plain JS Object
  const fromVars: Record<string, number> = {};
  const toVars: Record<string, any> = {
    duration,
    ease: 'elastic.out(1, 0.4)',
    onUpdate,
    onComplete,
  };

  if ('y' in target && typeof target.y === 'number') {
    const targetY = target.y;
    fromVars.y = targetY - (target.bounceHeight ?? 60);
    toVars.y = targetY;
  }

  if ('scale' in target && typeof target.scale === 'number') {
    const baseScale = target.scale !== 0 ? target.scale : 1;
    fromVars.scale = baseScale * 0.2;
    toVars.scale = baseScale;
  } else if ('scaleX' in target && 'scaleY' in target) {
    const baseScaleX = target.scaleX !== 0 ? target.scaleX : 1;
    const baseScaleY = target.scaleY !== 0 ? target.scaleY : 1;
    fromVars.scaleX = baseScaleX * 0.85;
    fromVars.scaleY = baseScaleY * 1.2;
    toVars.scaleX = baseScaleX;
    toVars.scaleY = baseScaleY;
  }

  if ('alpha' in target) {
    fromVars.alpha = 0;
    toVars.alpha = typeof target.alpha === 'number' && target.alpha !== 0 ? target.alpha : 1;
  }

  return gsap.fromTo(target, fromVars, toVars);
}

/**
 * Subtle breathing/highlight pulse for selected regions or active tools.
 * Runs in an infinite yoyo loop until killed.
 *
 * @param target Target element or object
 * @param onUpdate Optional frame callback
 * @param options Pulse scale & duration configuration
 * @returns GSAP Tween (call `.kill()` to stop pulsing)
 */
export function pulse(
  target: any,
  onUpdate?: () => void,
  options?: PulseOptions
): gsap.core.Tween {
  if (!target) {
    throw new Error('[anim.pulse] Target cannot be null or undefined');
  }

  const scaleMultiplier = options?.scale ?? 1.08;
  const duration = options?.duration ?? 0.75;
  const repeat = options?.repeat ?? -1;
  const yoyo = options?.yoyo ?? true;

  if (isDOMElement(target)) {
    return gsap.to(target, {
      scale: scaleMultiplier,
      duration,
      repeat,
      yoyo,
      ease: 'sine.inOut',
      onUpdate,
    });
  }

  // Plain JS Canvas Object
  const toVars: Record<string, any> = {
    duration,
    repeat,
    yoyo,
    ease: 'sine.inOut',
    onUpdate,
  };

  if ('scaleX' in target && 'scaleY' in target) {
    const baseX = typeof target.scaleX === 'number' && target.scaleX !== 0 ? target.scaleX : 1;
    const baseY = typeof target.scaleY === 'number' && target.scaleY !== 0 ? target.scaleY : 1;
    toVars.scaleX = baseX * scaleMultiplier;
    toVars.scaleY = baseY * scaleMultiplier;
  } else {
    const base = typeof target.scale === 'number' && target.scale !== 0 ? target.scale : 1;
    toVars.scale = base * scaleMultiplier;
  }

  return gsap.to(target, toVars);
}

/**
 * Squash-and-stretch dynamic impact animation.
 * Follows classical animation timing: impact squash -> rebound stretch -> elastic settle.
 *
 * @param target DOM element or canvas render object
 * @param onUpdate Optional frame callback
 * @param onComplete Optional completion callback
 * @returns GSAP Timeline instance
 */
export function squashStretch(
  target: any,
  onUpdate?: () => void,
  onComplete?: () => void,
  options?: SquashStretchOptions
): gsap.core.Timeline {
  if (!target) {
    throw new Error('[anim.squashStretch] Target cannot be null or undefined');
  }

  const intensity = options?.intensity ?? 1.0;
  const totalDuration = options?.duration ?? 0.42;
  const d1 = totalDuration * 0.24;
  const d2 = totalDuration * 0.36;
  const d3 = totalDuration * 0.40;

  const tl = gsap.timeline({ onUpdate, onComplete });

  if (isDOMElement(target)) {
    tl.to(target, {
      scaleX: 1 + 0.22 * intensity,
      scaleY: 1 - 0.20 * intensity,
      duration: d1,
      ease: 'power2.out',
    })
      .to(target, {
        scaleX: 1 - 0.12 * intensity,
        scaleY: 1 + 0.16 * intensity,
        duration: d2,
        ease: 'power1.out',
      })
      .to(target, {
        scaleX: 1,
        scaleY: 1,
        duration: d3,
        ease: 'elastic.out(1.2, 0.4)',
      });

    return tl;
  }

  // Plain JS Object
  const baseScaleX = typeof target.scaleX === 'number' ? target.scaleX : 1;
  const baseScaleY = typeof target.scaleY === 'number' ? target.scaleY : 1;

  tl.to(target, {
    scaleX: baseScaleX * (1 + 0.22 * intensity),
    scaleY: baseScaleY * (1 - 0.20 * intensity),
    duration: d1,
    ease: 'power2.out',
  })
    .to(target, {
      scaleX: baseScaleX * (1 - 0.12 * intensity),
      scaleY: baseScaleY * (1 + 0.16 * intensity),
      duration: d2,
      ease: 'power1.out',
    })
    .to(target, {
      scaleX: baseScaleX,
      scaleY: baseScaleY,
      duration: d3,
      ease: 'elastic.out(1.2, 0.4)',
    });

  return tl;
}

/**
 * Interpolates smoothly between two colors (hex, rgb, or rgba).
 * Invokes `onUpdate(currentColor)` on each frame with the formatted color string.
 *
 * @param fromColor Starting color string (e.g. '#FFFFFF')
 * @param toColor Target color string (e.g. '#FF5500')
 * @param duration Duration in seconds (default: 0.35)
 * @param onUpdate Frame callback receiving current interpolated color string
 * @param onComplete Optional completion callback
 * @param options Optional configuration (yoyo, ease)
 * @returns GSAP Tween instance
 */
export function flashColor(
  fromColor: string,
  toColor: string,
  duration = 0.35,
  onUpdate?: (color: string) => void,
  onComplete?: () => void,
  options?: FlashColorOptions
): gsap.core.Tween {
  const colorProxy = { color: fromColor };
  const yoyo = options?.yoyo ?? false;
  const ease = options?.ease ?? 'power2.out';

  return gsap.to(colorProxy, {
    color: toColor,
    duration: yoyo ? duration / 2 : duration,
    repeat: yoyo ? 1 : 0,
    yoyo,
    ease,
    onUpdate: () => {
      onUpdate?.(colorProxy.color);
    },
    onComplete,
  });
}

/**
 * Staggered 3-star celebration pop-in with rotation and scale bounce.
 * Used when displaying level completion stars on the result modal.
 *
 * @param starElements Array of 3 (or more) star elements or objects
 * @param onComplete Optional completion callback when all stars finish
 * @returns GSAP Timeline instance
 */
export function starCelebration(
  starElements: any[],
  onComplete?: () => void
): gsap.core.Timeline {
  const tl = gsap.timeline({ onComplete });

  starElements.forEach((star, index) => {
    if (!star) return;

    const staggerDelay = index * 0.22;

    if (isDOMElement(star)) {
      tl.fromTo(
        star,
        {
          scale: 0,
          rotation: -45,
          opacity: 0,
        },
        {
          scale: 1,
          rotation: 0,
          opacity: 1,
          duration: 0.55,
          ease: 'back.out(2.2)',
        },
        staggerDelay
      ).to(
        star,
        {
          scale: 1.14,
          duration: 0.1,
          yoyo: true,
          repeat: 1,
          ease: 'power1.inOut',
        },
        staggerDelay + 0.45
      );
    } else {
      // Plain JS Canvas Star Object
      const targetScale = typeof star.scale === 'number' && star.scale !== 0 ? star.scale : 1;
      tl.fromTo(
        star,
        {
          scale: 0,
          rotation: -0.8, // in radians
          alpha: 0,
        },
        {
          scale: targetScale,
          rotation: 0,
          alpha: 1,
          duration: 0.55,
          ease: 'back.out(2.2)',
        },
        staggerDelay
      ).to(
        star,
        {
          scale: targetScale * 1.14,
          duration: 0.1,
          yoyo: true,
          repeat: 1,
          ease: 'power1.inOut',
        },
        staggerDelay + 0.45
      );
    }
  });

  return tl;
}

/**
 * Shake animation for invalid taps / mismatch warnings.
 *
 * @param target Target element or object
 * @param duration Total duration in seconds (default: 0.3)
 * @param intensity Pixel displacement (default: 8)
 * @param onUpdate Optional frame callback
 * @param onComplete Optional completion callback
 * @returns GSAP Timeline instance
 */
export function shake(
  target: any,
  duration = 0.3,
  intensity = 8,
  onUpdate?: () => void,
  onComplete?: () => void
): gsap.core.Timeline {
  const tl = gsap.timeline({ onUpdate, onComplete });
  const step = duration / 5;

  if (isDOMElement(target)) {
    tl.to(target, { x: -intensity, duration: step, ease: 'power1.inOut' })
      .to(target, { x: intensity, duration: step, ease: 'power1.inOut' })
      .to(target, { x: -intensity * 0.6, duration: step, ease: 'power1.inOut' })
      .to(target, { x: intensity * 0.4, duration: step, ease: 'power1.inOut' })
      .to(target, { x: 0, duration: step, ease: 'power1.out' });
  } else {
    const baseX = typeof target.x === 'number' ? target.x : 0;
    tl.to(target, { x: baseX - intensity, duration: step, ease: 'power1.inOut' })
      .to(target, { x: baseX + intensity, duration: step, ease: 'power1.inOut' })
      .to(target, { x: baseX - intensity * 0.6, duration: step, ease: 'power1.inOut' })
      .to(target, { x: baseX + intensity * 0.4, duration: step, ease: 'power1.inOut' })
      .to(target, { x: baseX, duration: step, ease: 'power1.out' });
  }

  return tl;
}

/**
 * Cancels all active tweens running on a target.
 */
export function killAnimations(target: any): void {
  if (target) {
    gsap.killTweensOf(target);
  }
}
