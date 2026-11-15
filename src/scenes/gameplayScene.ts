/* ─────────────────────────────────────────────────────────────
 *  gameplayScene.ts – The Core Interactive Colouring Scene
 *  Reference image (top-right), Blank template (center), Palette (side)
 * ───────────────────────────────────────────────────────────── */
import type { Scene } from '../core/sceneManager';
import { sceneManager } from '../core/sceneManager';
import { ShapeRenderer } from '../core/shapeRenderer';
import { coloringEngine } from '../game/coloringEngine';
import { saveManager } from '../game/saveManager';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../shared/constants';
import type { LevelData, Region } from '../shared/contracts';

export class GameplayScene implements Scene {
  public name = 'gameplay' as const;

  // Layout rectangles (in design canvas coordinates: 1280 x 720)
  private readonly templateBounds = {
    x: 360,
    y: 110,
    size: 480,
  };

  private readonly referenceBounds = {
    x: 960,
    y: 100,
    size: 240,
  };

  private readonly paletteArea = {
    x: 80,
    y: 120,
    w: 220,
    h: 520,
  };

  // Color swatches clickable bounds
  private swatchRects: Array<{ color: string; x: number; y: number; size: number }> = [];

  // Buttons bounds
  private buttons = {
    back: { x: 40, y: 30, w: 100, h: 54, label: '◀ Levels' },
    sound: { x: 1140, y: 30, w: 60, h: 54, label: '🔊' },
    undo: { x: 440, y: 620, w: 130, h: 60, label: '↩ Undo' },
    reset: { x: 590, y: 620, w: 130, h: 60, label: '🔄 Clear' },
    hint: { x: 740, y: 620, w: 130, h: 60, label: '💡 Hint' },
  };

  // Pulse animation state
  private pulseTimer = 0;
  private completionTimer = 0;
  private isCompleting = false;

  // External hooks (audio / particles / levels)
  public onPlaySound?: (sound: string) => void;
  public onSpawnSparkles?: (x: number, y: number, color: string) => void;
  public onGetLevel?: (id: number) => LevelData | undefined;

  public enter(params?: Record<string, unknown>): void {
    this.isCompleting = false;
    this.completionTimer = 0;

    let levelId = (params?.levelId as number) || saveManager.getProgress().currentLevel || 1;
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
  }

  public update(dt: number): void {
    this.pulseTimer += dt;

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

  public render(ctx: CanvasRenderingContext2D): void {
    const level = coloringEngine.getLevel();
    if (!level) return;

    // 1. Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    bgGrad.addColorStop(0, '#251F47');
    bgGrad.addColorStop(1, '#1A1633');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

    // 2. Header HUD
    this.renderHeader(ctx, level);

    // 3. Side Palette (Square boxes with rounded corners)
    this.renderPalette(ctx, level);

    // 4. Centre Blank / Colouring Template
    this.renderTemplate(ctx, level);

    // 5. Top Right Reference Image (Coloured Target)
    this.renderReference(ctx, level);

    // 6. Bottom action controls (Undo, Reset, Hint)
    this.renderControls(ctx);
  }

  private renderHeader(ctx: CanvasRenderingContext2D, level: LevelData): void {
    // Back button
    this.drawCardButton(ctx, this.buttons.back.x, this.buttons.back.y, this.buttons.back.w, this.buttons.back.h, this.buttons.back.label, '#3B336A', '#FFF');

    // Sound toggle
    const settings = saveManager.getSettings();
    const soundIcon = settings.sfxMuted ? '🔇' : '🔊';
    this.drawCardButton(ctx, this.buttons.sound.x, this.buttons.sound.y, this.buttons.sound.w, this.buttons.sound.h, soundIcon, '#3B336A', '#FFF');

    // Title & Badge
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Level number
    ctx.font = 'bold 32px "Nunito", sans-serif';
    ctx.fillStyle = '#FFD000';
    ctx.fillText(`Level ${level.id}: ${level.name}`, DESIGN_WIDTH / 2, 45);

    // Category pill
    ctx.font = 'bold 16px "Nunito", sans-serif';
    ctx.fillStyle = '#00C4FF';
    ctx.fillText(level.category.toUpperCase().replace('_', ' '), DESIGN_WIDTH / 2, 80);
    ctx.restore();
  }

  private renderPalette(ctx: CanvasRenderingContext2D, level: LevelData): void {
    const { x, y, w, h } = this.paletteArea;

    // Background card for palette
    this.drawRoundedRect(ctx, x, y, w, h, 24, '#2E2756', '#433B78', 3);

    // Palette header
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px "Nunito", sans-serif';
    ctx.fillStyle = '#FFD000';
    ctx.fillText('🎨 COLOURS', x + w / 2, y + 36);

    const hasSelection = coloringEngine.getSelectedRegionId() !== null;
    ctx.font = '14px "Nunito", sans-serif';
    ctx.fillStyle = hasSelection ? '#00E676' : '#B8B3E0';
    ctx.fillText(hasSelection ? 'Pick a colour!' : 'Tap region or colour', x + w / 2, y + 62);
    ctx.restore();

    // Swatches grid (2 columns)
    this.swatchRects = [];
    const colors = level.palette;
    const swatchSize = 72;
    const gap = 16;
    const startX = x + (w - (swatchSize * 2 + gap)) / 2;
    const startY = y + 84;

    const selectedColor = coloringEngine.getSelectedColor();
    const pulseScale = 1 + Math.sin(this.pulseTimer * 8) * 0.05;

    for (let i = 0; i < colors.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const sx = startX + col * (swatchSize + gap);
      const sy = startY + row * (swatchSize + gap);

      const isSelected = selectedColor?.toLowerCase() === colors[i].toLowerCase();

      this.swatchRects.push({
        color: colors[i],
        x: sx,
        y: sy,
        size: swatchSize,
      });

      ctx.save();
      if (isSelected || (hasSelection && !selectedColor)) {
        // Highlighting / pulsating when child is prompted to pick a colour
        ctx.translate(sx + swatchSize / 2, sy + swatchSize / 2);
        ctx.scale(pulseScale, pulseScale);
        ctx.translate(-(sx + swatchSize / 2), -(sy + swatchSize / 2));
      }

      // Rounded square box
      this.drawRoundedRect(
        ctx,
        sx,
        sy,
        swatchSize,
        swatchSize,
        18,
        colors[i],
        isSelected ? '#FFD000' : '#FFFFFF',
        isSelected ? 5 : 3
      );

      // Inner highlight gloss
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.ellipse(sx + swatchSize / 2, sy + 18, swatchSize * 0.35, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Checkmark if selected
      if (isSelected) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx + 24, sy + swatchSize / 2);
        ctx.lineTo(sx + swatchSize / 2 - 4, sy + swatchSize - 24);
        ctx.lineTo(sx + swatchSize - 20, sy + 22);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private renderTemplate(ctx: CanvasRenderingContext2D, level: LevelData): void {
    const { x, y, size } = this.templateBounds;

    // Card background for template
    this.drawRoundedRect(ctx, x, y, size, size, 32, '#FFFDF7', '#FFD000', 4);

    // Scale template from standard 500x500 box to inner canvas area (e.g. 420x420)
    const innerPadding = 30;
    const targetSize = size - innerPadding * 2;
    const scale = targetSize / 500;
    const offsetX = x + innerPadding;
    const offsetY = y + innerPadding;

    const selectedRegionId = coloringEngine.getSelectedRegionId();
    const filledColors = coloringEngine.getFilledColors();

    // Draw all regions
    for (const region of level.regions) {
      const isSelected = selectedRegionId === region.id;
      const filledColor = filledColors.get(region.id) || '#FFFFFF';

      ShapeRenderer.drawRegion(ctx, region, {
        offsetX,
        offsetY,
        scale,
        fillColor: filledColor,
        strokeColor: '#2C2554',
        strokeWidth: 4,
        isHighlighted: isSelected,
        highlightColor: '#FFD000',
        glow: isSelected,
      });
    }
  }

  private renderReference(ctx: CanvasRenderingContext2D, level: LevelData): void {
    const { x, y, size } = this.referenceBounds;

    // Reference Card Background
    this.drawRoundedRect(ctx, x, y, size, size, 24, '#2E2756', '#00C4FF', 3);

    // Header badge
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Nunito", sans-serif';
    ctx.fillStyle = '#00C4FF';
    ctx.fillText('⭐ TARGET IMAGE', x + size / 2, y + 26);
    ctx.restore();

    // Scale from 500x500 to reference box inner area
    const innerPad = 36;
    const targetSize = size - innerPad * 2;
    const scale = targetSize / 500;
    const offsetX = x + innerPad;
    const offsetY = y + innerPad + 8;

    // Reference always draws the exact target colours!
    for (const region of level.regions) {
      ShapeRenderer.drawRegion(ctx, region, {
        offsetX,
        offsetY,
        scale,
        fillColor: region.targetColor,
        strokeColor: '#2C2554',
        strokeWidth: 2,
        isHighlighted: false,
      });
    }
  }

  private renderControls(ctx: CanvasRenderingContext2D): void {
    this.drawCardButton(ctx, this.buttons.undo.x, this.buttons.undo.y, this.buttons.undo.w, this.buttons.undo.h, this.buttons.undo.label, '#3B336A', '#FFF');
    this.drawCardButton(ctx, this.buttons.reset.x, this.buttons.reset.y, this.buttons.reset.w, this.buttons.reset.h, this.buttons.reset.label, '#3B336A', '#FFF');
    this.drawCardButton(ctx, this.buttons.hint.x, this.buttons.hint.y, this.buttons.hint.w, this.buttons.hint.h, this.buttons.hint.label, '#00C4FF', '#1E1A34');

    // Progress counter
    const level = coloringEngine.getLevel();
    if (level) {
      const filledCount = coloringEngine.getFilledColors().size;
      const totalCount = level.regions.length;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px "Nunito", sans-serif';
      ctx.fillStyle = filledCount === totalCount ? '#00E676' : '#FFD000';
      ctx.fillText(`${filledCount} / ${totalCount} coloured`, DESIGN_WIDTH / 2, 705);
      ctx.restore();
    }
  }

  public onTap(x: number, y: number): void {
    if (this.isCompleting) return;

    // 1. Check HUD buttons
    if (this.isInside(x, y, this.buttons.back)) {
      this.onPlaySound?.('tap');
      sceneManager.switchTo('levelSelect');
      return;
    }

    if (this.isInside(x, y, this.buttons.sound)) {
      const s = saveManager.getSettings();
      saveManager.updateSettings({ sfxMuted: !s.sfxMuted, musicMuted: !s.musicMuted });
      this.onPlaySound?.('tap');
      return;
    }

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
      const selectedId = coloringEngine.getSelectedRegionId();
      const level = coloringEngine.getLevel();
      if (level) {
        let targetRegion: Region | undefined;
        if (selectedId) {
          targetRegion = level.regions.find((r) => r.id === selectedId);
        } else {
          // Find first unfilled or mismatched region
          targetRegion = level.regions.find(
            (r) => coloringEngine.getFilledColor(r.id) !== r.targetColor
          );
          if (targetRegion) {
            coloringEngine.selectRegion(targetRegion.id);
          }
        }

        if (targetRegion) {
          coloringEngine.selectColor(targetRegion.targetColor);
          this.onPlaySound?.('correct');
          this.checkCompletion();
        }
      }
      return;
    }

    // 2. Check Palette Swatches
    for (const swatch of this.swatchRects) {
      if (
        x >= swatch.x &&
        x <= swatch.x + swatch.size &&
        y >= swatch.y &&
        y <= swatch.y + swatch.size
      ) {
        this.onPlaySound?.('select');
        const res = coloringEngine.selectColor(swatch.color);
        if (res.filled && res.regionId) {
          this.onPlaySound?.('fill');
          this.onSpawnSparkles?.(x, y, swatch.color);
          this.checkCompletion();
        }
        return;
      }
    }

    // 3. Check Centre Template Regions
    const level = coloringEngine.getLevel();
    if (!level) return;

    const { x: tx, y: ty, size: tSize } = this.templateBounds;
    const innerPadding = 30;
    const targetSize = tSize - innerPadding * 2;
    const scale = targetSize / 500;
    const offsetX = tx + innerPadding;
    const offsetY = ty + innerPadding;

    // Create a temporary canvas context for hit testing if necessary
    const offscreen = document.createElement('canvas');
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    // Check regions in reverse order (top layer first)
    for (let i = level.regions.length - 1; i >= 0; i--) {
      const region = level.regions[i];
      if (ShapeRenderer.hitTest(offCtx, region, x, y, offsetX, offsetY, scale)) {
        const res = coloringEngine.selectRegion(region.id);
        if (res.filled && res.color) {
          this.onPlaySound?.('fill');
          const center = ShapeRenderer.getRegionCenter(region);
          this.onSpawnSparkles?.(
            offsetX + center.x * scale,
            offsetY + center.y * scale,
            res.color
          );
          this.checkCompletion();
        } else {
          this.onPlaySound?.('tap');
        }
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
    fill: string,
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

    ctx.fillStyle = fill;
    ctx.fill();

    if (stroke && strokeW > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeW;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCardButton(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    bgColor: string,
    textColor: string
  ): void {
    ctx.save();
    // Drop shadow bottom edge (3D button effect)
    this.drawRoundedRect(ctx, x, y + 4, w, h, 14, '#1A1633');
    // Button face
    this.drawRoundedRect(ctx, x, y, w, h, 14, bgColor, '#4F4588', 2);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px "Nunito", sans-serif';
    ctx.fillStyle = textColor;
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.restore();
  }
}

export const gameplayScene = new GameplayScene();
