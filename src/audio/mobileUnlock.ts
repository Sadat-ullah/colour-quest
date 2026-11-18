/* ─────────────────────────────────────────────────────────────
 *  mobileUnlock.ts – Mobile browser Web Audio unlocking
 *  Zero sound delay on iOS Safari, iPadOS & Android Chrome.
 * ───────────────────────────────────────────────────────────── */

import { eventBus } from '../shared/eventBus';

let sharedAudioContext: AudioContext | null = null;
let unlocked = false;
let unlockPromise: Promise<boolean> | null = null;
let listenersAttached = false;
let visibilityListenersAttached = false;

// Interaction events to capture user gesture
const UNLOCK_EVENTS = ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'keydown', 'click'] as const;

/**
 * Get or create the shared Web Audio AudioContext singleton.
 * Configured with latencyHint: 'interactive' for instant audio response.
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!sharedAudioContext) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      console.warn('[MobileUnlock] Web Audio API is not supported in this environment.');
      return null;
    }

    try {
      sharedAudioContext = new AudioContextClass({ latencyHint: 'interactive' });
    } catch {
      sharedAudioContext = new AudioContextClass();
    }
  }

  return sharedAudioContext;
}

/**
 * Check whether audio has been unlocked by user gesture.
 */
export function isAudioUnlocked(): boolean {
  return unlocked;
}

/**
 * Performs immediate unlock on Web Audio AudioContext:
 * 1. Resumes context if suspended.
 * 2. Starts a gentle 2-second silent keep-alive buffer (using native sampleRate)
 *    to prevent mobile Safari from throttling or putting CoreAudio to sleep,
 *    without CPU starvation or buffer backlog.
 * 3. Emits 'audio:unlock' on eventBus.
 */
export async function unlockAudio(): Promise<boolean> {
  if (unlocked) {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {}
    }
    return true;
  }

  if (unlockPromise) return unlockPromise;

  unlockPromise = (async () => {
    const ctx = getAudioContext();

    if (ctx) {
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch (e) {
          console.warn('[MobileUnlock] Failed to resume AudioContext:', e);
        }
      }

      // Safe keep-alive buffer: 2 seconds of pure silence at native hardware sampleRate.
      // This prevents Safari from putting CoreAudio to sleep without choking the audio thread.
      try {
        const keepAliveBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const keepAliveSource = ctx.createBufferSource();
        keepAliveSource.buffer = keepAliveBuffer;
        keepAliveSource.loop = true;
        const keepAliveGain = ctx.createGain();
        keepAliveGain.gain.setValueAtTime(0.00001, ctx.currentTime);
        keepAliveSource.connect(keepAliveGain);
        keepAliveGain.connect(ctx.destination);
        keepAliveSource.start(0);
      } catch {
        // Ignore in mock/test environment
      }
    }

    unlocked = true;

    // Emit event on eventBus
    eventBus.emit('audio:unlock', {});

    return true;
  })();

  return unlockPromise;
}

function handleInteraction(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (!unlocked) {
    void unlockAudio();
  }
}

/**
 * Attach listeners to window and document to capture user touch or click.
 */
export function initMobileUnlock(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (!listenersAttached) {
    listenersAttached = true;
    const opts: AddEventListenerOptions = { capture: true, passive: true };

    for (const evt of UNLOCK_EVENTS) {
      window.addEventListener(evt, handleInteraction, opts);
      document.addEventListener(evt, handleInteraction, opts);
    }
  }

  if (!visibilityListenersAttached) {
    visibilityListenersAttached = true;
    setupVisibilityHandling();
  }
}

/**
 * Handle document visibility and page lifecycle to suspend audio when backgrounded
 * and resume on focus.
 */
function setupVisibilityHandling(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const onVisibilityChange = () => {
    const ctx = getAudioContext();
    if (document.visibilityState === 'hidden') {
      if (ctx && ctx.state === 'running') {
        ctx.suspend().catch(() => {});
      }
    } else if (document.visibilityState === 'visible') {
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'running') {
      ctx.suspend().catch(() => {});
    }
  });
  window.addEventListener('pageshow', () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  });
}

/**
 * Internal helper for testing state resets
 */
export function _resetUnlockForTesting(): void {
  unlocked = false;
  unlockPromise = null;
  listenersAttached = false;
  visibilityListenersAttached = false;
}

// Auto-initialize mobile unlock listeners immediately
if (typeof window !== 'undefined') {
  initMobileUnlock();
}
