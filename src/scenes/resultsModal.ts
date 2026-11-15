/* ─────────────────────────────────────────────────────────────
 *  resultsModal.ts – End-of-Level Results Modal Overlay
 *  Celebratory banner ("Splendid!", "Awesome!", "Super Job!"),
 *  staggered animated star bursts, accuracy percentage, confetti particles,
 *  and "Next Level ➔", "Replay ↺", "Level Select ☰" action buttons.
 * ───────────────────────────────────────────────────────────── */
import {
  COLORS,
  DIMENSIONS,
  MIN_TOUCH_TARGET,
  getFont,
} from '../ui/tokens';
import {
  drawButton,
  drawRoundedRect,
  drawStar,
  drawSparkle,
  isPointInButton,
  type ButtonOptions,
} from '../ui/components';
import { eventBus } from '../shared/eventBus';
import { saveManager } from '../game/saveManager';
import { sceneManager, type Scene } from '../core/sceneManager';
import { DESIGN_WIDTH, DESIGN_HEIGHT, TOTAL_LEVELS } from '../shared/constants';
import type { ScoringResult, SceneName } from '../shared/contracts';

interface ConfettiPiece {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  speedY: number;
  speedX: number;
  rotation: number;
  rotSpeed: number;
}

interface StarParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

export class ResultsModal implements Scene {
  public name: SceneName = 'results';
  private isVisible: boolean = false;
  private levelId: number = 1;
  private result: ScoringResult = {
    totalRegions: 1,
    correctRegions: 1,
    accuracy: 1,
    stars: 3,
  };

  private animTimer: number = 0; // ms
  private confetti: ConfettiPiece[] = [];
  private starParticles: StarParticle[] = [];
  private starPopped: [boolean, boolean, boolean] = [false, false, false];

  private pressedBtnId: string | null = null;

  // Layout rectangles
  private nextBtnRect = { x: 0, y: 0, w: 220, h: 64 };
  private replayBtnRect = { x: 0, y: 0, w: 140, h: 64 };
  private levelSelectBtnRect = { x: 0, y: 0, w: 140, h: 64 };

  constructor() {
    this.listenToEvents();
  }

  private listenToEvents(): void {
    // Automatically trigger modal when level:complete is fired
    eventBus.on('level:complete', ({ levelId, result }) => {
      this.show(levelId, result);
    });
  }

  public enter(params?: Record<string, unknown>): void {
    const scoring = (params?.scoring as ScoringResult) || {
      totalRegions: 1,
      correctRegions: 1,
      accuracy: 1,
      stars: 3,
    };
    const levelId = (params?.levelId as number) || saveManager.getProgress().currentLevel || 1;
    this.show(levelId, scoring);
  }

  public exit(): void {
    this.hide();
  }

  public onTap(x: number, y: number): void {
    this.handleTap(x, y);
  }

  public show(levelId: number, result: ScoringResult): void {
    this.isVisible = true;
    this.levelId = levelId;
    this.result = result;
    this.animTimer = 0;
    this.starPopped = [false, false, false];
    this.pressedBtnId = null;
    this.starParticles = [];

    // Ensure score is recorded in saveManager
    saveManager.recordLevelResult(levelId, result.stars, {});

    // Spawn celebratory confetti
    this.initConfetti();
  }

  public hide(): void {
    this.isVisible = false;
    this.pressedBtnId = null;
    this.confetti = [];
    this.starParticles = [];
  }

  public isOpen(): boolean {
    return this.isVisible;
  }

  private initConfetti(): void {
    const palette = [
      COLORS.candyPink,
      COLORS.sunnyYellow,
      COLORS.brightCyan,
      COLORS.mintGreen,
      COLORS.purpleJoy,
      COLORS.softOrange,
    ];

    this.confetti = [];
    for (let i = 0; i < 45; i++) {
      this.confetti.push({
        x: DESIGN_WIDTH * 0.2 + Math.random() * (DESIGN_WIDTH * 0.6),
        y: -20 - Math.random() * 200,
        w: 10 + Math.random() * 8,
        h: 6 + Math.random() * 6,
        color: palette[i % palette.length],
        speedY: 2 + Math.random() * 3.5,
        speedX: (Math.random() - 0.5) * 2,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
      });
    }
  }

  private spawnStarBurst(cx: number, cy: number): void {
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.2;
      const speed = 2.5 + Math.random() * 4;
      this.starParticles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 10 + Math.random() * 12,
        color: i % 2 === 0 ? COLORS.starGold : COLORS.creamWhite,
        life: 0,
        maxLife: 500 + Math.random() * 300,
      });
    }
  }

  public update(dt: number): void {
    if (!this.isVisible) return;

    this.animTimer += dt;

    // Check star pop timings
    // Star 1 at 300ms, Star 2 at 600ms, Star 3 at 900ms
    const starsToEarn = this.result.stars;

    if (!this.starPopped[0] && this.animTimer >= 300 && starsToEarn >= 1) {
      this.starPopped[0] = true;
    }
    if (!this.starPopped[1] && this.animTimer >= 600 && starsToEarn >= 2) {
      this.starPopped[1] = true;
    }
    if (!this.starPopped[2] && this.animTimer >= 900 && starsToEarn >= 3) {
      this.starPopped[2] = true;
    }

    // Update Confetti
    for (const c of this.confetti) {
      c.y += c.speedY * (dt / 16);
      c.x += c.speedX * (dt / 16);
      c.rotation += c.rotSpeed * (dt / 16);
      if (c.y > DESIGN_HEIGHT + 20) {
        c.y = -20;
        c.x = Math.random() * DESIGN_WIDTH;
      }
    }

    // Update Star Sparkles
    for (let i = this.starParticles.length - 1; i >= 0; i--) {
      const p = this.starParticles[i];
      p.life += dt;
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);
      p.vy += 0.08 * (dt / 16); // gentle gravity
      if (p.life >= p.maxLife) {
        this.starParticles.splice(i, 1);
      }
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number = DESIGN_WIDTH,
    height: number = DESIGN_HEIGHT
  ): void {
    if (!this.isVisible) return;

    const isPortrait = height > width;

    ctx.save();

    // 1. Semi-transparent Dark Plum / Purple Backdrop
    ctx.fillStyle = COLORS.modalBackdrop;
    ctx.fillRect(0, 0, width, height);

    // 2. Celebratory Confetti Flakes Falling
    this.renderConfetti(ctx);

    // 3. Central Modal Dialog Card with bounce entry
    const entryProgress = Math.min(1, this.animTimer / 280);
    // Elastic overshoot bounce
    const scale = this.easeOutBack(entryProgress);

    const dialogW = isPortrait ? Math.min(width - 40, 380) : 560;
    const dialogH = isPortrait ? 520 : 470;
    const dialogX = (width - dialogW) / 2;
    const dialogY = (height - dialogH) / 2;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-width / 2, -height / 2);

    // Dialog card shadow
    drawRoundedRect(
      ctx,
      dialogX,
      dialogY + 12,
      dialogW,
      dialogH,
      DIMENSIONS.borderRadiusLg,
      'rgba(0, 0, 0, 0.25)',
      undefined,
      0
    );

    // Dialog card face
    drawRoundedRect(
      ctx,
      dialogX,
      dialogY,
      dialogW,
      dialogH,
      DIMENSIONS.borderRadiusLg,
      COLORS.creamWhite,
      COLORS.outlineDark,
      DIMENSIONS.outlineWidthThick
    );

    // Header Banner ("Splendid!", "Awesome!", "Super Job!")
    this.renderBanner(ctx, dialogX, dialogY, dialogW, isPortrait);

    // 3 Animated Stars with Staggered Bounce & Shine
    this.renderStars(ctx, dialogX, dialogY, dialogW, isPortrait);

    // Accuracy Percentage Display
    this.renderAccuracy(ctx, dialogX, dialogY, dialogW, isPortrait);

    // Action Buttons ("Next Level ➔", "Replay ↺", "Level Select ☰")
    this.renderActionButtons(ctx, dialogX, dialogY, dialogW, dialogH, isPortrait);

    ctx.restore();

    // 4. Sparkle Particle Bursts on top
    this.renderStarParticles(ctx);

    ctx.restore();
  }

  private renderConfetti(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const c of this.confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
    ctx.restore();
  }

  private renderBanner(
    ctx: CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dw: number,
    isPortrait: boolean
  ): void {
    let bannerText = 'Awesome!';
    let bannerColor: string = COLORS.brightCyan;
    let bannerShadow: string = COLORS.brightCyanShadow;

    if (this.result.stars === 3 || this.result.accuracy >= 0.99) {
      bannerText = 'Splendid! 🎉';
      bannerColor = COLORS.candyPink;
      bannerShadow = COLORS.candyPinkShadow;
    } else if (this.result.stars === 2) {
      bannerText = 'Super Job! 🌟';
      bannerColor = COLORS.softOrange;
      bannerShadow = COLORS.softOrangeShadow;
    } else {
      bannerText = 'Great Try! 👍';
      bannerColor = COLORS.sunnyYellow;
      bannerShadow = COLORS.sunnyYellowShadow;
    }

    const bannerW = Math.min(dw - 60, isPortrait ? 300 : 380);
    const bannerH = 62;
    const bannerX = dx + (dw - bannerW) / 2;
    const bannerY = dy - bannerH / 2;

    // 3D Banner Pill
    drawRoundedRect(
      ctx,
      bannerX,
      bannerY + 6,
      bannerW,
      bannerH,
      DIMENSIONS.borderRadiusPill,
      bannerShadow,
      COLORS.outlineDark,
      4
    );

    drawRoundedRect(
      ctx,
      bannerX,
      bannerY,
      bannerW,
      bannerH,
      DIMENSIONS.borderRadiusPill,
      bannerColor,
      COLORS.outlineDark,
      4
    );

    // Banner Text
    ctx.save();
    ctx.font = getFont(isPortrait ? 26 : 32, 'extraBold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = COLORS.creamWhite;
    ctx.fillText(bannerText, bannerX + bannerW / 2, bannerY + bannerH / 2 + 1);
    ctx.restore();
  }

  private renderStars(
    ctx: CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dw: number,
    isPortrait: boolean
  ): void {
    const starAreaY = dy + (isPortrait ? 88 : 95);
    const starSpacing = isPortrait ? 74 : 95;
    const centerX = dx + dw / 2;
    const outerR = isPortrait ? 32 : 40;
    const innerR = outerR * 0.48;

    const starConfigs = [
      { delay: 300, earned: this.result.stars >= 1, x: centerX - starSpacing, y: starAreaY + 12 },
      { delay: 600, earned: this.result.stars >= 2, x: centerX, y: starAreaY - 8 },
      { delay: 900, earned: this.result.stars >= 3, x: centerX + starSpacing, y: starAreaY + 12 },
    ];

    for (let i = 0; i < 3; i++) {
      const cfg = starConfigs[i];
      ctx.save();

      let starScale = 1;
      let isFilled = false;
      let hasGlow = false;

      if (cfg.earned) {
        if (this.animTimer >= cfg.delay) {
          const t = Math.min(1, (this.animTimer - cfg.delay) / 250);
          starScale = this.easeOutBack(t);
          isFilled = true;
          hasGlow = true;

          // Spawn burst once when popped
          if (!this.starPopped[i]) {
            this.starPopped[i] = true;
            this.spawnStarBurst(cfg.x, cfg.y);
          }
        } else {
          // Hasn't popped yet: show empty star ready to pop
          isFilled = false;
        }
      } else {
        // Star not earned: inactive gray/lavender star
        isFilled = false;
      }

      ctx.translate(cfg.x, cfg.y);
      ctx.scale(starScale, starScale);
      drawStar(ctx, 0, 0, 5, outerR, innerR, isFilled, hasGlow);
      ctx.restore();
    }
  }

  private renderAccuracy(
    ctx: CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dw: number,
    isPortrait: boolean
  ): void {
    const startY = dy + (isPortrait ? 200 : 210);
    const centerX = dx + dw / 2;
    const pct = Math.round(this.result.accuracy * 100);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. Big Accuracy percentage text
    ctx.font = getFont(isPortrait ? 38 : 46, 'extraBold');

    // 3D outline & fill for percentage
    const matchText = `${pct}% Match!`;
    ctx.strokeStyle = COLORS.outlineDark;
    ctx.lineWidth = 6;
    ctx.strokeText(matchText, centerX, startY);

    ctx.fillStyle = pct >= 80 ? COLORS.mintGreen : pct >= 50 ? COLORS.sunnyYellow : COLORS.candyPink;
    ctx.fillText(matchText, centerX, startY);

    // 2. Subtitle detail
    ctx.font = getFont(isPortrait ? 18 : 22, 'bold');
    ctx.fillStyle = COLORS.darkPlum;
    const detailText =
      this.result.totalRegions > 0
        ? `${this.result.correctRegions} of ${this.result.totalRegions} shapes matched!`
        : `Level ${this.levelId} Completed!`;

    ctx.fillText(detailText, centerX, startY + 40);

    // 3. Mini encouraging tip for kids
    ctx.font = getFont(isPortrait ? 15 : 17, 'normal');
    ctx.fillStyle = '#6E6780';
    let tipText = 'Perfect coloring! Keep up the brilliant work!';
    if (this.result.stars === 2) {
      tipText = 'Almost perfect! Can you get all 3 stars?';
    } else {
      tipText = 'Good effort! Try again to earn more stars!';
    }
    ctx.fillText(tipText, centerX, startY + 68);

    ctx.restore();
  }

  private renderActionButtons(
    ctx: CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    isPortrait: boolean
  ): void {
    const centerX = dx + dw / 2;
    const hasNextLevel = this.levelId < TOTAL_LEVELS && this.result.stars > 0;

    if (isPortrait) {
      // Portrait layout: Next Level button on top, Replay and Level Select underneath
      const btnH = 62;
      const nextBtnW = dw - 48;
      const nextBtnX = dx + 24;
      const nextBtnY = dy + dh - 150;

      this.nextBtnRect = {
        x: nextBtnX,
        y: nextBtnY,
        w: nextBtnW,
        h: btnH,
      };

      if (hasNextLevel) {
        drawButton(ctx, {
          x: this.nextBtnRect.x,
          y: this.nextBtnRect.y,
          w: this.nextBtnRect.w,
          h: this.nextBtnRect.h,
          text: 'Next Level ➔',
          color: COLORS.mintGreen,
          shadowColor: COLORS.mintGreenShadow,
          textColor: COLORS.creamWhite,
          fontSize: 24,
          radius: DIMENSIONS.borderRadiusMd,
          shadowDepth: 6,
          isPressed: this.pressedBtnId === 'next',
        });
      }

      // Replay & Menu row
      const subRowY = dy + dh - 76;
      const subBtnW = (dw - 48 - 12) / 2;

      this.replayBtnRect = {
        x: dx + 24,
        y: subRowY,
        w: subBtnW,
        h: btnH - 6,
      };

      drawButton(ctx, {
        x: this.replayBtnRect.x,
        y: this.replayBtnRect.y,
        w: this.replayBtnRect.w,
        h: this.replayBtnRect.h,
        icon: 'replay',
        text: 'Replay',
        color: COLORS.softOrange,
        shadowColor: COLORS.softOrangeShadow,
        textColor: COLORS.creamWhite,
        fontSize: 18,
        radius: DIMENSIONS.borderRadiusMd,
        shadowDepth: 5,
        isPressed: this.pressedBtnId === 'replay',
      });

      this.levelSelectBtnRect = {
        x: dx + 24 + subBtnW + 12,
        y: subRowY,
        w: subBtnW,
        h: btnH - 6,
      };

      drawButton(ctx, {
        x: this.levelSelectBtnRect.x,
        y: this.levelSelectBtnRect.y,
        w: this.levelSelectBtnRect.w,
        h: this.levelSelectBtnRect.h,
        icon: 'menu',
        text: 'Levels',
        color: COLORS.brightCyan,
        shadowColor: COLORS.brightCyanShadow,
        textColor: COLORS.creamWhite,
        fontSize: 18,
        radius: DIMENSIONS.borderRadiusMd,
        shadowDepth: 5,
        isPressed: this.pressedBtnId === 'levelSelect',
      });
    } else {
      // Landscape layout: 3 buttons side-by-side or Next Level prominent
      const btnH = 64;
      const bottomY = dy + dh - 92;

      const subW = 145;
      const nextW = 205;
      const gap = 14;
      const totalButtonsW = nextW + subW * 2 + gap * 2;
      const startX = centerX - totalButtonsW / 2;

      // 1. Level Select ☰
      this.levelSelectBtnRect = {
        x: startX,
        y: bottomY,
        w: subW,
        h: btnH,
      };

      drawButton(ctx, {
        x: this.levelSelectBtnRect.x,
        y: this.levelSelectBtnRect.y,
        w: this.levelSelectBtnRect.w,
        h: this.levelSelectBtnRect.h,
        icon: 'menu',
        text: 'Levels',
        color: COLORS.brightCyan,
        shadowColor: COLORS.brightCyanShadow,
        textColor: COLORS.creamWhite,
        fontSize: 20,
        radius: DIMENSIONS.borderRadiusMd,
        shadowDepth: 6,
        isPressed: this.pressedBtnId === 'levelSelect',
      });

      // 2. Replay ↺
      this.replayBtnRect = {
        x: startX + subW + gap,
        y: bottomY,
        w: subW,
        h: btnH,
      };

      drawButton(ctx, {
        x: this.replayBtnRect.x,
        y: this.replayBtnRect.y,
        w: this.replayBtnRect.w,
        h: this.replayBtnRect.h,
        icon: 'replay',
        text: 'Replay',
        color: COLORS.softOrange,
        shadowColor: COLORS.softOrangeShadow,
        textColor: COLORS.creamWhite,
        fontSize: 20,
        radius: DIMENSIONS.borderRadiusMd,
        shadowDepth: 6,
        isPressed: this.pressedBtnId === 'replay',
      });

      // 3. Next Level ➔ (large prominent button)
      this.nextBtnRect = {
        x: startX + subW * 2 + gap * 2,
        y: bottomY,
        w: nextW,
        h: btnH,
      };

      drawButton(ctx, {
        x: this.nextBtnRect.x,
        y: this.nextBtnRect.y,
        w: this.nextBtnRect.w,
        h: this.nextBtnRect.h,
        text: 'Next Level ➔',
        color: hasNextLevel ? COLORS.mintGreen : COLORS.disabledBg,
        shadowColor: hasNextLevel ? COLORS.mintGreenShadow : COLORS.disabledShadow,
        textColor: hasNextLevel ? COLORS.creamWhite : COLORS.disabledText,
        isDisabled: !hasNextLevel,
        fontSize: 22,
        radius: DIMENSIONS.borderRadiusMd,
        shadowDepth: 6,
        isPressed: this.pressedBtnId === 'next',
      });
    }
  }

  private renderStarParticles(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const p of this.starParticles) {
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      drawSparkle(ctx, p.x, p.y, p.size, p.color, (p.life / 100) * 1.5);
    }
    ctx.restore();
  }

  private easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  public handlePointerDown(x: number, y: number): boolean {
    if (!this.isVisible) return false;

    if (isPointInButton(this.nextBtnRect, x, y) && this.levelId < TOTAL_LEVELS && this.result.stars > 0) {
      this.pressedBtnId = 'next';
      return true;
    }
    if (isPointInButton(this.replayBtnRect, x, y)) {
      this.pressedBtnId = 'replay';
      return true;
    }
    if (isPointInButton(this.levelSelectBtnRect, x, y)) {
      this.pressedBtnId = 'levelSelect';
      return true;
    }

    // Modal catches all pointer events while open to prevent background clicks
    return true;
  }

  public handlePointerUp(x: number, y: number): boolean {
    if (!this.isVisible) return false;

    const wasPressed = this.pressedBtnId;
    this.pressedBtnId = null;

    if (wasPressed === 'next' && isPointInButton(this.nextBtnRect, x, y)) {
      this.onNextClicked();
      return true;
    }
    if (wasPressed === 'replay' && isPointInButton(this.replayBtnRect, x, y)) {
      this.onReplayClicked();
      return true;
    }
    if (wasPressed === 'levelSelect' && isPointInButton(this.levelSelectBtnRect, x, y)) {
      this.onLevelSelectClicked();
      return true;
    }

    return true;
  }

  public handleTap(x: number, y: number): boolean {
    if (!this.isVisible) return false;

    if (isPointInButton(this.nextBtnRect, x, y) && this.levelId < TOTAL_LEVELS && this.result.stars > 0) {
      this.onNextClicked();
      return true;
    }
    if (isPointInButton(this.replayBtnRect, x, y)) {
      this.onReplayClicked();
      return true;
    }
    if (isPointInButton(this.levelSelectBtnRect, x, y)) {
      this.onLevelSelectClicked();
      return true;
    }

    // Swallows tap so game beneath doesn't react
    return true;
  }

  private onNextClicked(): void {
    const nextLevel = Math.min(TOTAL_LEVELS, this.levelId + 1);
    this.hide();
    eventBus.emit('audio:unlock', {});
    saveManager.setCurrentLevel(nextLevel);
    eventBus.emit('level:start', { levelId: nextLevel });
    sceneManager.switchTo('gameplay', { levelId: nextLevel });
  }

  private onReplayClicked(): void {
    this.hide();
    eventBus.emit('audio:unlock', {});
    eventBus.emit('level:start', { levelId: this.levelId });
    sceneManager.switchTo('gameplay', { levelId: this.levelId });
  }

  private onLevelSelectClicked(): void {
    this.hide();
    eventBus.emit('audio:unlock', {});
    sceneManager.switchTo('levelSelect');
  }
}

export const resultsModal = new ResultsModal();
