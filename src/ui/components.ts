/* ─────────────────────────────────────────────────────────────
 *  components.ts – Reusable child-friendly Canvas 2D UI Components
 *  Includes 3D buttons, color swatches, stars, progress bars & icons
 * ───────────────────────────────────────────────────────────── */
import {
  COLORS,
  BORDER_RADIUS,
  OUTLINE_WIDTH,
  DIMENSIONS,
  getFont,
} from './tokens';

export interface CornerRadii {
  tl?: number;
  tr?: number;
  br?: number;
  bl?: number;
}

/**
 * Draws a rounded rectangle path with customizable corner radii
 */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | CornerRadii = BORDER_RADIUS,
  fillColor?: string,
  strokeColor?: string,
  strokeWidth: number = OUTLINE_WIDTH
): void {
  const maxR = Math.min(Math.abs(w) / 2, Math.abs(h) / 2);
  let tl = 0, tr = 0, br = 0, bl = 0;

  if (typeof r === 'number') {
    const clampedR = Math.max(0, Math.min(r, maxR));
    tl = tr = br = bl = clampedR;
  } else {
    tl = Math.max(0, Math.min(r.tl ?? 0, maxR));
    tr = Math.max(0, Math.min(r.tr ?? 0, maxR));
    br = Math.max(0, Math.min(r.br ?? 0, maxR));
    bl = Math.max(0, Math.min(r.bl ?? 0, maxR));
  }

  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr > 0) ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  if (br > 0) ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  if (bl > 0) ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  if (tl > 0) ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  if (strokeColor && strokeWidth > 0) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

export interface ButtonOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  icon?: string;
  color?: string;
  shadowColor?: string;
  textColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  radius?: number;
  shadowDepth?: number;
  fontSize?: number;
  fontFamily?: string;
  isPressed?: boolean;
  isHovered?: boolean;
  isDisabled?: boolean;
  glow?: boolean;
  glowColor?: string;
  badge?: string | number;
}

/**
 * Checks if a 2D canvas point hits inside a rectangular bounding box
 */
export function isPointInButton(
  btn: { x: number; y: number; w: number; h: number },
  px: number,
  py: number
): boolean {
  return px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h;
}

/**
 * Draws a juicy 3D push-button with bottom bevel shadow, top gloss, and pressed state
 */
export function drawButton(ctx: CanvasRenderingContext2D, opts: ButtonOptions): void {
  const {
    x,
    y,
    w,
    h,
    text,
    icon,
    color = COLORS.sunnyYellow,
    shadowColor = COLORS.sunnyYellowShadow,
    textColor = COLORS.darkPlum,
    strokeColor = COLORS.outlineDark,
    strokeWidth = OUTLINE_WIDTH,
    radius = BORDER_RADIUS,
    shadowDepth = DIMENSIONS.buttonShadowDepth,
    fontSize = 24,
    isPressed = false,
    isHovered = false,
    isDisabled = false,
    glow = false,
    glowColor = COLORS.sunnyYellow,
    badge,
  } = opts;

  ctx.save();

  const finalColor = isDisabled ? COLORS.disabledBg : color;
  const finalShadowColor = isDisabled ? COLORS.disabledShadow : shadowColor;
  const finalTextColor = isDisabled ? COLORS.disabledText : textColor;

  // Press offset calculation
  const pressShift = isPressed && !isDisabled ? shadowDepth - 2 : 0;
  const faceHeight = Math.max(10, h - shadowDepth);
  const faceY = y + pressShift;

  // Glow if active
  if (glow && !isDisabled) {
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
    drawRoundedRect(ctx, x, y, w, h, radius, glowColor, undefined, 0);
    ctx.restore();
  }

  // 1. Draw 3D bottom bevel/shadow (if not disabled flat)
  if (shadowDepth > 0 && !isDisabled) {
    drawRoundedRect(
      ctx,
      x,
      y + shadowDepth,
      w,
      faceHeight,
      radius,
      finalShadowColor,
      strokeColor,
      strokeWidth
    );
  }

  // 2. Draw Main Button Face
  drawRoundedRect(
    ctx,
    x,
    faceY,
    w,
    faceHeight,
    radius,
    finalColor,
    strokeColor,
    strokeWidth
  );

  // 3. Subtle Top Gloss Shine (kid-friendly candy feel)
  if (!isDisabled && faceHeight > 20) {
    ctx.save();
    ctx.beginPath();
    const glossRadius = Math.max(4, radius - 4);
    const glossH = Math.floor(faceHeight * 0.38);
    // Draw top half pill inside face
    drawRoundedRect(
      ctx,
      x + 4,
      faceY + 4,
      w - 8,
      glossH,
      { tl: glossRadius, tr: glossRadius, bl: 4, br: 4 },
      'rgba(255, 255, 255, 0.28)'
    );
    ctx.restore();
  }

  // Hover subtle highlight
  if (isHovered && !isPressed && !isDisabled) {
    drawRoundedRect(
      ctx,
      x,
      faceY,
      w,
      faceHeight,
      radius,
      'rgba(255, 255, 255, 0.15)'
    );
  }

  // 4. Content (Text & Icon)
  ctx.save();
  ctx.font = getFont(fontSize, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = finalTextColor;

  const centerY = faceY + faceHeight / 2;

  if (icon && text) {
    // Both icon and text: space them horizontally
    const iconSize = Math.round(fontSize * 1.1);
    ctx.font = getFont(fontSize, 'bold');
    const textMetrics = ctx.measureText(text);
    const gap = 10;
    const totalW = iconSize + gap + textMetrics.width;
    const startX = x + (w - totalW) / 2;

    drawIcon(ctx, icon, startX + iconSize / 2, centerY, iconSize, finalTextColor);
    ctx.fillText(text, startX + iconSize + gap + textMetrics.width / 2, centerY + 1);
  } else if (icon) {
    // Icon only
    const iconSize = Math.min(w * 0.55, faceHeight * 0.55, fontSize * 1.4);
    drawIcon(ctx, icon, x + w / 2, centerY, iconSize, finalTextColor);
  } else if (text) {
    // Text only
    ctx.fillText(text, x + w / 2, centerY + 1);
  }

  // Optional Badge (e.g. level count, notification)
  if (badge !== undefined && badge !== null && badge !== '') {
    const badgeText = String(badge);
    const badgeR = 14;
    const badgeX = x + w - 10;
    const badgeY = faceY + 6;
    ctx.save();
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.candyPink;
    ctx.fill();
    ctx.strokeStyle = COLORS.creamWhite;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = COLORS.creamWhite;
    ctx.font = getFont(13, 'extraBold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, badgeX, badgeY + 1);
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

/**
 * Draws a palette color swatch with 3D depth, selection checkmark, and active glow
 */
export function drawColorSwatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number = DIMENSIONS.swatchSize,
  color: string,
  isSelected: boolean = false,
  isHighlighted: boolean = false
): void {
  ctx.save();

  const radius = DIMENSIONS.swatchRadius;
  const shadowDepth = 6;
  const shiftY = isSelected ? 3 : 0;
  const faceH = size - shadowDepth;

  // 1. Highlight Glow
  if (isHighlighted || isSelected) {
    ctx.save();
    ctx.shadowColor = color === '#FFFFFF' ? COLORS.sunnyYellow : color;
    ctx.shadowBlur = 18;
    drawRoundedRect(ctx, x - 2, y - 2, size + 4, size + 4, radius + 2, 'rgba(255, 255, 255, 0.4)');
    ctx.restore();
  }

  // 2. Bottom shadow / bevel
  drawRoundedRect(
    ctx,
    x,
    y + shadowDepth,
    size,
    faceH,
    radius,
    'rgba(0, 0, 0, 0.22)',
    COLORS.outlineDark,
    OUTLINE_WIDTH
  );

  // 3. Swatch face
  drawRoundedRect(
    ctx,
    x,
    y + shiftY,
    size,
    faceH,
    radius,
    color,
    isSelected ? COLORS.creamWhite : COLORS.outlineDark,
    isSelected ? OUTLINE_WIDTH + 1 : OUTLINE_WIDTH
  );

  // Outer border if selected (double ring)
  if (isSelected) {
    drawRoundedRect(
      ctx,
      x - 3,
      y + shiftY - 3,
      size + 6,
      faceH + 6,
      radius + 3,
      undefined,
      COLORS.outlineDark,
      OUTLINE_WIDTH
    );
  }

  // 4. Juicy highlight arc on upper half
  ctx.save();
  drawRoundedRect(
    ctx,
    x + 4,
    y + shiftY + 4,
    size - 8,
    faceH * 0.38,
    { tl: radius - 3, tr: radius - 3, bl: 4, br: 4 },
    'rgba(255, 255, 255, 0.32)'
  );
  ctx.restore();

  // 5. Checkmark or center dot when selected
  if (isSelected) {
    const cx = x + size / 2;
    const cy = y + shiftY + faceH / 2;

    // Checkmark outline/shadow
    ctx.save();
    ctx.strokeStyle = COLORS.outlineDark;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 1);
    ctx.lineTo(cx - 3, cy + 8);
    ctx.lineTo(cx + 12, cy - 8);
    ctx.stroke();

    // Checkmark bright white face
    ctx.strokeStyle = COLORS.creamWhite;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Draws a 5-point star with soft gradient, specular shine, and optional vibrant glow
 */
export function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  points: number = 5,
  outerR: number = 24,
  innerR: number = outerR * 0.48,
  isFilled: boolean = true,
  glow: boolean = false
): void {
  ctx.save();

  const buildStarPath = () => {
    ctx.beginPath();
    const step = Math.PI / points;
    let angle = -Math.PI / 2;
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
      angle += step;
    }
    ctx.closePath();
  };

  // Glow behind filled star
  if (isFilled && glow) {
    ctx.save();
    ctx.shadowColor = COLORS.starGlow;
    ctx.shadowBlur = 20;
    ctx.fillStyle = COLORS.starGold;
    buildStarPath();
    ctx.fill();
    ctx.restore();
  }

  buildStarPath();

  if (isFilled) {
    // Golden gradient fill
    const grad = ctx.createLinearGradient(cx, cy - outerR, cx, cy + outerR);
    grad.addColorStop(0, '#FFF066');
    grad.addColorStop(0.4, COLORS.starGold);
    grad.addColorStop(1, '#FF9900');
    ctx.fillStyle = grad;
    ctx.fill();

    // Dark crisp outline
    ctx.strokeStyle = COLORS.outlineDark;
    ctx.lineWidth = Math.max(2.5, outerR * 0.12);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Specular shine on upper-left point
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(cx - outerR * 0.28, cy - outerR * 0.28, outerR * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    // Inactive / Empty Star
    ctx.fillStyle = COLORS.starEmpty;
    ctx.fill();

    ctx.strokeStyle = COLORS.starEmptyOutline;
    ctx.lineWidth = Math.max(2, outerR * 0.1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws a rounded candy progress bar with glossy shine and child-friendly border
 */
export function drawProgressBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  progress: number, // 0 to 1
  color: string = COLORS.mintGreen,
  trackColor: string = COLORS.lavenderLight
): void {
  const clamped = Math.max(0, Math.min(1, isNaN(progress) ? 0 : progress));
  const r = h / 2;

  ctx.save();

  // 1. Track background
  drawRoundedRect(
    ctx,
    x,
    y,
    w,
    h,
    r,
    trackColor,
    COLORS.outlineDark,
    OUTLINE_WIDTH
  );

  // Inset inner shadow for track
  drawRoundedRect(
    ctx,
    x + 2,
    y + 2,
    w - 4,
    h * 0.35,
    { tl: r - 2, tr: r - 2, bl: 2, br: 2 },
    'rgba(30, 26, 52, 0.08)'
  );

  // 2. Active filled progress
  if (clamped > 0.02) {
    const fillW = Math.max(h, w * clamped);
    ctx.save();
    // Clip to rounded track
    ctx.beginPath();
    const maxR = h / 2;
    ctx.arc(x + maxR, y + maxR, maxR, Math.PI / 2, (3 * Math.PI) / 2);
    ctx.lineTo(x + w - maxR, y);
    ctx.arc(x + w - maxR, y + maxR, maxR, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x + maxR, y + h);
    ctx.closePath();
    ctx.clip();

    // Fill bar
    drawRoundedRect(ctx, x, y, fillW, h, r, color);

    // Gloss shine along top
    drawRoundedRect(
      ctx,
      x + 3,
      y + 3,
      fillW - 6,
      h * 0.36,
      r - 2,
      'rgba(255, 255, 255, 0.35)'
    );

    // Right edge cap of progress
    ctx.strokeStyle = COLORS.outlineDark;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + fillW, y + 2);
    ctx.lineTo(x + fillW, y + h - 2);
    ctx.stroke();

    ctx.restore();
  }

  // Re-stroke outer frame
  drawRoundedRect(
    ctx,
    x,
    y,
    w,
    h,
    r,
    undefined,
    COLORS.outlineDark,
    OUTLINE_WIDTH
  );

  ctx.restore();
}

/**
 * Draws reusable vector UI icons with rounded edges
 */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  icon: string,
  cx: number,
  cy: number,
  size: number,
  color: string = COLORS.darkPlum
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const half = size / 2;

  switch (icon) {
    case 'play': {
      // Right-pointing rounded triangle
      ctx.beginPath();
      const pX = cx - half * 0.6;
      const pY1 = cy - half * 0.85;
      const pY2 = cy + half * 0.85;
      const tipX = cx + half * 0.85;
      ctx.moveTo(pX, pY1);
      ctx.lineTo(tipX, cy);
      ctx.lineTo(pX, pY2);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'lock': {
      // Padlock: shackle + body
      const bodyW = size * 0.72;
      const bodyH = size * 0.55;
      const bodyX = cx - bodyW / 2;
      const bodyY = cy - bodyH / 2 + size * 0.15;

      // Shackle
      ctx.lineWidth = Math.max(3, size * 0.14);
      ctx.beginPath();
      const shackleR = bodyW * 0.32;
      ctx.arc(cx, bodyY - 2, shackleR, Math.PI, 0, false);
      ctx.stroke();

      // Body
      drawRoundedRect(ctx, bodyX, bodyY, bodyW, bodyH, 6, color);

      // Keyhole
      ctx.fillStyle = COLORS.creamWhite;
      ctx.beginPath();
      ctx.arc(cx, bodyY + bodyH * 0.38, size * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - size * 0.04, bodyY + bodyH * 0.38, size * 0.08, size * 0.18);
      break;
    }

    case 'audio-on':
    case 'sound-on':
    case 'music-on': {
      // Speaker body
      const spkW = size * 0.3;
      const spkH = size * 0.44;
      ctx.beginPath();
      ctx.fillRect(cx - half * 0.8, cy - spkH / 4, spkW, spkH / 2);
      ctx.beginPath();
      ctx.moveTo(cx - half * 0.5, cy - spkH / 4);
      ctx.lineTo(cx - half * 0.1, cy - half * 0.75);
      ctx.lineTo(cx - half * 0.1, cy + half * 0.75);
      ctx.lineTo(cx - half * 0.5, cy + spkH / 4);
      ctx.closePath();
      ctx.fill();

      // Waves
      ctx.lineWidth = Math.max(2.5, size * 0.1);
      ctx.beginPath();
      ctx.arc(cx - half * 0.1, cy, half * 0.5, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx - half * 0.1, cy, half * 0.9, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
      break;
    }

    case 'audio-off':
    case 'sound-off':
    case 'music-off': {
      // Speaker body
      const spkW = size * 0.3;
      const spkH = size * 0.44;
      ctx.beginPath();
      ctx.fillRect(cx - half * 0.8, cy - spkH / 4, spkW, spkH / 2);
      ctx.beginPath();
      ctx.moveTo(cx - half * 0.5, cy - spkH / 4);
      ctx.lineTo(cx - half * 0.1, cy - half * 0.75);
      ctx.lineTo(cx - half * 0.1, cy + half * 0.75);
      ctx.lineTo(cx - half * 0.5, cy + spkH / 4);
      ctx.closePath();
      ctx.fill();

      // Strike-through X or slash
      ctx.lineWidth = Math.max(3, size * 0.12);
      ctx.strokeStyle = COLORS.candyPink;
      ctx.beginPath();
      ctx.moveTo(cx + half * 0.1, cy - half * 0.5);
      ctx.lineTo(cx + half * 0.8, cy + half * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + half * 0.8, cy - half * 0.5);
      ctx.lineTo(cx + half * 0.1, cy + half * 0.5);
      ctx.stroke();
      break;
    }

    case 'back':
    case 'arrow-left': {
      ctx.lineWidth = Math.max(3.5, size * 0.14);
      ctx.beginPath();
      ctx.moveTo(cx + half * 0.5, cy);
      ctx.lineTo(cx - half * 0.4, cy);
      ctx.moveTo(cx - half * 0.05, cy - half * 0.55);
      ctx.lineTo(cx - half * 0.45, cy);
      ctx.lineTo(cx - half * 0.05, cy + half * 0.55);
      ctx.stroke();
      break;
    }

    case 'arrow-right': {
      ctx.lineWidth = Math.max(3.5, size * 0.14);
      ctx.beginPath();
      ctx.moveTo(cx - half * 0.5, cy);
      ctx.lineTo(cx + half * 0.4, cy);
      ctx.moveTo(cx + half * 0.05, cy - half * 0.55);
      ctx.lineTo(cx + half * 0.45, cy);
      ctx.lineTo(cx + half * 0.05, cy + half * 0.55);
      ctx.stroke();
      break;
    }

    case 'replay': {
      ctx.lineWidth = Math.max(3, size * 0.13);
      ctx.beginPath();
      ctx.arc(cx, cy, half * 0.65, -Math.PI / 4, (4 * Math.PI) / 3, false);
      ctx.stroke();

      // Arrow head
      ctx.beginPath();
      const ax = cx + half * 0.45;
      const ay = cy - half * 0.45;
      ctx.moveTo(ax - size * 0.12, ay - size * 0.18);
      ctx.lineTo(ax + size * 0.12, ay);
      ctx.lineTo(ax - size * 0.18, ay + size * 0.12);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'menu': {
      // 3 rounded horizontal hamburger lines
      ctx.lineWidth = Math.max(3.5, size * 0.13);
      const lineW = size * 0.7;
      const gap = size * 0.22;
      ctx.beginPath();
      ctx.moveTo(cx - lineW / 2, cy - gap);
      ctx.lineTo(cx + lineW / 2, cy - gap);
      ctx.moveTo(cx - lineW / 2, cy);
      ctx.lineTo(cx + lineW / 2, cy);
      ctx.moveTo(cx - lineW / 2, cy + gap);
      ctx.lineTo(cx + lineW / 2, cy + gap);
      ctx.stroke();
      break;
    }

    case 'check': {
      ctx.lineWidth = Math.max(3.5, size * 0.14);
      ctx.beginPath();
      ctx.moveTo(cx - half * 0.6, cy);
      ctx.lineTo(cx - half * 0.1, cy + half * 0.5);
      ctx.lineTo(cx + half * 0.7, cy - half * 0.5);
      ctx.stroke();
      break;
    }

    case 'star': {
      drawStar(ctx, cx, cy, 5, half, half * 0.48, true, false);
      break;
    }

    default: {
      // Fallback: render text/emoji
      ctx.font = getFont(Math.round(size * 0.8), 'bold');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, cx, cy);
      break;
    }
  }

  ctx.restore();
}

/**
 * Draws a floating background bubble for lively animated scenes
 */
export function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string = COLORS.brightCyan,
  alpha: number = 0.25
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Subtle gloss crescent on bubble
  ctx.fillStyle = '#FFFFFF';
  ctx.globalAlpha = alpha * 0.8;
  ctx.beginPath();
  ctx.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws a 4-point sparkle star for particle celebrations & shiny objects
 */
export function drawSparkle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string = COLORS.sunnyYellow,
  rotation: number = 0
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.fillStyle = color;

  const half = size / 2;
  const inner = size * 0.14;

  ctx.beginPath();
  ctx.moveTo(0, -half);
  ctx.quadraticCurveTo(0, -inner, inner, 0);
  ctx.quadraticCurveTo(0, inner, 0, half);
  ctx.quadraticCurveTo(0, inner, -inner, 0);
  ctx.quadraticCurveTo(0, -inner, 0, -half);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
