/* ─────────────────────────────────────────────────────────────
 *  tokens.ts – Child-friendly design tokens for Colour Quest
 *  Vibrant pastel/primary palette, rounded typography & touch dimensions
 * ───────────────────────────────────────────────────────────── */

// ── Colors: 80% Clotted Cream (#EEE2CB) & 20% Spruce Velvet (#1B4532) ──
export const COLORS = {
  // 80% Dominant Surface & Background – Clotted Cream (#EEE2CB)
  clottedCream: '#EEE2CB',
  clottedCreamLight: '#FAF5EC',
  clottedCreamDark: '#D8C9AE',
  clottedCreamCard: '#F5ECDB',

  // 20% Primary Accent, Structural & Interactive – Spruce Velvet (#1B4532)
  spruceVelvet: '#1B4532',
  spruceVelvetLight: '#265D44',
  spruceVelvetShadow: '#0E241A',
  spruceVelvetMuted: '#3A6350',

  // Semantic & child-friendly accent tokens
  candyPink: '#FF4B72',
  sunnyYellow: '#FFD000',
  brightCyan: '#00C4FF',
  mintGreen: '#00E676',
  softOrange: '#FF8A00',
  creamWhite: '#FFFDF7',
  outlineDark: '#1B4532',

  // Backward-compatible non-purple aliases
  purpleJoy: '#1B4532',
  purpleJoyShadow: '#0E241A',
  darkPlum: '#1B4532',

  // 3D Button Shadows
  candyPinkShadow: '#D92A51',
  sunnyYellowShadow: '#D4A300',
  brightCyanShadow: '#0097C4',
  mintGreenShadow: '#00B359',
  softOrangeShadow: '#D46D00',
  creamWhiteShadow: '#D8C9AE',
  grayShadow: '#B5A995',

  // Soft backgrounds and tints (Warm Cream tones)
  skyBlueLight: '#F2ECE0',
  lavenderLight: '#EDE4D1',
  mintLight: '#E8F3EC',
  pinkLight: '#F7EBE8',
  yellowLight: '#FAF5DF',

  // Card & Surface
  cardBg: '#FFFDF9',
  cardOutline: '#1B4532',
  cardShadow: '#D8C9AE',
  modalBackdrop: 'rgba(27, 69, 50, 0.72)',

  // Stars & Rewards
  starGold: '#FFD000',
  starGlow: '#FFE866',
  starEmpty: '#DDD5C4',
  starEmptyOutline: '#BDB19C',

  // State colors
  disabledBg: '#DDD5C4',
  disabledText: '#8C8271',
  disabledShadow: '#BDB19C',
  success: '#1B4532',
  error: '#FF4B72',
} as const;

export type ColorToken = keyof typeof COLORS;

// ── Typography ──
export const FONT_FAMILY =
  "'Nunito', 'Comfortaa', 'Quicksand', 'Comic Sans MS', system-ui, -apple-system, sans-serif";

export const FONT_SIZES = {
  xs: 14,
  sm: 18,
  md: 24,
  lg: 32,
  xl: 42,
  xxl: 54,
  hero: 68,
} as const;

export const FONT_WEIGHTS = {
  normal: 600,
  bold: 800,
  extraBold: 900,
} as const;

/**
 * Builds a valid CSS font string for canvas 2D rendering
 */
export function getFont(
  size: number | keyof typeof FONT_SIZES = 'md',
  weight: number | keyof typeof FONT_WEIGHTS = 'bold',
  family: string = FONT_FAMILY
): string {
  const pixelSize = typeof size === 'number' ? size : FONT_SIZES[size];
  const weightVal = typeof weight === 'number' ? weight : FONT_WEIGHTS[weight];
  return `${weightVal} ${pixelSize}px ${family}`;
}

// ── Dimensions & Sizing ──
export const MIN_TOUCH_TARGET = 72;
export const BORDER_RADIUS = 16;
export const OUTLINE_WIDTH = 4;

export const DIMENSIONS = {
  minTouchTarget: MIN_TOUCH_TARGET,
  borderRadius: BORDER_RADIUS,
  borderRadiusSm: 10,
  borderRadiusMd: BORDER_RADIUS,
  borderRadiusLg: 24,
  borderRadiusXl: 36,
  borderRadiusPill: 999,

  outlineWidth: OUTLINE_WIDTH,
  outlineWidthThin: 2,
  outlineWidthThick: 6,

  buttonHeightSm: 54,
  buttonHeightMd: 64,
  buttonHeightLg: 78,
  buttonShadowDepth: 8,
  buttonShadowDepthSm: 5,

  swatchSize: 64,
  swatchRadius: 16,

  starSizeLg: 56,
  starSizeMd: 38,
  starSizeSm: 24,

  safeAreaMargin: 24,
  modalMaxWidth: 640,
  modalMaxHeight: 520,
} as const;

// ── Animation & Transitions ──
export const TIMINGS = {
  pressSquashDurationMs: 100,
  bounceAnimDurationMs: 1200,
  starPopDelayMs: 300,
  modalFadeInMs: 250,
  pageTransitionMs: 300,
} as const;
