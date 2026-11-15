/* ─────────────────────────────────────────────────────────────
 *  tokens.ts – Child-friendly design tokens for Colour Quest
 *  Vibrant pastel/primary palette, rounded typography & touch dimensions
 * ───────────────────────────────────────────────────────────── */

// ── Colors ──
export const COLORS = {
  // Required core palette
  candyPink: '#FF4B72',
  sunnyYellow: '#FFD000',
  brightCyan: '#00C4FF',
  mintGreen: '#00E676',
  purpleJoy: '#9B51E0',
  softOrange: '#FF8A00',
  darkPlum: '#2E1B4E',
  creamWhite: '#FFFDF7',
  outlineDark: '#1E1A34',

  // 3D Button Shadows (darker bevel shades)
  candyPinkShadow: '#D92A51',
  sunnyYellowShadow: '#D4A300',
  brightCyanShadow: '#0097C4',
  mintGreenShadow: '#00B359',
  purpleJoyShadow: '#7935B8',
  softOrangeShadow: '#D46D00',
  creamWhiteShadow: '#E2DEC9',
  grayShadow: '#8C859E',

  // Soft backgrounds and tints
  skyBlueLight: '#E8F7FF',
  lavenderLight: '#F3EEFB',
  mintLight: '#E8FAF0',
  pinkLight: '#FFEBF0',
  yellowLight: '#FFFBE5',

  // Card & Surface
  cardBg: '#FFFFFF',
  cardOutline: '#1E1A34',
  cardShadow: '#E4DFEC',
  modalBackdrop: 'rgba(30, 26, 52, 0.72)',

  // Stars & Rewards
  starGold: '#FFD000',
  starGlow: '#FFE866',
  starEmpty: '#DDD7E8',
  starEmptyOutline: '#B2AAC4',

  // State colors
  disabledBg: '#D6D2E0',
  disabledText: '#8E879E',
  disabledShadow: '#B0AAC0',
  success: '#00E676',
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
