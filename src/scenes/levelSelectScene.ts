/* ─────────────────────────────────────────────────────────────
 *  levelSelectScene.ts – 100-Level Selector Screen for Colour Quest
 *  Features 5 paged grids (1-20, 21-40, 41-60, 61-80, 81-100),
 *  category icons, 0-3 stars per level, lock states, smooth paging & responsive layout.
 * ───────────────────────────────────────────────────────────── */
import {
  COLORS,
  DIMENSIONS,
  MIN_TOUCH_TARGET,
  getFont,
} from '../ui/tokens';
import {
  drawButton,
  drawGlossyGreenButton,
  drawRoundedRect,
  drawStar,
  drawIcon,
  drawBubble,
  drawFloralBadge,
  draw3DPadlock,
  isPointInButton,
  type ButtonOptions,
} from '../ui/components';
import { backgroundRenderer } from '../ui/backgroundRenderer';
import { eventBus } from '../shared/eventBus';
import { audioManager } from '../audio/audioManager';
import { saveManager } from '../game/saveManager';
import { getLevel } from '../game/levelsData';
import { sceneManager, type Scene } from '../core/sceneManager';
import {
  DESIGN_WIDTH,
  DESIGN_HEIGHT,
  TOTAL_LEVELS,
  CATEGORY_RANGES,
} from '../shared/constants';
import type { LevelCategory, SceneName } from '../shared/contracts';

interface PageTab {
  index: number;
  label: string;
  categoryName: string;
  startLevel: number;
  endLevel: number;
}

interface LevelCardBounds {
  levelId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  isUnlocked: boolean;
  stars: number;
  category: LevelCategory;
}

export class LevelSelectScene implements Scene {
  public name: SceneName = 'levelSelect';
  private animTime: number = 0;
  private currentPage: number = 0; // 0..4
  private displayPageOffset: number = 0; // for smooth animated slide
  private pressedId: string | null = null;
  private hoveredId: string | null = null;

  // Touch drag state
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragCurrentX: number = 0;
  private dragStartTime: number = 0;

  // Shake animation for locked level tap
  private lockedShakeLevelId: number | null = null;
  private lockedShakeTimer: number = 0;

  // Layout rectangles
  private backBtnRect = { x: 0, y: 0, w: 120, h: 52 };
  private prevPageBtnRect = { x: 0, y: 0, w: 60, h: 60 };
  private nextPageBtnRect = { x: 0, y: 0, w: 60, h: 60 };
  private pageTabsRects: { x: number; y: number; w: number; h: number; page: number }[] = [];
  private visibleLevelCards: LevelCardBounds[] = [];

  private readonly pages: PageTab[] = [
    { index: 0, label: '1 - 20', categoryName: 'Tutorial & Shapes', startLevel: 1, endLevel: 20 },
    { index: 1, label: '21 - 40', categoryName: 'Objects & Animals', startLevel: 21, endLevel: 40 },
    { index: 2, label: '41 - 60', categoryName: 'Animals & Nature', startLevel: 41, endLevel: 60 },
    { index: 3, label: '61 - 80', categoryName: 'Nature & Scenes', startLevel: 61, endLevel: 80 },
    { index: 4, label: '81 - 100', categoryName: 'Scenes & Master', startLevel: 81, endLevel: 100 },
  ];

  constructor() {
    this.goToAppropriatePage();
  }

  public enter(params?: Record<string, unknown>): void {
    this.animTime = 0;
    this.pressedId = null;
    this.hoveredId = null;
    this.isDragging = false;
    this.goToAppropriatePage();
  }

  public exit(): void {
    this.pressedId = null;
    this.isDragging = false;
  }

  public onTap(x: number, y: number): void {
    this.handleTap(x, y);
  }

  /**
   * Automatically opens the page containing player's highest unlocked level
   */
  public goToAppropriatePage(): void {
    const progress = saveManager.getProgress();
    const highest = progress.highestUnlocked || 1;
    const pageIdx = Math.min(4, Math.max(0, Math.floor((highest - 1) / 20)));
    this.currentPage = pageIdx;
    this.displayPageOffset = pageIdx;
  }

  public setPage(pageIdx: number): void {
    if (pageIdx >= 0 && pageIdx < this.pages.length) {
      this.currentPage = pageIdx;
    }
  }

  public update(dt: number): void {
    const sec = dt / 1000;
    this.animTime += sec;
    backgroundRenderer.update(sec);

    // Smooth spring interpolation for page slide
    if (!this.isDragging) {
      const target = this.currentPage;
      const diff = target - this.displayPageOffset;
      this.displayPageOffset += diff * Math.min(1, dt * 0.012);
    }

    // Shake timer update
    if (this.lockedShakeTimer > 0) {
      this.lockedShakeTimer -= dt;
      if (this.lockedShakeTimer <= 0) {
        this.lockedShakeLevelId = null;
      }
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

    // Decorative floating soft bubbles in background
    this.renderBgDecorations(ctx, width, height);

    // 2. Safe Area Header
    this.renderHeader(ctx, width, height, isPortrait);

    // 3. Category Page Tabs
    this.renderPageTabs(ctx, width, height, isPortrait);

    // 4. Grid of 20 Level Cards for current page
    this.renderLevelGrid(ctx, width, height, isPortrait);

    // 5. Page Navigation Footer (Arrows & Dots)
    this.renderPaginationControls(ctx, width, height, isPortrait);
  }

  private renderBgDecorations(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    drawBubble(ctx, width * 0.08, height * 0.2, 50, COLORS.brightCyan, 0.12);
    drawBubble(ctx, width * 0.92, height * 0.25, 65, COLORS.candyPink, 0.12);
    drawBubble(ctx, width * 0.85, height * 0.85, 80, COLORS.sunnyYellow, 0.15);
    drawBubble(ctx, width * 0.12, height * 0.88, 55, COLORS.mintGreen, 0.12);
  }

  private renderHeader(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    isPortrait: boolean
  ): void {
    const margin = DIMENSIONS.safeAreaMargin;
    const headerY = margin;

    // 1. Back Button (top-left)
    this.backBtnRect = {
      x: margin,
      y: headerY,
      w: 124,
      h: 52,
    };

    drawGlossyGreenButton(ctx, {
      x: this.backBtnRect.x,
      y: this.backBtnRect.y,
      w: this.backBtnRect.w,
      h: this.backBtnRect.h,
      text: '◀ Back',
      fontSize: 19,
      radius: 18,
      isPressed: this.pressedId === 'back',
    });

    // 2. Center Title: "Select a Level 🎨"
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = getFont(isPortrait ? 26 : 32, 'extraBold');

    const titleText = 'Select a Level 🎨';
    const centerX = width / 2;
    const centerY = headerY + 26;

    // Outline & Fill in Spruce Velvet
    ctx.strokeStyle = '#FAF5EB';
    ctx.lineWidth = 4;
    ctx.strokeText(titleText, centerX, centerY);
    ctx.fillStyle = COLORS.spruceVelvet;
    ctx.fillText(titleText, centerX, centerY);
    ctx.restore();

    // 3. Total Stars Counter (top-right) with decorative flower petals
    const progress = saveManager.getProgress();
    let totalStars = 0;
    for (const res of Object.values(progress.results)) {
      totalStars += res.stars ?? 0;
    }
    const maxStars = TOTAL_LEVELS * 3;

    const badgeW = 145;
    const badgeH = 48;
    const badgeX = width - margin - badgeW;
    const badgeY = headerY + 2;

    drawFloralBadge(ctx, {
      x: badgeX,
      y: badgeY,
      w: badgeW,
      h: badgeH,
      text: `${totalStars} / ${maxStars}`,
    });
  }

  private renderPageTabs(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    isPortrait: boolean
  ): void {
    const margin = DIMENSIONS.safeAreaMargin;
    const tabsY = isPortrait ? 90 : 88;
    const availableW = width - margin * 2;
    const tabCount = this.pages.length;
    const gap = isPortrait ? 6 : 10;
    const tabW = Math.min(180, (availableW - gap * (tabCount - 1)) / tabCount);
    const tabH = 46;

    const startX = (width - (tabW * tabCount + gap * (tabCount - 1))) / 2;
    this.pageTabsRects = [];

    for (let i = 0; i < tabCount; i++) {
      const page = this.pages[i];
      const tabX = startX + i * (tabW + gap);
      const isSelected = this.currentPage === i;

      this.pageTabsRects.push({
        x: tabX,
        y: tabsY,
        w: tabW,
        h: tabH,
        page: i,
      });

      const color = isSelected ? COLORS.spruceVelvet : COLORS.clottedCreamCard;
      const shadow = isSelected ? COLORS.spruceVelvetShadow : COLORS.clottedCreamDark;
      const textColor = isSelected ? COLORS.creamWhite : COLORS.spruceVelvet;

      drawButton(ctx, {
        x: tabX,
        y: tabsY,
        w: tabW,
        h: tabH,
        text: page.label,
        color,
        shadowColor: shadow,
        textColor,
        fontSize: isPortrait ? 15 : 18,
        radius: DIMENSIONS.borderRadiusMd,
        shadowDepth: isSelected ? 4 : 3,
        strokeWidth: isSelected ? 3.5 : 2.5,
        isPressed: this.pressedId === `tab_${i}`,
      });
    }
  }

  private renderLevelGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    isPortrait: boolean
  ): void {
    const margin = DIMENSIONS.safeAreaMargin;
    const progress = saveManager.getProgress();
    const highestUnlocked = progress.highestUnlocked || 1;

    // Grid layout: 20 levels per page
    // Landscape: 5 columns x 4 rows
    // Portrait: 4 columns x 5 rows
    const cols = isPortrait ? 4 : 5;
    const rows = isPortrait ? 5 : 4;

    const gridTop = isPortrait ? 150 : 152;
    const gridBottom = height - (isPortrait ? 84 : 76);
    const availableH = gridBottom - gridTop;
    const availableW = width - margin * 2;

    const gapX = isPortrait ? 10 : 18;
    const gapY = isPortrait ? 10 : 14;

    const cardW = Math.floor((availableW - gapX * (cols - 1)) / cols);
    const cardH = Math.floor((availableH - gapY * (rows - 1)) / rows);

    const gridStartX = (width - (cardW * cols + gapX * (cols - 1))) / 2;

    // Current page levels
    const pageData = this.pages[this.currentPage];
    this.visibleLevelCards = [];

    // Optional horizontal offset during slide animation or drag
    let slideX = -(this.displayPageOffset - this.currentPage) * (width * 0.85);
    if (this.isDragging) {
      slideX = this.dragCurrentX - this.dragStartX;
    }

    ctx.save();
    ctx.translate(slideX, 0);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const indexInPage = r * cols + c;
        const levelId = pageData.startLevel + indexInPage;
        if (levelId > TOTAL_LEVELS) continue;

        const isUnlocked = levelId <= highestUnlocked;
        const result = progress.results[levelId];
        const stars = result ? (result.stars ?? 0) : 0;
        const category = this.getCategoryForLevel(levelId);

        let cardX = gridStartX + c * (cardW + gapX);
        const cardY = gridTop + r * (cardH + gapY);

        // Shake if this card was recently rejected
        if (this.lockedShakeLevelId === levelId) {
          const shakeFactor = Math.sin((this.lockedShakeTimer / 1000) * 40) * 7;
          cardX += shakeFactor;
        }

        const bounds: LevelCardBounds = {
          levelId,
          x: cardX,
          y: cardY,
          w: cardW,
          h: cardH,
          isUnlocked,
          stars,
          category,
        };
        this.visibleLevelCards.push(bounds);

        this.renderSingleLevelCard(ctx, bounds, isPortrait, highestUnlocked);
      }
    }

    ctx.restore();
  }

  private renderSingleLevelCard(
    ctx: CanvasRenderingContext2D,
    card: LevelCardBounds,
    isPortrait: boolean,
    highestUnlocked: number
  ): void {
    const { levelId, x, y, w, h, isUnlocked, stars, category } = card;
    const isPressed = this.pressedId === `level_${levelId}`;
    const isCurrentTarget = levelId === highestUnlocked;

    ctx.save();

    const radius = DIMENSIONS.borderRadiusMd;
    const shadowDepth = 6;
    const shiftY = isPressed ? shadowDepth - 2 : 0;
    const faceH = h - shadowDepth;

    // Category styling color
    const categoryInfo = this.getCategoryVisuals(category);

    if (isUnlocked) {
      // 1. Highlight glow if this is current unlocked level
      if (isCurrentTarget) {
        ctx.save();
        ctx.shadowColor = COLORS.sunnyYellow;
        ctx.shadowBlur = 14;
        drawRoundedRect(
          ctx,
          x - 2,
          y - 2,
          w + 4,
          h + 4,
          radius + 2,
          'rgba(255, 208, 0, 0.45)'
        );
        ctx.restore();
      }

      // 2. 3D Bottom shadow in solid cream shadow
      drawRoundedRect(
        ctx,
        x,
        y + shadowDepth,
        w,
        faceH,
        radius,
        COLORS.clottedCreamDark,
        COLORS.spruceVelvet,
        3.5
      );

      // 3. Card Face: Solid Brighter Clotted Cream (NO gradients, NO light green/blue)
      drawRoundedRect(
        ctx,
        x,
        y + shiftY,
        w,
        faceH,
        radius,
        '#FAF5EC',
        COLORS.spruceVelvet,
        3.5
      );

      // 4. Content: Top-left Level Number ONLY (top-right icon completely removed)
      ctx.save();

      // Top-left Level Number (bold Spruce Velvet, ~35% larger)
      ctx.font = getFont(isPortrait ? 26 : 24, 'extraBold');
      ctx.fillStyle = COLORS.spruceVelvet;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(levelId), x + 12, y + shiftY + 10);

      // 5. Centre Icon (Completed Tick / Verification Mark)
      const tickCenterX = x + w / 2;
      const tickCenterY = y + shiftY + faceH / 2 - 4;

      ctx.save();
      if (stars > 0) {
        // Completed: Bold clean Tick Mark (✓) in Spruce Velvet
        ctx.strokeStyle = COLORS.spruceVelvet;
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(tickCenterX - 14, tickCenterY + 1);
        ctx.lineTo(tickCenterX - 4, tickCenterY + 11);
        ctx.lineTo(tickCenterX + 16, tickCenterY - 11);
        ctx.stroke();
      } else {
        // Unlocked & In Progress: Clean Play triangle (▶) in Spruce Velvet
        ctx.fillStyle = COLORS.spruceVelvet;
        ctx.beginPath();
        ctx.moveTo(tickCenterX - 8, tickCenterY - 12);
        ctx.lineTo(tickCenterX + 12, tickCenterY);
        ctx.lineTo(tickCenterX - 8, tickCenterY + 12);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // 6. Bottom Row (Achieved Stars): Directly below centre mark along the bottom
      const starY = y + shiftY + faceH - (isPortrait ? 20 : 18);
      const starSize = isPortrait ? 13 : 12;
      const starSpacing = isPortrait ? 26 : 24;
      const starsStartX = x + w / 2 - starSpacing;

      for (let s = 0; s < 3; s++) {
        const starX = starsStartX + s * starSpacing;
        const isFilled = s < stars;
        drawStar(ctx, starX, starY, 5, starSize, starSize * 0.48, isFilled, isFilled && stars === 3);
      }

      ctx.restore();
    } else {
      // ── Locked Card matching reference (Warm stone-beige #DFD7C8, 3D golden padlock) ──
      // 3D bottom shadow
      drawRoundedRect(
        ctx,
        x,
        y + shadowDepth,
        w,
        faceH,
        radius,
        '#B5A995',
        '#9C8E79',
        2.5
      );

      // Face: flat solid muted stone-beige
      drawRoundedRect(
        ctx,
        x,
        y,
        w,
        faceH,
        radius,
        '#DFD7C8',
        '#9C8E79',
        2.5
      );

      // Top-left level number
      ctx.save();
      ctx.font = getFont(isPortrait ? 24 : 22, 'extraBold');
      ctx.fillStyle = '#8C8271';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(levelId), x + 12, y + 10);
      ctx.restore();

      // Detailed 3D Golden Padlock with metallic silver shackle
      draw3DPadlock(ctx, x + w / 2, y + faceH / 2 + 5, Math.min(w * 0.38, faceH * 0.44, 46));
    }

    ctx.restore();
  }

  private renderPaginationControls(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    isPortrait: boolean
  ): void {
    const footerY = height - (isPortrait ? 70 : 64);
    const btnSize = 54;
    const centerX = width / 2;

    // Previous Page Button ◀
    this.prevPageBtnRect = {
      x: centerX - 160 - btnSize,
      y: footerY - btnSize / 2,
      w: btnSize,
      h: btnSize,
    };

    const hasPrev = this.currentPage > 0;
    drawButton(ctx, {
      x: this.prevPageBtnRect.x,
      y: this.prevPageBtnRect.y,
      w: this.prevPageBtnRect.w,
      h: this.prevPageBtnRect.h,
      icon: 'arrow-left',
      color: COLORS.creamWhite,
      shadowColor: COLORS.creamWhiteShadow,
      textColor: hasPrev ? COLORS.spruceVelvet : COLORS.disabledText,
      strokeColor: COLORS.spruceVelvet,
      strokeWidth: 3,
      radius: DIMENSIONS.borderRadiusPill,
      shadowDepth: 4,
      isDisabled: !hasPrev,
      isPressed: this.pressedId === 'prev_page',
    });

    // Next Page Button ▶
    this.nextPageBtnRect = {
      x: centerX + 160,
      y: footerY - btnSize / 2,
      w: btnSize,
      h: btnSize,
    };

    const hasNext = this.currentPage < this.pages.length - 1;
    drawButton(ctx, {
      x: this.nextPageBtnRect.x,
      y: this.nextPageBtnRect.y,
      w: this.nextPageBtnRect.w,
      h: this.nextPageBtnRect.h,
      icon: 'arrow-right',
      color: COLORS.creamWhite,
      shadowColor: COLORS.creamWhiteShadow,
      textColor: hasNext ? COLORS.spruceVelvet : COLORS.disabledText,
      strokeColor: COLORS.spruceVelvet,
      strokeWidth: 3,
      radius: DIMENSIONS.borderRadiusPill,
      shadowDepth: 4,
      isDisabled: !hasNext,
      isPressed: this.pressedId === 'next_page',
    });

    // Pagination Dots (● ○ ○ ○ ○)
    ctx.save();
    const dotSpacing = 24;
    const dotStartX = centerX - ((this.pages.length - 1) * dotSpacing) / 2;

    for (let i = 0; i < this.pages.length; i++) {
      const dotX = dotStartX + i * dotSpacing;
      const isCur = i === this.currentPage;
      ctx.beginPath();
      ctx.arc(dotX, footerY, isCur ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isCur ? '#E05353' : '#C5BAA5';
      ctx.fill();

      if (isCur) {
        ctx.strokeStyle = COLORS.spruceVelvet;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private getCategoryForLevel(levelId: number): LevelCategory {
    const lvl = getLevel(levelId);
    if (lvl) return lvl.category;
    if (levelId <= CATEGORY_RANGES.tutorial.end) return 'tutorial';
    if (levelId <= CATEGORY_RANGES.simple_objects.end) return 'simple_objects';
    if (levelId <= CATEGORY_RANGES.animals.end) return 'animals';
    if (levelId <= CATEGORY_RANGES.nature.end) return 'nature';
    if (levelId <= CATEGORY_RANGES.scenes.end) return 'scenes';
    return 'master';
  }

  private getCategoryVisuals(cat: LevelCategory): {
    icon: string;
  } {
    switch (cat) {
      case 'tutorial':
        return { icon: '🌱' };
      case 'basic_shapes':
        return { icon: '🔷' };
      case 'simple_objects':
        return { icon: '🧸' };
      case 'animals':
        return { icon: '🐱' };
      case 'nature':
        return { icon: '🌸' };
      case 'scenes':
        return { icon: '🏰' };
      case 'master':
        return { icon: '👑' };
    }
  }

  public handlePointerDown(x: number, y: number): boolean {
    // Check Back button
    if (isPointInButton(this.backBtnRect, x, y)) {
      this.pressedId = 'back';
      return true;
    }

    // Check Prev/Next Page
    if (isPointInButton(this.prevPageBtnRect, x, y) && this.currentPage > 0) {
      this.pressedId = 'prev_page';
      return true;
    }
    if (isPointInButton(this.nextPageBtnRect, x, y) && this.currentPage < this.pages.length - 1) {
      this.pressedId = 'next_page';
      return true;
    }

    // Check Page Tabs
    for (const tab of this.pageTabsRects) {
      if (isPointInButton(tab, x, y)) {
        this.pressedId = `tab_${tab.page}`;
        return true;
      }
    }

    // Check Level Cards
    for (const card of this.visibleLevelCards) {
      if (isPointInButton(card, x, y)) {
        this.pressedId = `level_${card.levelId}`;
        return true;
      }
    }

    // Initiate touch drag
    this.isDragging = true;
    this.dragStartX = x;
    this.dragCurrentX = x;
    this.dragStartTime = performance.now();

    return false;
  }

  public handlePointerMove(x: number, y: number): void {
    if (this.isDragging) {
      this.dragCurrentX = x;
    }
  }

  public handlePointerUp(x: number, y: number): boolean {
    const wasPressed = this.pressedId;
    this.pressedId = null;

    // Check drag swipe
    if (this.isDragging) {
      this.isDragging = false;
      const dx = this.dragCurrentX - this.dragStartX;
      if (Math.abs(dx) > 60) {
        if (dx < 0 && this.currentPage < this.pages.length - 1) {
          this.currentPage++;
          return true;
        } else if (dx > 0 && this.currentPage > 0) {
          this.currentPage--;
          return true;
        }
      }
    }

    if (wasPressed === 'back' && isPointInButton(this.backBtnRect, x, y)) {
      this.onBackClicked();
      return true;
    }

    if (wasPressed === 'prev_page' && isPointInButton(this.prevPageBtnRect, x, y)) {
      if (this.currentPage > 0) this.currentPage--;
      return true;
    }

    if (wasPressed === 'next_page' && isPointInButton(this.nextPageBtnRect, x, y)) {
      if (this.currentPage < this.pages.length - 1) this.currentPage++;
      return true;
    }

    for (const tab of this.pageTabsRects) {
      if (wasPressed === `tab_${tab.page}` && isPointInButton(tab, x, y)) {
        this.currentPage = tab.page;
        return true;
      }
    }

    for (const card of this.visibleLevelCards) {
      if (wasPressed === `level_${card.levelId}` && isPointInButton(card, x, y)) {
        this.onLevelCardClicked(card);
        return true;
      }
    }

    return false;
  }

  public handleTap(x: number, y: number): boolean {
    // Back
    if (isPointInButton(this.backBtnRect, x, y)) {
      this.onBackClicked();
      return true;
    }

    // Prev Page
    if (isPointInButton(this.prevPageBtnRect, x, y)) {
      if (this.currentPage > 0) this.currentPage--;
      return true;
    }

    // Next Page
    if (isPointInButton(this.nextPageBtnRect, x, y)) {
      if (this.currentPage < this.pages.length - 1) this.currentPage++;
      return true;
    }

    // Tabs
    for (const tab of this.pageTabsRects) {
      if (isPointInButton(tab, x, y)) {
        this.currentPage = tab.page;
        return true;
      }
    }

    // Cards
    for (const card of this.visibleLevelCards) {
      if (isPointInButton(card, x, y)) {
        this.onLevelCardClicked(card);
        return true;
      }
    }

    return false;
  }

  private onLevelCardClicked(card: LevelCardBounds): void {
    if (!card.isUnlocked) {
      // Trigger cute locked shake animation
      this.lockedShakeLevelId = card.levelId;
      this.lockedShakeTimer = 350;
      return;
    }

    // Start Level
    eventBus.emit('audio:unlock', {});
    audioManager.playTap();
    saveManager.setCurrentLevel(card.levelId);
    eventBus.emit('level:start', { levelId: card.levelId, silentAudio: true });
    sceneManager.switchTo('gameplay', { levelId: card.levelId });
  }

  private onBackClicked(): void {
    eventBus.emit('audio:unlock', {});
    sceneManager.switchTo('title');
  }
}

export const levelSelectScene = new LevelSelectScene();
