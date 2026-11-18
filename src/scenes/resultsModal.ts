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
  drawTicketCard,
  draw3DGoldenStar,
  drawGlossyBubbleButton,
  drawGlossyGreenButton,
  draw3DReplayButton,
  draw3DLevelsButton,
  isPointInButton,
  type ButtonOptions,
} from '../ui/components';
import { eventBus } from '../shared/eventBus';
import { saveManager } from '../game/saveManager';
import { sceneManager, type Scene } from '../core/sceneManager';
import { audioManager } from '../audio/audioManager';
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
  private viewportWidth: number = DESIGN_WIDTH;
  private viewportHeight: number = DESIGN_HEIGHT;

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
      COLORS.softOrange,
      COLORS.spruceVelvet,
      COLORS.starGold,
    ];

    this.confetti = [];
    // Full-screen celebratory confetti showering across full width & height
    const count = 90;
    for (let i = 0; i < count; i++) {
      this.confetti.push({
        x: Math.random() * this.viewportWidth,
        y: -30 - Math.random() * (this.viewportHeight * 0.7),
        w: 12 + Math.random() * 10,
        h: 8 + Math.random() * 8,
        color: palette[i % palette.length],
        speedY: 2.2 + Math.random() * 4.2,
        speedX: (Math.random() - 0.5) * 2.5,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.25,
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

    // Update Full-Screen Confetti
    for (const c of this.confetti) {
      c.y += c.speedY * (dt / 16);
      c.x += c.speedX * (dt / 16);
      c.rotation += c.rotSpeed * (dt / 16);
      if (c.y > this.viewportHeight + 30) {
        c.y = -30;
        c.x = Math.random() * this.viewportWidth;
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

    this.viewportWidth = width;
    this.viewportHeight = height;

    const isPortrait = height > width;

    ctx.save();

    // 1. Semi-transparent Spruce Velvet Backdrop
    ctx.fillStyle = COLORS.modalBackdrop;
    ctx.fillRect(0, 0, width, height);

    // 2. Full-Screen Celebratory Confetti Flakes Falling
    this.renderConfetti(ctx);

    // 3. Central Modal Dialog Card (enlarged for mobile portrait: 88%-90% width, 60%-68% height)
    const entryProgress = Math.min(1, this.animTimer / 280);
    // Elastic overshoot bounce
    const scale = this.easeOutBack(entryProgress);

    const dialogW = isPortrait ? Math.min(width - 48, 420) : 440;
    const dialogH = isPortrait ? Math.min(height - 80, 680) : Math.min(height - 60, 640);
    const dialogX = (width - dialogW) / 2;
    const dialogY = (height - dialogH) / 2;
    const dividerY = dialogY + dialogH - 188;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-width / 2, -height / 2);

    // Ticket Card Shadow (scalloped bottom edge & side bite notches)
    drawTicketCard(
      ctx,
      dialogX,
      dialogY + 12,
      dialogW,
      dialogH,
      28,
      'rgba(27, 69, 50, 0.22)',
      undefined,
      0,
      dividerY,
      18
    );

    // Ticket Card Face in Warm Clotted Cream (#FAF5EC) with rich dark outline (#1B4532) matching reference image
    drawTicketCard(
      ctx,
      dialogX,
      dialogY,
      dialogW,
      dialogH,
      28,
      '#FAF5EC',
      '#1B4532',
      3.5,
      dividerY,
      18
    );

    // Inner rounded panel framing the stars and score results (as shown in reference image)
    const innerPadX = 16;
    const innerTop = dialogY + 36;
    const innerBottom = dividerY - 14;
    const innerW = dialogW - innerPadX * 2;
    const innerH = innerBottom - innerTop;
    drawRoundedRect(
      ctx,
      dialogX + innerPadX,
      innerTop,
      innerW,
      innerH,
      20,
      '#F5EEDB', // soft warm beige panel matching reference image
      '#D8C6A5', // clean subtle border
      1.8
    );

    // Header: Top Curved Red Ribbon Banner ("Splendid! 🎉")
    this.renderBanner(ctx, dialogX, dialogY, dialogW, isPortrait);

    // 3D Golden Stars in Arched Layout (left and right tucked behind center star)
    this.renderStars(ctx, dialogX, dialogY, dialogW, isPortrait, innerTop, innerH);

    // 3D Heading Text ("100% Match!") & Two-Line Subtext filling the remaining inner panel
    this.renderAccuracy(ctx, dialogX, dialogY, dialogW, isPortrait, innerTop, innerH, innerW);

    // Dashed Divider & 3D Glossy Action Buttons
    this.renderActionButtons(ctx, dialogX, dialogY, dialogW, dialogH, isPortrait, dividerY);

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
    // Top Curved Red Ribbon / Banner overlapping the top border of the card
    const ribbonW = Math.min(dw - 36, isPortrait ? 300 : 330);
    const ribbonH = 60;
    const rx = dx + (dw - ribbonW) / 2;
    const ry = dy - 26;
    const tailW = 26;
    const tailH = 46;
    const archH = 10; // gentle upward arc

    ctx.save();

    // 1. Folded Ribbon Tails in crimson with fish-tail notch
    // Left Tail
    ctx.beginPath();
    ctx.moveTo(rx + 6, ry + 16);
    ctx.lineTo(rx - tailW, ry + 10);
    ctx.lineTo(rx - tailW + 10, ry + 10 + tailH / 2); // fish-tail notch
    ctx.lineTo(rx - tailW, ry + 10 + tailH);
    ctx.lineTo(rx + 6, ry + 10 + tailH - 4);
    ctx.closePath();
    ctx.fillStyle = '#E63946';
    ctx.fill();
    ctx.strokeStyle = '#1B4532';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Left dark fold shadow
    ctx.beginPath();
    ctx.moveTo(rx, ry + 14);
    ctx.lineTo(rx + 8, ry + 16);
    ctx.lineTo(rx, ry + ribbonH + 4);
    ctx.closePath();
    ctx.fillStyle = '#6A040F';
    ctx.fill();

    // Right Tail
    ctx.beginPath();
    ctx.moveTo(rx + ribbonW - 6, ry + 16);
    ctx.lineTo(rx + ribbonW + tailW, ry + 10);
    ctx.lineTo(rx + ribbonW + tailW - 10, ry + 10 + tailH / 2); // fish-tail notch
    ctx.lineTo(rx + ribbonW + tailW, ry + 10 + tailH);
    ctx.lineTo(rx + ribbonW - 6, ry + 10 + tailH - 4);
    ctx.closePath();
    ctx.fillStyle = '#E63946';
    ctx.fill();
    ctx.strokeStyle = '#1B4532';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Right dark fold shadow
    ctx.beginPath();
    ctx.moveTo(rx + ribbonW, ry + 14);
    ctx.lineTo(rx + ribbonW - 8, ry + 16);
    ctx.lineTo(rx + ribbonW, ry + ribbonH + 4);
    ctx.closePath();
    ctx.fillStyle = '#6A040F';
    ctx.fill();

    // 2. Main curved red banner body with 3D bottom bevel
    const buildBannerPath = () => {
      ctx.beginPath();
      ctx.moveTo(rx, ry + archH + 6);
      ctx.quadraticCurveTo(rx + 4, ry + archH, rx + 16, ry + archH - 3);
      ctx.quadraticCurveTo(rx + ribbonW / 2, ry - archH, rx + ribbonW - 16, ry + archH - 3);
      ctx.quadraticCurveTo(rx + ribbonW - 4, ry + archH, rx + ribbonW, ry + archH + 6);
      ctx.lineTo(rx + ribbonW, ry + ribbonH + 2);
      ctx.quadraticCurveTo(rx + ribbonW - 16, ry + ribbonH - 3, rx + ribbonW / 2, ry + ribbonH - archH);
      ctx.quadraticCurveTo(rx + 16, ry + ribbonH - 3, rx, ry + ribbonH + 2);
      ctx.closePath();
    };

    // Bottom 3D bevel shadow
    ctx.save();
    ctx.translate(0, 5);
    ctx.fillStyle = '#A4161A';
    buildBannerPath();
    ctx.fill();
    ctx.restore();

    // Vibrant red gradient face
    const redGrad = ctx.createLinearGradient(rx, ry, rx, ry + ribbonH);
    redGrad.addColorStop(0, '#FF5964');
    redGrad.addColorStop(0.3, '#E63946');
    redGrad.addColorStop(1, '#C9184A');

    ctx.fillStyle = redGrad;
    buildBannerPath();
    ctx.fill();

    ctx.strokeStyle = '#1B4532';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    buildBannerPath();
    ctx.stroke();

    // Top Specular Gloss Highlight
    ctx.save();
    buildBannerPath();
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(rx + ribbonW / 2, ry + 10, ribbonW * 0.42, 8, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(rx + ribbonW / 2, ry + 10, 10, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();

    // Banner Text: 'Splendid! 🎉'
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = getFont(isPortrait ? 28 : 30, 'extraBold');

    // Text drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillText('Splendid! 🎉', rx + ribbonW / 2, ry + ribbonH / 2 + 1);

    // Text white face
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Splendid! 🎉', rx + ribbonW / 2, ry + ribbonH / 2 - 1);
    ctx.restore();
  }

  private renderStars(
    ctx: CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dw: number,
    isPortrait: boolean,
    innerTop: number,
    innerH: number
  ): void {
    const starAreaY = innerTop + Math.round(innerH * 0.22);
    const centerX = dx + dw / 2;
    const sideR = isPortrait ? 40 : 36;
    const centerR = Math.round(sideR * 1.38); // ~55px

    // Symmetrical arched star placement matching image:
    // Left star (-14 deg), Right star (+14 deg), Center star (0 deg, in front!)
    const sideSpacing = isPortrait ? 78 : 72;
    const starConfigs = [
      { delay: 300, earned: this.result.stars >= 1, x: centerX - sideSpacing, y: starAreaY + 16, r: sideR, rot: -14 * Math.PI / 180, idx: 0 },
      { delay: 900, earned: this.result.stars >= 3, x: centerX + sideSpacing, y: starAreaY + 16, r: sideR, rot: 14 * Math.PI / 180, idx: 2 },
      { delay: 600, earned: this.result.stars >= 2, x: centerX, y: starAreaY - 10, r: centerR, rot: 0, idx: 1 },
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
          if (!this.starPopped[cfg.idx]) {
            this.starPopped[cfg.idx] = true;
            this.spawnStarBurst(cfg.x, cfg.y);
          }
        } else {
          isFilled = false;
        }
      } else {
        isFilled = false;
      }

      ctx.translate(cfg.x, cfg.y);
      ctx.scale(starScale, starScale);
      ctx.rotate(cfg.rot);
      draw3DGoldenStar(ctx, 0, 0, cfg.r, isFilled, hasGlow);
      ctx.restore();
    }
  }

  private renderAccuracy(
    ctx: CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dw: number,
    isPortrait: boolean,
    innerTop: number,
    innerH: number,
    innerW: number
  ): void {
    const centerX = dx + dw / 2;
    const pct = Math.round(this.result.accuracy * 100);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. 3D Heading Text ('100% Match!'): Bubbly 3D green text filling the inner container width
    const headingY = innerTop + Math.round(innerH * 0.49);
    const headingSize = isPortrait
      ? Math.min(56, Math.floor(innerW / 7.2))
      : Math.min(50, Math.floor(innerW / 7.5));
    ctx.font = getFont(headingSize, 'extraBold');
    const matchText = `${pct}% Match!`;

    // 3D bottom extrusion shadow
    ctx.fillStyle = '#0F5132';
    for (let offset = 1; offset <= 6; offset++) {
      ctx.fillText(matchText, centerX, headingY + offset);
    }

    // Thick dark green outline (#1B4532)
    ctx.strokeStyle = '#1B4532';
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.strokeText(matchText, centerX, headingY);

    // Bright green 3D face gradient
    const greenGrad = ctx.createLinearGradient(centerX, headingY - 26, centerX, headingY + 26);
    greenGrad.addColorStop(0, '#55EFC4');
    greenGrad.addColorStop(0.35, '#2ECC71');
    greenGrad.addColorStop(1, '#27AE60');
    ctx.fillStyle = greenGrad;
    ctx.fillText(matchText, centerX, headingY);

    // 2. Subtitle detail ('3 of 3 shapes matched!') bold and prominent directly below heading
    const subtitleY = innerTop + Math.round(innerH * 0.65);
    const subtitleSize = isPortrait ? 24 : 22;
    ctx.font = getFont(subtitleSize, 'extraBold');
    ctx.fillStyle = '#1B4532';
    const detailText =
      this.result.totalRegions > 0
        ? `${this.result.correctRegions} of ${this.result.totalRegions} shapes matched!`
        : `Level ${this.levelId} Completed!`;
    ctx.fillText(detailText, centerX, subtitleY);

    // 3. Subtext split across two centered lines filling down toward the bottom of the beige box
    const starsEarned = this.result.stars;
    let line1: string;
    let line2: string;

    if (starsEarned === 3) {
      line1 = 'Great! You have achieved all the stars,';
      line2 = 'move to the next level!';
    } else {
      line1 = 'Good effort!';
      line2 = 'Try again to earn more stars!';
    }

    const subtextSize = isPortrait ? 21 : 19;
    ctx.font = getFont(subtextSize, 'bold');
    ctx.fillStyle = '#2C2C2E';
    const line1Y = innerTop + Math.round(innerH * 0.79);
    const line2Y = innerTop + Math.round(innerH * 0.88);
    ctx.fillText(line1, centerX, line1Y);
    ctx.fillText(line2, centerX, line2Y);

    ctx.restore();
  }

  private renderActionButtons(
    ctx: CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    isPortrait: boolean,
    dividerY: number
  ): void {
    const hasNextLevel = this.levelId < TOTAL_LEVELS && this.result.stars > 0;

    // 1. Dashed horizontal divider line connecting across the bite notches
    ctx.save();
    if (typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([10, 8]);
    }
    ctx.strokeStyle = '#D0C2A8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(dx + 18, dividerY);
    ctx.lineTo(dx + dw - 18, dividerY);
    ctx.stroke();
    ctx.restore();

    // 2. Next Level Button: Wide full-width pill button directly below dashed line
    const nextBtnW = dw - 48;
    const nextBtnH = isPortrait ? 60 : 56;
    const nextBtnX = dx + 24;
    const nextBtnY = dividerY + 16;

    this.nextBtnRect = {
      x: nextBtnX,
      y: nextBtnY,
      w: nextBtnW,
      h: nextBtnH,
    };

    if (hasNextLevel) {
      drawGlossyGreenButton(ctx, {
        x: this.nextBtnRect.x,
        y: this.nextBtnRect.y,
        w: this.nextBtnRect.w,
        h: this.nextBtnRect.h,
        text: 'Next Level ➔',
        fontSize: isPortrait ? 25 : 23,
        radius: Math.round(nextBtnH / 2),
        isPressed: this.pressedBtnId === 'next',
      });
    }

    // Side-by-side Replay & Levels buttons below Next Level
    const subRowY = nextBtnY + nextBtnH + 12;
    const subBtnW = (dw - 48 - 14) / 2;
    const subBtnH = isPortrait ? 54 : 50;

    this.replayBtnRect = {
      x: dx + 24,
      y: subRowY,
      w: subBtnW,
      h: subBtnH,
    };

    draw3DReplayButton(ctx, {
      x: this.replayBtnRect.x,
      y: this.replayBtnRect.y,
      w: this.replayBtnRect.w,
      h: this.replayBtnRect.h,
      fontSize: isPortrait ? 21 : 19,
      radius: Math.round(subBtnH / 2),
      isPressed: this.pressedBtnId === 'replay',
    });

    this.levelSelectBtnRect = {
      x: dx + 24 + subBtnW + 14,
      y: subRowY,
      w: subBtnW,
      h: subBtnH,
    };

    draw3DLevelsButton(ctx, {
      x: this.levelSelectBtnRect.x,
      y: this.levelSelectBtnRect.y,
      w: this.levelSelectBtnRect.w,
      h: this.levelSelectBtnRect.h,
      fontSize: isPortrait ? 21 : 19,
      radius: Math.round(subBtnH / 2),
      isPressed: this.pressedBtnId === 'levelSelect',
    });
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
    audioManager.stopCelebration();
    // Haptic feedback instead of sound (avoids rough audio glitch)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
    eventBus.emit('audio:unlock', {});
    saveManager.setCurrentLevel(nextLevel);
    eventBus.emit('level:start', { levelId: nextLevel, silentAudio: true });
    sceneManager.switchTo('gameplay', { levelId: nextLevel });
  }

  private onReplayClicked(): void {
    this.hide();
    audioManager.stopCelebration();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
    eventBus.emit('audio:unlock', {});
    eventBus.emit('level:start', { levelId: this.levelId });
    sceneManager.switchTo('gameplay', { levelId: this.levelId });
  }

  private onLevelSelectClicked(): void {
    this.hide();
    audioManager.stopCelebration();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
    eventBus.emit('audio:unlock', {});
    sceneManager.switchTo('levelSelect');
  }
}

export const resultsModal = new ResultsModal();
