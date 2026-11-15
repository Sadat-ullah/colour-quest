/* ─────────────────────────────────────────────────────────────
 *  constants.ts – FROZEN shared constants
 *  All agents may read; NO agent may change existing values.
 * ───────────────────────────────────────────────────────────── */

// ── Canvas / viewport ──
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;
export const MIN_WIDTH = 360;
export const MIN_HEIGHT = 640;

// ── Gameplay ──
export const TOTAL_LEVELS = 100;
export const MAX_STARS = 3;
export const STAR_THRESHOLDS = { 3: 1.0, 2: 0.7, 1: 0.4 } as const;  // accuracy

// ── Timing (ms) ──
export const TAP_FEEDBACK_MS = 80;
export const FILL_ANIM_MS = 400;
export const SCENE_TRANSITION_MS = 500;
export const RESULT_DELAY_MS = 800;

// ── UI sizing ──
export const MIN_TOUCH_TARGET = 72;
export const COLOR_SWATCH_SIZE = 64;
export const COLOR_SWATCH_RADIUS = 14;
export const PALETTE_GAP = 12;

// ── Audio ──
export const MUSIC_DEFAULT_VOL = 0.35;
export const SFX_DEFAULT_VOL = 0.7;

// ── Storage ──
export const SAVE_KEY = 'colour-quest-progress';
export const SAVE_VERSION = 1;

// ── Category ranges ──
export const CATEGORY_RANGES = {
  tutorial:       { start: 1,  end: 10 },
  simple_objects: { start: 11, end: 25 },
  animals:        { start: 26, end: 45 },
  nature:         { start: 46, end: 65 },
  scenes:         { start: 66, end: 80 },
  master:         { start: 81, end: 100 },
} as const;
