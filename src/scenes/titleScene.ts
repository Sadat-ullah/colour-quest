/* ─────────────────────────────────────────────────────────────
 *  titleScene.ts – Title Screen Scene for Colour Quest
 *  Playful bouncing 3D logo, "Let's Play! ▶", Level Select & Audio toggle
 * ───────────────────────────────────────────────────────────── */
import {
  COLORS,
  FONT_FAMILY,
  DIMENSIONS,
  MIN_TOUCH_TARGET,
  getFont,
} from '../ui/tokens';
import {
  drawButton,
  drawGlossyGreenButton,
  drawVolumeButton,
  drawRoundedRect,
  drawIcon,
  drawBubble,
  drawSparkle,
  isPointInButton,
  type ButtonOptions,
} from '../ui/components';
import { backgroundRenderer } from '../ui/backgroundRenderer';
import { eventBus } from '../shared/eventBus';
import { audioManager } from '../audio/audioManager';
import { saveManager } from '../game/saveManager';
import { sceneManager, type Scene } from '../core/sceneManager';
import { DESIGN_WIDTH, DESIGN_HEIGHT, TOTAL_LEVELS } from '../shared/constants';
import type { SceneName } from '../shared/contracts';

interface FloatingBubble {
  x: number;
  y: number;
  radius: number;
  color: string;
  speedY: number;
  driftX: number;
  driftPhase: number;
  alpha: number;
}

interface SparkleParticle {
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  phase: number;
}

export class TitleScene implements Scene {
  public name: SceneName = 'title';
  private animTime: number = 0;
  private bubbles: FloatingBubble[] = [];
  private sparkles: SparkleParticle[] = [];
  private pressedButtonId: string | null = null;
  private hoveredButtonId: string | null = null;

  // Layout rectangles (computed during render/layout)
  private playBtnRect = { x: 0, y: 0, w: 320, h: 84 };
  private levelSelectBtnRect = { x: 0, y: 0, w: 260, h: 72 };
  private audioBtnRect = { x: 0, y: 0, w: 72, h: 72 };

  constructor() {
    this.initBackgroundEffects();
  }

  private initBackgroundEffects(): void {
    const bubbleColors = [
      COLORS.candyPink,
      COLORS.sunnyYellow,
      COLORS.brightCyan,
      COLORS.mintGreen,
      COLORS.purpleJoy,
      COLORS.softOrange,
    ];

    this.bubbles = [];
    for (let i = 0; i < 18; i++) {
      this.bubbles.push({
        x: Math.random() * DESIGN_WIDTH,
        y: Math.random() * DESIGN_HEIGHT,
        radius: 16 + Math.random() * 32,
        color: bubbleColors[i % bubbleColors.length],
        speedY: 0.3 + Math.random() * 0.7,
        driftX: 10 + Math.random() * 20,
        driftPhase: Math.random() * Math.PI * 2,
        alpha: 0.15 + Math.random() * 0.2,
      });
    }

    this.sparkles = [];
    for (let i = 0; i < 12; i++) {
      this.sparkles.push({
        x: Math.random() * DESIGN_WIDTH,
        y: Math.random() * DESIGN_HEIGHT,
        size: 14 + Math.random() * 18,
        color: i % 2 === 0 ? COLORS.sunnyYellow : COLORS.creamWhite,
        rotation: Math.random() * Math.PI,
        rotSpeed: 0.8 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  public enter(params?: Record<string, unknown>): void {
    this.animTime = 0;
    this.pressedButtonId = null;
    this.hoveredButtonId = null;
  }

  public exit(): void {
    this.pressedButtonId = null;
  }

  public onTap(x: number, y: number): void {
    this.handleTap(x, y);
  }

  public update(dt: number): void {
    // dt in milliseconds
    const sec = dt / 1000;
    this.animTime += sec;
    backgroundRenderer.update(sec);

    // Update bubbles drifting upwards
    for (const b of this.bubbles) {
      b.y -= b.speedY * (dt / 16);
      b.driftPhase += 0.02 * (dt / 16);
      b.x += Math.sin(b.driftPhase) * 0.4;
      if (b.y < -b.radius * 2) {
        b.y = DESIGN_HEIGHT + b.radius;
        b.x = Math.random() * DESIGN_WIDTH;
      }
    }

    // Update sparkles
    for (const s of this.sparkles) {
      s.rotation += s.rotSpeed * sec;
      s.phase += 2 * sec;
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number = DESIGN_WIDTH,
    height: number = DESIGN_HEIGHT
  ): void {
    const isPortrait = height > width;

    // 1. Warm British picture-book watercolor background with paper texture, washes, hills and corner flora
    backgroundRenderer.render(ctx, width, height, {
      showHills: true,
      showFlora: true,
      showCritters: false,
      showWashes: true,
    });

    // 3. Floating Animated Bubbles
    for (const b of this.bubbles) {
      const scaleX = width / DESIGN_WIDTH;
      const scaleY = height / DESIGN_HEIGHT;
      drawBubble(ctx, b.x * scaleX, b.y * scaleY, b.radius, b.color, b.alpha);
    }

    // 4. Sparkles
    for (const s of this.sparkles) {
      const scaleX = width / DESIGN_WIDTH;
      const scaleY = height / DESIGN_HEIGHT;
      const pulse = 0.75 + Math.sin(s.phase) * 0.35;
      if (pulse > 0.1) {
        drawSparkle(ctx, s.x * scaleX, s.y * scaleY, s.size * pulse, s.color, s.rotation);
      }
    }

    // 5. Header Area (Safe Area)
    this.renderHeader(ctx, width, height);

    // 6. Big Colourful "Colour Quest" Bouncing Logo
    this.renderLogo(ctx, width, height, isPortrait);

    // 7. Interactive Action Buttons
    this.renderButtons(ctx, width, height, isPortrait);
  }

  private renderHills(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Back Hill (Clotted Cream Darker Tint)
    ctx.fillStyle = '#DFD0B5';
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.quadraticCurveTo(width * 0.35, height - 120, width * 0.75, height - 70);
    ctx.quadraticCurveTo(width * 0.9, height - 50, width, height - 60);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Front Hill (Warm Muted Tone)
    ctx.fillStyle = '#D2C1A2';
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, height - 75);
    ctx.quadraticCurveTo(width * 0.25, height - 95, width * 0.55, height - 50);
    ctx.quadraticCurveTo(width * 0.8, height - 15, width, height - 40);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Outline over front hill in Spruce Velvet
    ctx.strokeStyle = 'rgba(27, 69, 50, 0.25)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  private renderHeader(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const margin = DIMENSIONS.safeAreaMargin;

    // Stars Trophy Counter in top-left
    const progress = saveManager.getProgress();
    let totalStars = 0;
    for (const res of Object.values(progress.results)) {
      totalStars += res.stars ?? 0;
    }
    const maxStarsPossible = TOTAL_LEVELS * 3;

    const badgeW = 150;
    const badgeH = 50;
    const badgeX = margin;
    const badgeY = margin;

    drawRoundedRect(
      ctx,
      badgeX,
      badgeY,
      badgeW,
      badgeH,
      DIMENSIONS.borderRadiusPill,
      COLORS.creamWhite,
      COLORS.outlineDark,
      3
    );

    // Draw little star in badge
    ctx.save();
    ctx.font = getFont(18, 'extraBold');
    ctx.fillStyle = COLORS.darkPlum;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('⭐', badgeX + 14, badgeY + badgeH / 2 + 1);
    ctx.fillText(`${totalStars} / ${maxStarsPossible}`, badgeX + 46, badgeY + badgeH / 2 + 1);
    ctx.restore();

    // Audio Mute/Unmute Button in top-right with signature green gradient
    const isMuted = progress.settings.musicMuted && progress.settings.sfxMuted;
    const audioBtnSize = Math.max(MIN_TOUCH_TARGET, 58);
    this.audioBtnRect = {
      x: width - margin - audioBtnSize,
      y: margin,
      w: audioBtnSize,
      h: audioBtnSize,
    };

    drawVolumeButton(ctx, {
      x: this.audioBtnRect.x,
      y: this.audioBtnRect.y,
      w: this.audioBtnRect.w,
      h: this.audioBtnRect.h,
      isMuted,
      isPressed: this.pressedButtonId === 'audio',
      radius: 18,
    });
  }

  private renderLogo(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    isPortrait: boolean
  ): void {
    ctx.save();

    const logoCenterY = isPortrait ? height * 0.28 : height * 0.32;
    const logoScale = isPortrait ? Math.min(1, width / 450) : Math.min(1.2, width / 900);

    ctx.translate(width / 2, logoCenterY);
    ctx.scale(logoScale, logoScale);

    // Bouncing decorative banner backing
    const bannerBounce = Math.sin(this.animTime * 2.5) * 6;
    ctx.translate(0, bannerBounce);

    // Glowing halo behind logo
    ctx.save();
    ctx.shadowColor = 'rgba(255, 208, 0, 0.45)';
    ctx.shadowBlur = 35;
    drawRoundedRect(ctx, -280, -90, 560, 160, 40, 'rgba(255, 255, 255, 0.65)');
    ctx.restore();

    // Letters array: character, color
    const word1 = [
      { char: 'C', color: COLORS.candyPink },
      { char: 'o', color: COLORS.softOrange },
      { char: 'l', color: COLORS.sunnyYellow },
      { char: 'o', color: COLORS.mintGreen },
      { char: 'u', color: COLORS.brightCyan },
      { char: 'r', color: COLORS.purpleJoy },
    ];

    const word2 = [
      { char: 'Q', color: COLORS.candyPink },
      { char: 'u', color: COLORS.sunnyYellow },
      { char: 'e', color: COLORS.mintGreen },
      { char: 's', color: COLORS.brightCyan },
      { char: 't', color: COLORS.purpleJoy },
    ];

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const letterSize = 74;
    ctx.font = `900 ${letterSize}px ${FONT_FAMILY}`;

    // Layout Word 1: "Colour"
    const spacingW1 = 54;
    const startX1 = -((word1.length - 1) * spacingW1) / 2 - 140;
    const yW1 = -24;

    // Layout Word 2: "Quest"
    const spacingW2 = 54;
    const startX2 = -((word2.length - 1) * spacingW2) / 2 + 150;
    const yW2 = -24;

    const renderLetter = (
      item: { char: string; color: string },
      x: number,
      y: number,
      index: number
    ) => {
      const letterWave = Math.sin(this.animTime * 3.5 + index * 0.45) * 12;
      const curY = y + letterWave;

      // 3D bottom shadow for letter
      ctx.fillStyle = COLORS.outlineDark;
      ctx.fillText(item.char, x + 3, curY + 6);

      // Letter stroke
      ctx.strokeStyle = COLORS.outlineDark;
      ctx.lineWidth = 10;
      ctx.lineJoin = 'round';
      ctx.strokeText(item.char, x, curY);

      // Main vibrant letter fill
      ctx.fillStyle = item.color;
      ctx.fillText(item.char, x, curY);

      // Little cute white specular shine dot on letter
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(x - 12, curY - 20, 4.5, 0, Math.PI * 2);
      ctx.fill();
    };

    // If on very small screen or narrow portrait, stack words vertically
    if (isPortrait && width < 500) {
      const stackStartX1 = -((word1.length - 1) * spacingW1) / 2;
      word1.forEach((item, i) => renderLetter(item, stackStartX1 + i * spacingW1, -55, i));

      const stackStartX2 = -((word2.length - 1) * spacingW2) / 2;
      word2.forEach((item, i) => renderLetter(item, stackStartX2 + i * spacingW2, 35, i + 6));
    } else {
      // In-line single banner
      const fullWord = [...word1, { char: ' ', color: '' }, ...word2];
      const spacingFull = 48;
      const startFull = -((fullWord.length - 1) * spacingFull) / 2;
      fullWord.forEach((item, i) => {
        if (item.char === ' ') return;
        renderLetter(item, startFull + i * spacingFull, -15, i);
      });

      // Cute leaf accent sprig above the 'o' (matching reference)
      const leafX = startFull + 1 * spacingFull;
      const leafY = -62 + Math.sin(this.animTime * 3.5 + 0.45) * 12;
      ctx.save();
      ctx.translate(leafX, leafY);
      ctx.rotate(-0.25);
      // Little stem
      ctx.strokeStyle = '#1B4532';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.quadraticCurveTo(-4, 0, -8, -14);
      ctx.stroke();
      // Main green leaf
      ctx.fillStyle = '#52B788';
      ctx.beginPath();
      if (typeof ctx.ellipse === 'function') {
        ctx.ellipse(-10, -16, 12, 6, -0.4, 0, Math.PI * 2);
      } else {
        ctx.arc(-10, -16, 6, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      // Side green leaf
      ctx.fillStyle = '#74C69D';
      ctx.beginPath();
      if (typeof ctx.ellipse === 'function') {
        ctx.ellipse(2, -6, 9, 5, 0.4, 0, Math.PI * 2);
      } else {
        ctx.arc(2, -6, 5, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Surrounding 4-point decorative sparkles and confetti strokes
      drawSparkle(ctx, -235, -60, 18, '#FFD000', this.animTime);
      drawSparkle(ctx, 230, -65, 16, '#00C4FF', -this.animTime * 1.2);
      drawSparkle(ctx, -210, 40, 14, '#FF4B72', this.animTime * 0.8);
      drawSparkle(ctx, 215, 38, 15, '#FFD000', -this.animTime);

      // Confetti strokes
      const drawConfettiStroke = (cx: number, cy: number, rot: number, len: number, col: string) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.fillStyle = col;
        drawRoundedRect(ctx, -len / 2, -3, len, 6, 3, col);
        ctx.restore();
      };
      drawConfettiStroke(-255, -20, 0.4, 16, '#FF4B72');
      drawConfettiStroke(-235, 10, -0.3, 14, '#00C4FF');
      drawConfettiStroke(245, -25, -0.5, 16, '#FF8A00');
      drawConfettiStroke(255, 5, 0.35, 15, '#00E676');
    }

    // Subtitle Pill
    const subText = '🎨 Match & Paint the World!';
    ctx.font = getFont(22, 'bold');
    const subMetrics = ctx.measureText(subText);
    const subW = subMetrics.width + 44;
    const subH = 42;
    const subY = isPortrait && width < 500 ? 95 : 55;

    drawRoundedRect(
      ctx,
      -subW / 2,
      subY,
      subW,
      subH,
      DIMENSIONS.borderRadiusPill,
      COLORS.creamWhite,
      COLORS.outlineDark,
      3
    );

    ctx.fillStyle = COLORS.darkPlum;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(subText, 0, subY + subH / 2 + 1);

    ctx.restore();
  }

  private renderButtons(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    isPortrait: boolean
  ): void {
    const btnW = isPortrait ? Math.min(width - 64, 340) : 340;
    const btnH = 82;
    const centerX = (width - btnW) / 2;

    const startY = isPortrait ? height * 0.62 : height * 0.65;
    const gap = 20;

    // 1. Play Button "Let's Play! ▶" with rich 3D green gradient
    this.playBtnRect = {
      x: centerX,
      y: startY,
      w: btnW,
      h: btnH,
    };

    drawGlossyGreenButton(ctx, {
      x: this.playBtnRect.x,
      y: this.playBtnRect.y,
      w: this.playBtnRect.w,
      h: this.playBtnRect.h,
      text: "Let's Play! ▶",
      fontSize: 32,
      radius: 22,
      isPressed: this.pressedButtonId === 'play',
    });

    // Little sparkle accents on Let's Play button
    drawSparkle(ctx, this.playBtnRect.x + 16, this.playBtnRect.y + 14, 11, '#FFFFFF');
    drawSparkle(ctx, this.playBtnRect.x + this.playBtnRect.w - 18, this.playBtnRect.y + this.playBtnRect.h - 18, 12, '#FFD000');

    // 2. Level Select Button
    const lvlBtnH = 68;
    this.levelSelectBtnRect = {
      x: centerX,
      y: startY + btnH + gap,
      w: btnW,
      h: lvlBtnH,
    };

    drawButton(ctx, {
      x: this.levelSelectBtnRect.x,
      y: this.levelSelectBtnRect.y,
      w: this.levelSelectBtnRect.w,
      h: this.levelSelectBtnRect.h,
      text: 'Level Select 🗺️',
      color: COLORS.clottedCreamCard,
      shadowColor: COLORS.clottedCreamDark,
      textColor: COLORS.spruceVelvet,
      fontSize: 24,
      radius: DIMENSIONS.borderRadiusLg,
      shadowDepth: 7,
      isPressed: this.pressedButtonId === 'levelSelect',
      isHovered: this.hoveredButtonId === 'levelSelect',
    });
  }

  public handlePointerDown(x: number, y: number): boolean {
    if (isPointInButton(this.playBtnRect, x, y)) {
      this.pressedButtonId = 'play';
      return true;
    }
    if (isPointInButton(this.levelSelectBtnRect, x, y)) {
      this.pressedButtonId = 'levelSelect';
      return true;
    }
    if (isPointInButton(this.audioBtnRect, x, y)) {
      this.pressedButtonId = 'audio';
      return true;
    }
    return false;
  }

  public handlePointerUp(x: number, y: number): boolean {
    const wasPressed = this.pressedButtonId;
    this.pressedButtonId = null;

    if (wasPressed === 'play' && isPointInButton(this.playBtnRect, x, y)) {
      this.onPlayClicked();
      return true;
    }
    if (wasPressed === 'levelSelect' && isPointInButton(this.levelSelectBtnRect, x, y)) {
      this.onLevelSelectClicked();
      return true;
    }
    if (wasPressed === 'audio' && isPointInButton(this.audioBtnRect, x, y)) {
      this.onAudioToggleClicked();
      return true;
    }
    return false;
  }

  public handleTap(x: number, y: number): boolean {
    if (isPointInButton(this.playBtnRect, x, y)) {
      this.onPlayClicked();
      return true;
    }
    if (isPointInButton(this.levelSelectBtnRect, x, y)) {
      this.onLevelSelectClicked();
      return true;
    }
    if (isPointInButton(this.audioBtnRect, x, y)) {
      this.onAudioToggleClicked();
      return true;
    }
    return false;
  }

  private onPlayClicked(): void {
    // Unlock WebAudio context on user gesture
    eventBus.emit('audio:unlock', {});
    audioManager.playTap();

    const progress = saveManager.getProgress();
    const targetLevel = progress.currentLevel || progress.highestUnlocked || 1;

    eventBus.emit('level:start', { levelId: targetLevel, silentAudio: true });
    sceneManager.switchTo('gameplay', { levelId: targetLevel });
  }

  private onLevelSelectClicked(): void {
    eventBus.emit('audio:unlock', {});
    sceneManager.switchTo('levelSelect');
  }

  private onAudioToggleClicked(): void {
    eventBus.emit('audio:unlock', {});
    const current = saveManager.getSettings();
    const currentlyMuted = current.musicMuted && current.sfxMuted;
    const newMuted = !currentlyMuted;

    saveManager.updateSettings({
      musicMuted: newMuted,
      sfxMuted: newMuted,
    });
  }
}

export const titleScene = new TitleScene();
