import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  COLORS,
  FONT_FAMILY,
  MIN_TOUCH_TARGET,
  BORDER_RADIUS,
  OUTLINE_WIDTH,
  getFont,
  DIMENSIONS,
} from './tokens';
import {
  drawRoundedRect,
  drawButton,
  drawColorSwatch,
  drawStar,
  drawProgressBar,
  drawIcon,
  drawBubble,
  drawSparkle,
  isPointInButton,
} from './components';
import { TitleScene } from '../scenes/titleScene';
import { LevelSelectScene } from '../scenes/levelSelectScene';
import { ResultsModal } from '../scenes/resultsModal';
import { eventBus } from '../shared/eventBus';
import { saveManager } from '../game/saveManager';
import { sceneManager } from '../core/sceneManager';

// Mock Canvas 2D Context for headless testing
function createMockContext(): CanvasRenderingContext2D {
  return {
    canvas: { width: 1280, height: 720 },
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 100 })),
    clip: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  } as unknown as CanvasRenderingContext2D;
}

describe('Design Tokens (/src/ui/tokens.ts)', () => {
  it('defines vibrant pastel/primary palette colors accurately with 80/20 Clotted Cream and Spruce Velvet', () => {
    expect(COLORS.clottedCream).toBe('#EEE2CB');
    expect(COLORS.spruceVelvet).toBe('#1B4532');
    expect(COLORS.candyPink).toBe('#FF4B72');
    expect(COLORS.sunnyYellow).toBe('#FFD000');
    expect(COLORS.brightCyan).toBe('#00C4FF');
    expect(COLORS.mintGreen).toBe('#00E676');
    expect(COLORS.softOrange).toBe('#FF8A00');
    expect(COLORS.creamWhite).toBe('#FFFDF7');
    expect(COLORS.outlineDark).toBe('#1B4532');
  });

  it('defines rounded child-friendly font family and dimensions', () => {
    expect(FONT_FAMILY).toContain('Nunito');
    expect(FONT_FAMILY).toContain('Comfortaa');
    expect(FONT_FAMILY).toContain('Quicksand');
    expect(FONT_FAMILY).toContain('Comic Sans MS');

    expect(MIN_TOUCH_TARGET).toBe(72);
    expect(BORDER_RADIUS).toBe(16);
    expect(OUTLINE_WIDTH).toBe(4);
    expect(DIMENSIONS.minTouchTarget).toBe(72);
  });

  it('builds CSS font strings correctly with getFont()', () => {
    const font1 = getFont('md', 'bold');
    expect(font1).toContain('800');
    expect(font1).toContain('24px');
    expect(font1).toContain('Nunito');

    const font2 = getFont(36, 900);
    expect(font2).toContain('900');
    expect(font2).toContain('36px');
  });
});

describe('UI Drawing Components (/src/ui/components.ts)', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it('drawRoundedRect draws without error with numeric and corner object radii', () => {
    expect(() => drawRoundedRect(ctx, 10, 10, 100, 50, 16, '#FFF', '#000', 4)).not.toThrow();
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();

    expect(() =>
      drawRoundedRect(ctx, 0, 0, 80, 40, { tl: 8, tr: 12, br: 4, bl: 2 }, '#FFF')
    ).not.toThrow();
  });

  it('drawButton draws 3D button with normal, pressed, and disabled states', () => {
    expect(() =>
      drawButton(ctx, {
        x: 50,
        y: 50,
        w: 200,
        h: 64,
        text: "Let's Play!",
      })
    ).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalledWith(expect.stringContaining("Let's Play!"), expect.any(Number), expect.any(Number));

    // Pressed state
    expect(() =>
      drawButton(ctx, {
        x: 50,
        y: 50,
        w: 200,
        h: 64,
        text: 'Pressed',
        isPressed: true,
      })
    ).not.toThrow();

    // Disabled state
    expect(() =>
      drawButton(ctx, {
        x: 50,
        y: 50,
        w: 200,
        h: 64,
        text: 'Disabled',
        isDisabled: true,
      })
    ).not.toThrow();
  });

  it('isPointInButton correctly detects hits within bounding box', () => {
    const btn = { x: 100, y: 100, w: 200, h: 72 };
    expect(isPointInButton(btn, 150, 130)).toBe(true);
    expect(isPointInButton(btn, 100, 100)).toBe(true);
    expect(isPointInButton(btn, 300, 172)).toBe(true);
    expect(isPointInButton(btn, 99, 130)).toBe(false);
    expect(isPointInButton(btn, 150, 173)).toBe(false);
  });

  it('drawColorSwatch renders swatches with selection and highlight states', () => {
    expect(() => drawColorSwatch(ctx, 20, 20, 64, '#FF4B72', false, false)).not.toThrow();
    // Selected state (draws checkmark)
    expect(() => drawColorSwatch(ctx, 20, 20, 64, '#00C4FF', true, true)).not.toThrow();
  });

  it('drawStar draws filled and unfilled 5-point stars with glow', () => {
    expect(() => drawStar(ctx, 100, 100, 5, 24, 12, true, true)).not.toThrow();
    expect(() => drawStar(ctx, 100, 100, 5, 24, 12, false, false)).not.toThrow();
  });

  it('drawProgressBar clamps progress correctly and draws gloss fill', () => {
    expect(() => drawProgressBar(ctx, 50, 50, 200, 30, 0.75, COLORS.mintGreen)).not.toThrow();
    expect(() => drawProgressBar(ctx, 50, 50, 200, 30, -0.5)).not.toThrow();
    expect(() => drawProgressBar(ctx, 50, 50, 200, 30, 1.5)).not.toThrow();
  });

  it('drawIcon supports all primary UI icons', () => {
    const icons = [
      'play',
      'lock',
      'audio-on',
      'audio-off',
      'sound-on',
      'sound-off',
      'back',
      'arrow-right',
      'arrow-left',
      'replay',
      'menu',
      'check',
      'star',
    ];
    for (const icon of icons) {
      expect(() => drawIcon(ctx, icon, 50, 50, 32)).not.toThrow();
    }
  });

  it('drawBubble and drawSparkle execute without errors', () => {
    expect(() => drawBubble(ctx, 100, 100, 40, COLORS.brightCyan, 0.3)).not.toThrow();
    expect(() => drawSparkle(ctx, 150, 150, 24, COLORS.sunnyYellow, 0.5)).not.toThrow();
  });
});

describe('Title Screen (/src/scenes/titleScene.ts)', () => {
  let scene: TitleScene;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    scene = new TitleScene();
    ctx = createMockContext();
    sceneManager.register(scene);
  });

  it('implements Scene interface properly', () => {
    expect(scene.name).toBe('title');
    expect(typeof scene.enter).toBe('function');
    expect(typeof scene.exit).toBe('function');
    expect(typeof scene.update).toBe('function');
    expect(typeof scene.render).toBe('function');
    expect(typeof scene.onTap).toBe('function');
  });

  it('updates animation timers and renders in landscape and portrait without errors', () => {
    scene.enter();
    scene.update(16);
    expect(() => scene.render(ctx, 1280, 720)).not.toThrow();
    expect(() => scene.render(ctx, 400, 800)).not.toThrow();
  });

  it('clicking Play emits audio:unlock, level:start, and navigates to gameplay', () => {
    const startSpy = vi.fn();
    eventBus.on('level:start', startSpy);

    const switchSpy = vi.spyOn(sceneManager, 'switchTo');

    // Render to set button coordinates
    scene.render(ctx, 1280, 720);

    // Tapping Play button center
    const tapped = scene.handleTap(640, 500);
    expect(tapped).toBe(true);
    expect(startSpy).toHaveBeenCalled();
    expect(switchSpy).toHaveBeenCalledWith('gameplay', expect.any(Object));
  });

  it('toggling audio button updates saveManager settings and emits audio:unlock', () => {
    const unlockSpy = vi.fn();
    eventBus.on('audio:unlock', unlockSpy);

    scene.render(ctx, 1280, 720);

    // Top right audio button
    const audioBtnX = 1280 - DIMENSIONS.safeAreaMargin - 36;
    const audioBtnY = DIMENSIONS.safeAreaMargin + 36;

    const initialMuted = saveManager.getSettings().musicMuted && saveManager.getSettings().sfxMuted;
    scene.handleTap(audioBtnX, audioBtnY);

    const afterMuted = saveManager.getSettings().musicMuted && saveManager.getSettings().sfxMuted;
    expect(afterMuted).toBe(!initialMuted);
    expect(unlockSpy).toHaveBeenCalled();
  });
});

describe('Level Select Screen (/src/scenes/levelSelectScene.ts)', () => {
  let scene: LevelSelectScene;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    scene = new LevelSelectScene();
    ctx = createMockContext();
    sceneManager.register(scene);
  });

  it('implements Scene interface properly', () => {
    expect(scene.name).toBe('levelSelect');
    expect(typeof scene.enter).toBe('function');
    expect(typeof scene.exit).toBe('function');
    expect(typeof scene.update).toBe('function');
    expect(typeof scene.render).toBe('function');
    expect(typeof scene.onTap).toBe('function');
  });

  it('supports 5 pages of 20 levels (1-20, 21-40, 41-60, 61-80, 81-100)', () => {
    scene.render(ctx, 1280, 720);

    // Page 0
    expect(scene['currentPage']).toBe(0);

    // Navigate to next page
    scene.setPage(1);
    expect(scene['currentPage']).toBe(1);

    scene.setPage(4);
    expect(scene['currentPage']).toBe(4);

    // Out of bounds check
    scene.setPage(10);
    expect(scene['currentPage']).toBe(4);
  });

  it('clicking an unlocked level starts the level and switches to gameplay', () => {
    saveManager.recordLevelResult(1, 3, {}); // Unlocks level 2
    scene.goToAppropriatePage();
    scene.render(ctx, 1280, 720);

    const switchSpy = vi.spyOn(sceneManager, 'switchTo');
    const startSpy = vi.fn();
    eventBus.on('level:start', startSpy);

    // Tap level 1 card
    const card1 = scene['visibleLevelCards'].find((c) => c.levelId === 1);
    expect(card1).toBeDefined();

    if (card1) {
      scene.handleTap(card1.x + card1.w / 2, card1.y + card1.h / 2);
      expect(startSpy).toHaveBeenCalledWith({ levelId: 1 });
      expect(switchSpy).toHaveBeenCalledWith('gameplay', { levelId: 1 });
    }
  });

  it('clicking a locked level does not transition and triggers shake feedback', () => {
    scene.setPage(4); // Levels 81-100 (locked by default)
    scene.render(ctx, 1280, 720);

    const switchSpy = vi.spyOn(sceneManager, 'switchTo');
    const lockedCard = scene['visibleLevelCards'].find((c) => !c.isUnlocked);
    expect(lockedCard).toBeDefined();

    if (lockedCard) {
      scene.handleTap(lockedCard.x + lockedCard.w / 2, lockedCard.y + lockedCard.h / 2);
      expect(switchSpy).not.toHaveBeenCalled();
      expect(scene['lockedShakeLevelId']).toBe(lockedCard.levelId);
    }
  });

  it('clicking Back button navigates to Title', () => {
    scene.render(ctx, 1280, 720);
    const switchSpy = vi.spyOn(sceneManager, 'switchTo');

    const backBtn = scene['backBtnRect'];
    scene.handleTap(backBtn.x + backBtn.w / 2, backBtn.y + backBtn.h / 2);
    expect(switchSpy).toHaveBeenCalledWith('title');
  });
});

describe('Results Modal (/src/scenes/resultsModal.ts)', () => {
  let modal: ResultsModal;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    modal = new ResultsModal();
    ctx = createMockContext();
    sceneManager.register(modal);
  });

  it('implements Scene interface properly and functions as overlay', () => {
    expect(modal.name).toBe('results');
    expect(typeof modal.enter).toBe('function');
    expect(typeof modal.exit).toBe('function');
    expect(typeof modal.update).toBe('function');
    expect(typeof modal.render).toBe('function');
    expect(typeof modal.onTap).toBe('function');
    expect(typeof modal.show).toBe('function');
    expect(typeof modal.hide).toBe('function');
  });

  it('displays correct banner and records progress on 3 stars', () => {
    modal.show(5, {
      totalRegions: 4,
      correctRegions: 4,
      accuracy: 1.0,
      stars: 3,
    });

    expect(modal.isOpen()).toBe(true);
    expect(saveManager.getStarsForLevel(5)).toBe(3);

    modal.update(1000);
    expect(() => modal.render(ctx, 1280, 720)).not.toThrow();
  });

  it('action button Next Level navigates to next level', () => {
    modal.show(3, {
      totalRegions: 2,
      correctRegions: 2,
      accuracy: 1.0,
      stars: 3,
    });

    modal.render(ctx, 1280, 720);
    const switchSpy = vi.spyOn(sceneManager, 'switchTo');

    const nextBtn = modal['nextBtnRect'];
    modal.handleTap(nextBtn.x + nextBtn.w / 2, nextBtn.y + nextBtn.h / 2);

    expect(switchSpy).toHaveBeenCalledWith('gameplay', { levelId: 4 });
    expect(modal.isOpen()).toBe(false);
  });

  it('action button Replay navigates to current level', () => {
    modal.show(3, {
      totalRegions: 2,
      correctRegions: 1,
      accuracy: 0.5,
      stars: 1,
    });

    modal.render(ctx, 1280, 720);
    const switchSpy = vi.spyOn(sceneManager, 'switchTo');

    const replayBtn = modal['replayBtnRect'];
    modal.handleTap(replayBtn.x + replayBtn.w / 2, replayBtn.y + replayBtn.h / 2);

    expect(switchSpy).toHaveBeenCalledWith('gameplay', { levelId: 3 });
    expect(modal.isOpen()).toBe(false);
  });

  it('action button Level Select navigates to levelSelect scene', () => {
    modal.show(3, {
      totalRegions: 2,
      correctRegions: 1,
      accuracy: 0.5,
      stars: 1,
    });

    modal.render(ctx, 1280, 720);
    const switchSpy = vi.spyOn(sceneManager, 'switchTo');

    const selectBtn = modal['levelSelectBtnRect'];
    modal.handleTap(selectBtn.x + selectBtn.w / 2, selectBtn.y + selectBtn.h / 2);

    expect(switchSpy).toHaveBeenCalledWith('levelSelect');
    expect(modal.isOpen()).toBe(false);
  });
});
