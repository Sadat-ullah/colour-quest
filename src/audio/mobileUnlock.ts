/* ─────────────────────────────────────────────────────────────
 *  mobileUnlock.ts – Mobile browser Web Audio & Howler unlocking
 *  Zero sound delay on iOS Safari & Android Chrome.
 * ───────────────────────────────────────────────────────────── */

import { eventBus } from '../shared/eventBus';
import { Howler } from 'howler';

let sharedAudioContext: AudioContext | null = null;
let unlocked = false;
let unlockPromise: Promise<boolean> | null = null;
let listenersAttached = false;
let visibilityListenersAttached = false;

// Interaction events to capture user gesture
const UNLOCK_EVENTS = ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'keydown', 'click'] as const;

/**
 * Get or create the shared Web Audio AudioContext singleton.
 * Configured with latencyHint: 'interactive' for zero audio latency.
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
      // Fallback without options if browser rejects latencyHint
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
 * Performs immediate unlock on Web Audio AudioContext and Howler:
 * 1. Resumes context if suspended.
 * 2. Plays a tiny 1-sample silent buffer to prime iOS Safari hardware output.
 * 3. Resumes Howler.ctx if initialized.
 * 4. Emits 'audio:unlock' on eventBus.
 */
export async function unlockAudio(): Promise<boolean> {
  if (unlocked) return true;

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

      // Play 1-sample silent sound to prime the audio hardware pipeline (crucial for iOS Safari)
      try {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      } catch {
        // Ignore if buffer source fails
      }
    }

    // Unlock Howler context if present
    try {
      if (typeof Howler !== 'undefined' && Howler.ctx) {
        if (Howler.ctx.state === 'suspended') {
          await Howler.ctx.resume();
        }
      }
    } catch (e) {
      console.warn('[MobileUnlock] Failed to resume Howler.ctx:', e);
    }

    unlocked = true;
    removeInteractionListeners();

    // Emit event on eventBus
    eventBus.emit('audio:unlock', {});

    return true;
  })();

  return unlockPromise;
}

function handleFirstInteraction(): void {
  void unlockAudio();
}

/**
 * Attach listeners to window and document to capture the very first user touch or click.
 */
export function initMobileUnlock(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (!listenersAttached && !unlocked) {
    listenersAttached = true;
    const opts: AddEventListenerOptions = { capture: true, passive: true };

    for (const evt of UNLOCK_EVENTS) {
      window.addEventListener(evt, handleFirstInteraction, opts);
      document.addEventListener(evt, handleFirstInteraction, opts);
    }
  }

  if (!visibilityListenersAttached) {
    visibilityListenersAttached = true;
    setupVisibilityHandling();
  }
}

function removeInteractionListeners(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const opts: AddEventListenerOptions = { capture: true };
  for (const evt of UNLOCK_EVENTS) {
    window.removeEventListener(evt, handleFirstInteraction, opts);
    document.removeEventListener(evt, handleFirstInteraction, opts);
  }
  listenersAttached = false;
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
      if (typeof Howler !== 'undefined' && Howler.ctx && Howler.ctx.state === 'running') {
        Howler.ctx.suspend().catch(() => {});
      }
    } else if (document.visibilityState === 'visible') {
      if (unlocked) {
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        if (typeof Howler !== 'undefined' && Howler.ctx && Howler.ctx.state === 'suspended') {
          Howler.ctx.resume().catch(() => {});
        }
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
    if (unlocked) {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
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
