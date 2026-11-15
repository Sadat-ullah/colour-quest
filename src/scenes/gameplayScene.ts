/* ─────────────────────────────────────────────────────────────
 *  gameplayScene.ts – Core Interactive Colouring Scene
 *  Responsive layout for Mobile Portrait (720x1280), Tablet, and Desktop (1280x720)
 *  Enforces 80% Clotted Cream (#EEE2CB) & 20% Spruce Velvet (#1B4532) theme.
 *  Features dynamic auto-fit shape scaling (80%-85%), an overlapping pill toolbar,
 *  full-space tight color grid, and single-use interactive hint mechanics.
 * ───────────────────────────────────────────────────────────── */
import type { Scene } from '../core/sceneManager';
import { sceneManager } from '../core/sceneManager';
import { ShapeRenderer } from '../core/shapeRenderer';
import { coloringEngine } from '../game/coloringEngine';
import { saveManager } from '../game/saveManager';
import { audioManager } from '../audio/audioManager';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../shared/constants';
import type { LevelData } from '../shared/contracts';
import { COLORS, getFont } from '../ui/tokens';
import { drawGlossyGreenButton, drawVolumeButton } from '../ui/components';

export class GameplayScene implements Scene {
  public name = 'gameplay' as const;

  // Dynamic layout bounds (updated per-frame according to active viewport)
  private templateBounds = { x: 360, y: 110, w: 480, h: 480 };
  private referenceBounds = { x: 960, y: 100, w: 240, h: 240 };
  private paletteArea = { x: 80, y: 120, w: 220, h: 520 };
  private pillToolbarBounds = { x: 200, y: 560, w: 400, h: 64 };
  private infoCardBounds = { x: 20, y: 84, w: 280, h: 180 };

  // Computed dynamic shape transformations for auto-fit scaling (80%-85%)
  private templateTransform = { offsetX: 0, offsetY: 0, scale: 1 };
  private referenceTransform = { offsetX: 0, offsetY: 0, scale: 1 };

  // Color swatches clickable bounds
  private swatchRects: Array<{ color: string; x: number; y: number; w: number; h: number }> = [];

  // Buttons bounds
  private buttons = {
    back: { x: 40, y: 24, w: 110, h: 54, label: '◀ Levels' },
    sound: { x: 1140, y: 24, w: 60, h: 54, label: '🔊' },
    undo: { x: 440, y: 620, w: 120, h: 50, label: '↩ Undo' },
    reset: { x: 590, y: 620, w: 120, h: 50, label: '🔄 Clear' },
    hint: { x: 740, y: 620, w: 120, h: 50, label: '💡 Hint' },
  };

  // Animation states
  private pulseTimer = 0;
  private completionTimer = 0;
  private isCompleting = false;
  private activeFillAnims = new Map<string, { timer: number; duration: number; color: string }>();

  // Gentle feedback toast
  private toastMessage: string | null = null;
  private toastTimer = 0;

  // External hooks (audio / particles / levels)
  public onPlaySound?: (sound: string) => void;
  public onSpawnSparkles?: (x: number, y: number, color: string) => void;
  public onGetLevel?: (id: number) => LevelData | undefined;

  public enter(params?: Record<string, unknown>): void {
    this.isCompleting = false;
    this.completionTimer = 0;
    this.toastMessage = null;
    this.toastTimer = 0;
    this.activeFillAnims.clear();

    const levelId = (params?.levelId as number) || saveManager.getProgress().currentLevel || 1;
    if (this.onGetLevel) {
      const level = this.onGetLevel(levelId);
      if (level) {
        coloringEngine.loadLevel(level);
        saveManager.setCurrentLevel(levelId);
      }
    }
  }

  public exit(): void {
    this.isCompleting = false;
    this.toastMessage = null;
    this.toastTimer = 0;
    this.activeFillAnims.clear();
  }

  public showToast(msg: string, durationMs: number = 2200): void {
    this.toastMessage = msg;
    this.toastTimer = durationMs;
  }

  public update(dt: number): void {
    this.pulseTimer += dt;

    // Update active fill impact animations
    for (const [regionId, anim] of this.activeFillAnims.entries()) {
      anim.timer += dt;
      if (anim.timer >= anim.duration) {
        this.activeFillAnims.delete(regionId);
      }
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toastMessage = null;
      }
    }

    if (this.isCompleting) {
      this.completionTimer += dt;
      if (this.completionTimer > 800) {
        this.isCompleting = false;
        const scoring = coloringEngine.calculateScoring();
        const level = coloringEngine.getLevel();

        if (level) {
          const colorsObj: Record<string, string> = {};
          coloringEngine.getFilledColors().forEach((val, key) => {
            colorsObj[key] = val;
          });
          saveManager.recordLevelResult(level.id, scoring.stars, colorsObj);
        }

        sceneManager.switchTo('results', {
          scoring,
          levelId: level?.id ?? 1,
        });
      }
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number = DESIGN_WIDTH,
    height: number = DESIGN_HEIGHT
  ): void {
    const level = coloringEngine.getLevel();
    if (!level) return;

    const isPortrait = height > width;

    // 1. Calculate responsive layout coordinates & auto-fit bounding box transforms
    this.calculateLayout(width, height, isPortrait, level);

    // 2. Warm Clotted Cream Background (80% Dominant Surface)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#FAF5EB');
    bgGrad.addColorStop(0.5, '#EEE2CB');
    bgGrad.addColorStop(1, '#E4D6BC');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 3. Render Header HUD (Dedicated Top AppBar)
    this.renderHeader(ctx, level, width, isPortrait);

    // 4. Render Top-Right 'TARGET' Container
    this.renderReference(ctx, level);

    // 5. In Portrait: Render Left Info / Goal Badge Card
    if (isPortrait) {
      this.renderInfoCard(ctx, level);
    }

    // 6. Render Main Middle Container with 80%-85% Auto-Fit Blank Template
    this.renderTemplate(ctx, level);

    // 7. Render Bottom Full-Space Tight Color Grid (or Left side in landscape)
    this.renderPalette(ctx, level, isPortrait);

    // 8. Render Floating Pill Toolbar (Undo, Clear, Hint) ON TOP of both containers!
    this.renderPillToolbar(ctx);

    // 9. Render Toast Notification if active
    this.renderToast(ctx, width, height);
  }

  private calculateLayout(
    width: number,
    height: number,
    isPortrait: boolean,
    level: LevelData
  ): void {
    const bBox = ShapeRenderer.calculateBoundingBox(level.regions);

    if (isPortrait) {
      // ── Mobile Portrait Layout: 100% Full-Screen Vertical Stack ──
      // 1. Top AppBar (y: 12, h: 58)
      const topBarY = 12;
      const topBarH = 58;
      this.buttons.back = { x: 20, y: topBarY, w: 120, h: topBarH, label: '◀ Levels' };
      this.buttons.sound = { x: width - 20 - 58, y: topBarY, w: 58, h: topBarH, label: '🔊' };

      // 2. Row 2 (y: 80 to 280): Enlarged Target Reference Card (right) + Goal Info Card (left)
      const row2Y = 80;
      const refW = Math.min(236, Math.round(width * 0.32));
      const refH = 200;
      this.referenceBounds = {
        x: width - 20 - refW,
        y: row2Y,
        w: refW,
        h: refH,
      };

      this.infoCardBounds = {
        x: 20,
        y: row2Y,
        w: width - refW - 48,
        h: refH,
      };

      // Auto-fit calculation for TARGET Container (fills 86%-90% of enlarged TARGET box)
      const refBadgeH = 28;
      const refAvailW = (this.referenceBounds.w - 18) * 0.88;
      const refAvailH = (this.referenceBounds.h - refBadgeH - 14) * 0.88;
      const refScale = Math.min(refAvailW / bBox.width, refAvailH / bBox.height);
      this.referenceTransform = {
        scale: refScale,
        offsetX:
          this.referenceBounds.x +
          (this.referenceBounds.w - bBox.width * refScale) / 2 -
          bBox.minX * refScale,
        offsetY:
          this.referenceBounds.y +
          refBadgeH +
          (this.referenceBounds.h - refBadgeH - bBox.height * refScale) / 2 -
          bBox.minY * refScale,
      };

      // 3. Bottom Color Container (Full-Space Tight Grid)
      const marginSide = 20;
      const marginBottom = 22;
      const bottomZoneH = Math.round(height * 0.22);
      const bottomTop = height - bottomZoneH - marginBottom;

      this.paletteArea = {
        x: marginSide,
        y: bottomTop,
        w: width - marginSide * 2,
        h: bottomZoneH,
      };

      // 4. Main Middle Container
      const centerTop = row2Y + refH + 16;
      const centerBottom = bottomTop - 28;
      const centerH = centerBottom - centerTop;
      const centerW = width - 40;

      this.templateBounds = {
        x: 20,
        y: centerTop,
        w: centerW,
        h: centerH,
      };

      // 5. Floating Pill Toolbar: Horizontally centered & floating between containers
      const pillW = Math.min(width - 40, 440);
      const pillH = 64;
      const pillX = Math.round((width - pillW) / 2);
      // Move toolbar slightly upwards so it bridges the bottom of the middle container without obscuring the palette text
      const pillY = Math.round(centerBottom - pillH / 2 - 6);

      this.pillToolbarBounds = {
        x: pillX,
        y: pillY,
        w: pillW,
        h: pillH,
      };

      // 3 Buttons inside Pill Toolbar
      const btnGap = 8;
      const pillPad = 10;
      const btnW = Math.floor((pillW - pillPad * 2 - btnGap * 2) / 3);
      const btnH = 50;
      const btnY = pillY + Math.round((pillH - btnH) / 2);

      this.buttons.undo = { x: pillX + pillPad, y: btnY, w: btnW, h: btnH, label: '↩ Undo' };
      this.buttons.reset = { x: pillX + pillPad + btnW + btnGap, y: btnY, w: btnW, h: btnH, label: '🔄 Clear' };
      this.buttons.hint = { x: pillX + pillPad + (btnW + btnGap) * 2, y: btnY, w: btnW, h: btnH, label: '💡 Hint' };

      // Auto-fit calculation for Middle Container (fills 80%-85% with clearance for toolbar)
      const topClearance = 16;
      const bottomClearance = pillH + 12;
      const tmplAvailW = (centerW - 32) * 0.84;
      const tmplAvailH = (centerH - topClearance - bottomClearance) * 0.84;
      const tmplScale = Math.min(tmplAvailW / bBox.width, tmplAvailH / bBox.height);

      this.templateTransform = {
        scale: tmplScale,
        offsetX:
          this.templateBounds.x +
          (this.templateBounds.w - bBox.width * tmplScale) / 2 -
          bBox.minX * tmplScale,
        offsetY:
          this.templateBounds.y +
          topClearance +
          (centerH - topClearance - bottomClearance - bBox.height * tmplScale) / 2 -
          bBox.minY * tmplScale,
      };
    } else {
      // ── Desktop / Laptop Landscape Layout: 1280x720 ──
      this.buttons.back = { x: 36, y: 18, w: 126, h: 56, label: '◀ Levels' };
      this.buttons.sound = { x: width - 86, y: 18, w: 62, h: 56, label: '🔊' };

      // Left Side Palette (Full-Space Tight Vertical Grid)
      this.paletteArea = {
        x: 34,
        y: 88,
        w: 256,
        h: height - 108,
      };

      // Main Middle Container
      const centerW = 580;
      const centerH = height - 150;
      const centerX = 312;
      const centerY = 88;

      this.templateBounds = {
        x: centerX,
        y: centerY,
        w: centerW,
        h: centerH,
      };

      // Floating Pill Toolbar between middle container and bottom edge
      const pillW = 400;
      const pillH = 64;
      const pillX = centerX + Math.round((centerW - pillW) / 2);
      const pillY = Math.round(centerY + centerH - pillH / 2);

      this.pillToolbarBounds = {
        x: pillX,
        y: pillY,
        w: pillW,
        h: pillH,
      };

      const btnGap = 8;
      const pillPad = 8;
      const btnW = Math.floor((pillW - pillPad * 2 - btnGap * 2) / 3);
      const btnH = 48;
      const btnY = pillY + Math.round((pillH - btnH) / 2);

      this.buttons.undo = { x: pillX + pillPad, y: btnY, w: btnW, h: btnH, label: '↩ Undo' };
      this.buttons.reset = { x: pillX + pillPad + btnW + btnGap, y: btnY, w: btnW, h: btnH, label: '🔄 Clear' };
      this.buttons.hint = { x: pillX + pillPad + (btnW + btnGap) * 2, y: btnY, w: btnW, h: btnH, label: '💡 Hint' };

      // Auto-fit calculation for Middle Container in Landscape (80%-85%)
      const topClearance = 16;
      const bottomClearance = pillH / 2 + 12;
      const tmplAvailW = (centerW - 32) * 0.84;
      const tmplAvailH = (centerH - topClearance - bottomClearance) * 0.84;
      const tmplScale = Math.min(tmplAvailW / bBox.width, tmplAvailH / bBox.height);

      this.templateTransform = {
        scale: tmplScale,
        offsetX:
          centerX + (centerW - bBox.width * tmplScale) / 2 - bBox.minX * tmplScale,
        offsetY:
          centerY +
          topClearance +
          (centerH - topClearance - bottomClearance - bBox.height * tmplScale) / 2 -
          bBox.minY * tmplScale,
      };

      // Top-Right TARGET Container (Enlarged card)
      const refW = width - (centerX + centerW) - 44;
      const refH = 285;
      this.referenceBounds = {
        x: centerX + centerW + 22,
        y: 88,
        w: refW,
        h: refH,
      };

      const refBadgeH = 28;
      const refAvailW = (refW - 24) * 0.88;
      const refAvailH = (refH - refBadgeH - 20) * 0.88;
      const refScale = Math.min(refAvailW / bBox.width, refAvailH / bBox.height);

      this.referenceTransform = {
        scale: refScale,
        offsetX:
          this.referenceBounds.x +
          (this.referenceBounds.w - bBox.width * refScale) / 2 -
          bBox.minX * refScale,
        offsetY:
          this.referenceBounds.y +
          refBadgeH +
          (this.referenceBounds.h - refBadgeH - bBox.height * refScale) / 2 -
          bBox.minY * refScale,
      };
    }
  }

  private renderHeader(
    ctx: CanvasRenderingContext2D,
    level: LevelData,
    width: number,
    isPortrait: boolean
  ): void {
    const settings = saveManager.getSettings();
    const isMuted = !!(settings.sfxMuted && settings.musicMuted);

    if (isPortrait) {
      // Top AppBar Backdrop
      ctx.save();
      ctx.fillStyle = '#FAF5EC';
      ctx.fillRect(0, 0, width, 76);
      ctx.strokeStyle = 'rgba(27, 69, 50, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 76);
      ctx.lineTo(width, 76);
      ctx.stroke();
      ctx.restore();

      // Back button on left with green gradient
      drawGlossyGreenButton(ctx, {
        x: this.buttons.back.x,
        y: this.buttons.back.y,
        w: this.buttons.back.w,
        h: this.buttons.back.h,
        text: this.buttons.back.label,
        fontSize: 18,
        radius: 18,
      });

      // Sound toggle on right with green gradient and slash when muted
      drawVolumeButton(ctx, {
        x: this.buttons.sound.x,
        y: this.buttons.sound.y,
        w: this.buttons.sound.w,
        h: this.buttons.sound.h,
        isMuted,
        radius: 16,
      });

      // Level Title: increased font size (+30%), bold Spruce Velvet #1B4532, strictly centered
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.spruceVelvet;
      ctx.font = getFont(29, 'extraBold');

      const titleText = `Lv.${level.id}: ${level.name}`;
      const maxTitleW = width - this.buttons.back.w - this.buttons.sound.w - 56;
      if (ctx.measureText(titleText).width > maxTitleW) {
        ctx.font = getFont(24, 'extraBold');
      }
      ctx.fillText(titleText, width / 2, 42);
      ctx.restore();
    } else {
      // Landscape Top Bar
      drawGlossyGreenButton(ctx, {
        x: this.buttons.back.x,
        y: this.buttons.back.y,
        w: this.buttons.back.w,
        h: this.buttons.back.h,
        text: this.buttons.back.label,
        fontSize: 19,
        radius: 18,
      });

      drawVolumeButton(ctx, {
        x: this.buttons.sound.x,
        y: this.buttons.sound.y,
        w: this.buttons.sound.w,
        h: this.buttons.sound.h,
        isMuted,
        radius: 16,
      });

      // Center title (+30% larger, bold Spruce Velvet)
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = getFont(32, 'extraBold');
      ctx.fillStyle = COLORS.spruceVelvet;
      ctx.fillText(`Level ${level.id}: ${level.name}`, width / 2, 46);
      ctx.restore();
    }
  }

  private renderInfoCard(ctx: CanvasRenderingContext2D, level: LevelData): void {
    const { x, y, w, h } = this.infoCardBounds;

    // Card background in warm cream with Spruce Velvet border
    this.drawRoundedRect(ctx, x, y, w, h, 20, COLORS.clottedCreamCard, COLORS.spruceVelvet, 3.5);

    const filledCount = coloringEngine.getFilledColors().size;
    const totalCount = level.regions.length;

    ctx.save();
    ctx.textAlign = 'center';

    // 1. Category Pill Badge - Increased font size
    const categoryName = level.category.toUpperCase().replace('_', ' ');
    ctx.font = getFont(16, 'extraBold');
    ctx.fillStyle = COLORS.spruceVelvet;
    ctx.fillText(`CATEGORY: ${categoryName}`, x + w / 2, y + 42);

    // 2. Goal prompt - Increased font size
    ctx.font = getFont(22, 'extraBold');
    ctx.fillStyle = COLORS.spruceVelvet;
    ctx.fillText('🎯 Match Target!', x + w / 2, y + 96);

    // 3. Progress counter - Increased font size
    ctx.font = getFont(18, 'bold');
    ctx.fillStyle = COLORS.spruceVelvetMuted;
    ctx.fillText(`${filledCount} / ${totalCount} shapes coloured`, x + w / 2, y + 148);

    ctx.restore();
  }

  private renderTemplate(ctx: CanvasRenderingContext2D, level: LevelData): void {
    const { x, y, w, h } = this.templateBounds;

    // Main Middle Container Card Face in Clotted Cream light with Spruce Velvet border
    this.drawRoundedRect(ctx, x, y, w, h, 28, COLORS.clottedCreamLight, COLORS.spruceVelvet, 4);

    const { offsetX, offsetY, scale } = this.templateTransform;
    const selectedRegionId = coloringEngine.getSelectedRegionId();
    const filledColors = coloringEngine.getFilledColors();

    const pulseFactor = (Math.sin(this.pulseTimer * 0.008) + 1) / 2;
    const dynamicGlowBlur = 12 + pulseFactor * 14;      // oscillates 12px to 26px
    const dynamicStrokeWidth = 4.5 + pulseFactor * 2.0; // oscillates 4.5px to 6.5px

    // Render all blank template layers, dynamically scaled/centered to 80%-85%
    for (const region of level.regions) {
      const isSelected = selectedRegionId === region.id;
      const filledColor = filledColors.get(region.id) || '#FFFFFF';

      let pulseScale = isSelected ? 1 + pulseFactor * 0.03 : 1.0;
      let glowBlur = dynamicGlowBlur;
      let strokeWidth = isSelected ? dynamicStrokeWidth : 3;
      let isGlow = isSelected;
      let isHighlighted = isSelected;

      // Fill Impact Animation (scale-pop 1.0 -> 1.10 -> 1.0 and glow flash over 250ms)
      const fillAnim = this.activeFillAnims.get(region.id);
      if (fillAnim) {
        const progress = Math.min(1, fillAnim.timer / fillAnim.duration);
        const popScale = 1 + Math.sin(progress * Math.PI) * 0.10;
        pulseScale = Math.max(pulseScale, popScale);
        const flashIntensity = Math.sin(progress * Math.PI);
        glowBlur = Math.max(glowBlur, 16 + flashIntensity * 20);
        isGlow = true;
      }

      ShapeRenderer.drawRegion(ctx, region, {
        offsetX,
        offsetY,
        scale,
        fillColor: filledColor,
        strokeColor: isSelected ? COLORS.spruceVelvet : COLORS.spruceVelvetMuted,
        strokeWidth,
        isHighlighted,
        highlightColor: COLORS.spruceVelvet,
        glow: isGlow,
        glowBlur,
        pulseScale,
      });
    }
  }

  private renderReference(ctx: CanvasRenderingContext2D, level: LevelData): void {
    const { x, y, w, h } = this.referenceBounds;

    // Enlarged TARGET Container Card Background
    this.drawRoundedRect(ctx, x, y, w, h, 20, COLORS.clottedCreamCard, COLORS.spruceVelvet, 3.5);

    // Header badge
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = getFont(14, 'extraBold');
    ctx.fillStyle = COLORS.spruceVelvet;
    ctx.fillText('🎯 TARGET', x + w / 2, y + 20);
    ctx.restore();

    // Render coloured preview shape, dynamically scaled to 80%-85% without clipping
    const { offsetX, offsetY, scale } = this.referenceTransform;

    for (const region of level.regions) {
      ShapeRenderer.drawRegion(ctx, region, {
        offsetX,
        offsetY,
        scale,
        fillColor: region.targetColor,
        strokeColor: COLORS.spruceVelvet,
        strokeWidth: 2,
        isHighlighted: false,
      });
    }
  }

  private renderPillToolbar(ctx: CanvasRenderingContext2D): void {
    const { x, y, w, h } = this.pillToolbarBounds;

    // 1. Sleek Pill-shaped Container floating on top of middle container with elevated drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(27, 69, 50, 0.28)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;
    // 3D bottom bevel
    this.drawRoundedRect(ctx, x, y + 4, w, h, h / 2, COLORS.spruceVelvetShadow);
    // Pill face in bright Clotted Cream with Spruce Velvet outline
    this.drawRoundedRect(ctx, x, y, w, h, h / 2, '#FAF5EC', COLORS.spruceVelvet, 3.5);
    ctx.restore();

    // 2. Action buttons: Undo, Clear, Hint horizontally side-by-side
    // All 3 styled in signature "Let's Play" 3D green gradient with crisp white text
    drawGlossyGreenButton(ctx, {
      x: this.buttons.undo.x,
      y: this.buttons.undo.y,
      w: this.buttons.undo.w,
      h: this.buttons.undo.h,
      text: this.buttons.undo.label,
      fontSize: 17,
      radius: 18,
    });

    drawGlossyGreenButton(ctx, {
      x: this.buttons.reset.x,
      y: this.buttons.reset.y,
      w: this.buttons.reset.w,
      h: this.buttons.reset.h,
      text: this.buttons.reset.label,
      fontSize: 17,
      radius: 18,
    });

    // Hint Button: When used once, keep green gradient but render in disabled state (opacity: 0.45)
    const hintUsed = coloringEngine.isHintUsed();
    drawGlossyGreenButton(ctx, {
      x: this.buttons.hint.x,
      y: this.buttons.hint.y,
      w: this.buttons.hint.w,
      h: this.buttons.hint.h,
      text: hintUsed ? '💡 Used' : '💡 Hint',
      fontSize: 17,
      radius: 18,
      isDisabled: hintUsed,
    });
  }

  private renderPalette(
    ctx: CanvasRenderingContext2D,
    level: LevelData,
    isPortrait: boolean
  ): void {
    const { x, y, w, h } = this.paletteArea;

    // Palette background card
    this.drawRoundedRect(ctx, x, y, w, h, 22, COLORS.clottedCreamCard, COLORS.spruceVelvet, 3.5);

    const hasSelection = coloringEngine.getSelectedRegionId() !== null;

    // Prompt Header
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.spruceVelvet;

    const labelTopPad = isPortrait ? 20 : 24;
    const labelH = isPortrait ? 40 : 52;
    const promptText = hasSelection
      ? (w < 320 ? '👇 TAP A COLOUR!' : '👇 TAP A COLOUR TO PAINT!')
      : 'TAP A SHAPE FIRST';

    let fontSize = isPortrait ? 15 : 15;
    ctx.font = getFont(fontSize, 'extraBold');

    // Auto-shrink font if needed so text never encroaches on the card's rounded borders
    const maxTextW = w - 40;
    while (ctx.measureText(promptText).width > maxTextW && fontSize > 11) {
      fontSize -= 0.5;
      ctx.font = getFont(fontSize, 'extraBold');
    }

    ctx.fillText(promptText, x + w / 2, y + labelTopPad);
    ctx.restore();

    // Spacious Palette Grid: Color blocks with comfortable spacing and white glowing highlights
    this.swatchRects = [];
    const colors = level.palette;

    const innerPad = isPortrait ? 14 : 16;
    const gridX = x + innerPad;
    const gridY = y + labelH + (isPortrait ? 8 : 10);
    const availW = w - innerPad * 2;
    const availH = h - (labelH + (isPortrait ? 8 : 10)) - innerPad;

    const gap = isPortrait ? (colors.length <= 4 ? 14 : 12) : 16;

    if (isPortrait) {
      // Mobile Portrait: Spacious grid below label
      if (colors.length <= 4) {
        // 1 row
        const swatchW = Math.floor((availW - (colors.length - 1) * gap) / colors.length);
        const swatchH = Math.floor(availH);

        for (let i = 0; i < colors.length; i++) {
          const sx = gridX + i * (swatchW + gap);
          const sy = gridY;

          this.swatchRects.push({
            color: colors[i],
            x: sx,
            y: sy,
            w: swatchW,
            h: swatchH,
          });

          this.drawFullSpaceSwatch(ctx, colors[i], sx, sy, swatchW, swatchH, hasSelection);
        }
      } else {
        // 2 rows grid (e.g. 2 rows of 4 for 8-colour levels)
        const cols = Math.ceil(colors.length / 2);
        const swatchW = Math.floor((availW - (cols - 1) * gap) / cols);
        const swatchH = Math.floor((availH - gap) / 2);

        for (let i = 0; i < colors.length; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const sx = gridX + col * (swatchW + gap);
          const sy = gridY + row * (swatchH + gap);

          this.swatchRects.push({
            color: colors[i],
            x: sx,
            y: sy,
            w: swatchW,
            h: swatchH,
          });

          this.drawFullSpaceSwatch(ctx, colors[i], sx, sy, swatchW, swatchH, hasSelection);
        }
      }
    } else {
      // Landscape: Vertical 2-column grid with generous spacing
      const cols = 2;
      const rows = Math.ceil(colors.length / cols);
      const swatchW = Math.floor((availW - (cols - 1) * gap) / cols);
      const swatchH = Math.floor((availH - (rows - 1) * gap) / rows);

      for (let i = 0; i < colors.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const sx = gridX + col * (swatchW + gap);
        const sy = gridY + row * (swatchH + gap);

        this.swatchRects.push({
          color: colors[i],
          x: sx,
          y: sy,
          w: swatchW,
          h: swatchH,
        });

        this.drawFullSpaceSwatch(ctx, colors[i], sx, sy, swatchW, swatchH, hasSelection);
      }
    }
  }

  private drawFullSpaceSwatch(
    ctx: CanvasRenderingContext2D,
    color: string,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    hasSelection: boolean
  ): void {
    const hintedColor = coloringEngine.getHintedColor();
    const isHinted = hintedColor !== null && hintedColor.toLowerCase() === color.toLowerCase();

    ctx.save();

    // Radiant glowing effect when active (zero continuous movement, clean luminous highlight)
    if (isHinted) {
      // Golden luminous aura for hinted color
      ctx.save();
      ctx.shadowColor = 'rgba(242, 201, 76, 0.95)';
      ctx.shadowBlur = 18;
      this.drawRoundedRect(
        ctx,
        sx - 4,
        sy - 4,
        sw + 8,
        sh + 8,
        18,
        'rgba(242, 201, 76, 0.45)',
        '#F2C94C',
        3.5
      );
      ctx.restore();
    } else if (hasSelection) {
      // Dazzling brilliant white glitter glowing effect around active swatches
      ctx.save();
      // Outer bright shimmer aura
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      this.drawRoundedRect(
        ctx,
        sx - 4,
        sy - 4,
        sw + 8,
        sh + 8,
        18,
        'rgba(255, 255, 255, 0.75)',
        '#FFFFFF',
        3
      );
      ctx.restore();

      // Sharp specular white rim for intense glitter sparkle
      ctx.save();
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 8;
      this.drawRoundedRect(
        ctx,
        sx - 2,
        sy - 2,
        sw + 4,
        sh + 4,
        16,
        undefined,
        '#FFFFFF',
        2
      );
      ctx.restore();
    }

    // 3D bottom bevel/shadow
    this.drawRoundedRect(ctx, sx, sy + 4, sw, sh, 14, COLORS.clottedCreamDark);

    // Rounded rectangle swatch face with dazzling pure white border
    this.drawRoundedRect(
      ctx,
      sx,
      sy,
      sw,
      sh,
      14,
      color,
      isHinted ? '#F2C94C' : hasSelection ? '#FFFFFF' : '#DFD2BD',
      isHinted ? 4.5 : hasSelection ? 4 : 2
    );

    // High-specularity crystalline glitter shine
    ctx.fillStyle = hasSelection ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(sx + sw / 2, sy + Math.min(14, sh * 0.25), sw * 0.38, Math.min(8, sh * 0.15), 0, 0, Math.PI * 2);
    } else {
      ctx.arc(sx + sw / 2, sy + Math.min(14, sh * 0.25), 8, 0, Math.PI * 2);
    }
    ctx.fill();

    // Glitter sparkle diamond glints on active swatch corners
    if (hasSelection) {
      this.drawGlitterSparkle(ctx, sx + sw - 8, sy + 8, 6);
      this.drawGlitterSparkle(ctx, sx + 9, sy + sh - 9, 4.5);
    }

    ctx.restore();
  }

  private drawGlitterSparkle(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number
  ): void {
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 10;

    // 4-point diamond sparkle star
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.quadraticCurveTo(cx, cy, cx + size, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + size);
    ctx.quadraticCurveTo(cx, cy, cx - size, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - size);
    ctx.fill();

    // Specular brilliant center pinprick
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1.5, size * 0.35), 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
  }

  private renderToast(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.toastMessage) return;

    ctx.save();
    ctx.font = getFont(16, 'bold');
    const text = this.toastMessage;
    const textW = ctx.measureText(text).width;
    const toastW = textW + 48;
    const toastH = 46;
    const toastX = Math.round((width - toastW) / 2);
    const toastY = height > width ? 232 : 54;

    // Toast shadow
    this.drawRoundedRect(ctx, toastX, toastY + 4, toastW, toastH, 23, 'rgba(0, 0, 0, 0.25)');
    // Toast face (Spruce Velvet with sunny gold border)
    this.drawRoundedRect(ctx, toastX, toastY, toastW, toastH, 23, 'rgba(27, 69, 50, 0.95)', '#F2C94C', 2.5);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FAF5EC';
    ctx.fillText(text, width / 2, toastY + toastH / 2);
    ctx.restore();
  }

  public onTap(x: number, y: number): void {
    if (this.isCompleting) return;

    // 1. Check Top App Bar buttons
    if (this.isInside(x, y, this.buttons.back)) {
      this.onPlaySound?.('tap');
      sceneManager.switchTo('levelSelect');
      return;
    }

    if (this.isInside(x, y, this.buttons.sound)) {
      const settings = saveManager.getSettings();
      const nowMuted = !(settings.sfxMuted && settings.musicMuted);
      saveManager.updateSettings({ sfxMuted: nowMuted, musicMuted: nowMuted });
      audioManager.setSfxMuted(nowMuted);
      audioManager.setMusicMuted(nowMuted);
      if (!nowMuted) {
        this.onPlaySound?.('tap');
      }
      return;
    }

    // 2. CRUCIAL: Check Overlapping Pill Toolbar Buttons BEFORE main shape canvas
    // So tapping Undo, Clear, or Hint never triggers a shape selection underneath!
    if (this.isInside(x, y, this.buttons.undo)) {
      this.onPlaySound?.('clear');
      coloringEngine.undo();
      return;
    }

    if (this.isInside(x, y, this.buttons.reset)) {
      this.onPlaySound?.('clear');
      coloringEngine.resetCurrentLevel();
      return;
    }

    if (this.isInside(x, y, this.buttons.hint)) {
      if (coloringEngine.isHintUsed()) {
        this.showToast('💡 Hint already used for this level!', 2200);
        this.onPlaySound?.('tap');
        return; // Ignore pointer tap when disabled
      }

      // Step 1: Container Selection Required
      const selectedId = coloringEngine.getSelectedRegionId();
      if (!selectedId) {
        this.showToast('👉 Tap a shape first to use a hint!', 2500);
        this.onPlaySound?.('tap');
        return;
      }

      // Step 2 & 3: Highlight Target Colour & Disable Hint
      const res = coloringEngine.requestHint();
      if (res.success && res.targetColor) {
        this.showToast('✨ Look at the glowing colour in the palette!', 2500);
        this.onPlaySound?.('correct');
      } else if (res.reason === 'already_used') {
        this.showToast('💡 Hint already used for this level!', 2200);
      }
      return;
    }

    // 3. Check Palette Swatches (Step B: Fill selected container)
    for (const swatch of this.swatchRects) {
      if (
        x >= swatch.x &&
        x <= swatch.x + swatch.w &&
        y >= swatch.y &&
        y <= swatch.y + swatch.h
      ) {
        this.onPlaySound?.('select');
        const res = coloringEngine.selectColor(swatch.color);
        if (res.filled && res.regionId) {
          this.onPlaySound?.('fill');
          this.onSpawnSparkles?.(x, y, swatch.color);

          // R2: Trigger transient scale-pop (1.0 -> 1.10 -> 1.0) and glow flash on that container region over ~250ms
          this.activeFillAnims.set(res.regionId, { timer: 0, duration: 250, color: swatch.color });

          // Also spawn sparkles at region's center
          const currentLevel = coloringEngine.getLevel();
          const filledRegion = currentLevel?.regions.find((r) => r.id === res.regionId);
          if (filledRegion) {
            const bbox = ShapeRenderer.calculateBoundingBox([filledRegion]);
            const rcx = bbox.minX + bbox.width / 2;
            const rcy = bbox.minY + bbox.height / 2;
            const { offsetX, offsetY, scale } = this.templateTransform;
            const centerScreenX = offsetX + rcx * scale;
            const centerScreenY = offsetY + rcy * scale;
            this.onSpawnSparkles?.(centerScreenX, centerScreenY, swatch.color);
          }

          this.checkCompletion();
        }
        return;
      }
    }

    // 4. Check Main Middle Container Regions (Step A: Select container)
    const level = coloringEngine.getLevel();
    if (!level) return;

    const { offsetX, offsetY, scale } = this.templateTransform;
    const offscreen = document.createElement('canvas');
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    // Check regions in reverse order (topmost layer first)
    for (let i = level.regions.length - 1; i >= 0; i--) {
      const region = level.regions[i];
      if (ShapeRenderer.hitTest(offCtx, region, x, y, offsetX, offsetY, scale)) {
        // Step A: Select container (NEVER fills on container tap!)
        coloringEngine.selectRegion(region.id);
        this.onPlaySound?.('tap');
        return;
      }
    }
  }

  private checkCompletion(): void {
    if (coloringEngine.isAllRegionsFilled()) {
      this.isCompleting = true;
      this.completionTimer = 0;
      this.onPlaySound?.('correct');
    }
  }

  private isInside(x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill?: string,
    stroke?: string,
    strokeW = 2
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();

    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }

    if (stroke && strokeW > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeW;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPillButton(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    bgColor: string,
    textColor: string,
    borderColor: string = COLORS.spruceVelvet
  ): void {
    ctx.save();
    // Drop shadow
    this.drawRoundedRect(ctx, x, y + 3, w, h, h / 2, COLORS.spruceVelvetShadow);
    // Button face
    this.drawRoundedRect(ctx, x, y, w, h, h / 2, bgColor, borderColor, 2);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = getFont(15, 'extraBold');
    ctx.fillStyle = textColor;
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.restore();
  }
}

export const gameplayScene = new GameplayScene();
