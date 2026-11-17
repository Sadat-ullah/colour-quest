import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ColoringEngine } from '../src/game/coloringEngine';
import { eventBus } from '../src/shared/eventBus';
import type { LevelData } from '../src/shared/contracts';

describe('ColoringEngine Tests', () => {
  let engine: ColoringEngine;

  const mockLevel: LevelData = {
    id: 1,
    name: 'Tutorial Circle',
    category: 'tutorial',
    difficulty: 1,
    palette: ['#FF5722', '#4CAF50', '#2196F3'],
    regions: [
      {
        id: 'r_circle_1',
        shape: 'circle',
        cx: 200,
        cy: 200,
        r: 80,
        targetColor: '#FF5722',
        label: 'Circle',
      },
      {
        id: 'r_circle_2',
        shape: 'circle',
        cx: 350,
        cy: 200,
        r: 50,
        targetColor: '#4CAF50',
        label: 'Inner Circle',
      },
    ],
  };

  beforeEach(() => {
    engine = new ColoringEngine();
  });

  describe('Level Loading and Initialization', () => {
    it('initializes with null level and empty state', () => {
      expect(engine.getLevel()).toBeNull();
      expect(engine.getSelectedRegionId()).toBeNull();
      expect(engine.getSelectedColor()).toBeNull();
      expect(engine.getFilledColors().size).toBe(0);
      expect(engine.isAllRegionsFilled()).toBe(false);
    });

    it('loads level, emits level:start event and clears previous state', () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      engine.loadLevel(mockLevel);

      expect(engine.getLevel()).toEqual(mockLevel);
      expect(engine.getSelectedRegionId()).toBeNull();
      expect(engine.getSelectedColor()).toBeNull();
      expect(engine.getFilledColors().size).toBe(0);
      expect(emitSpy).toHaveBeenCalledWith('level:start', { levelId: 1 });
      emitSpy.mockRestore();
    });
  });

  describe('Region & Color Selection (Colour-First Flow)', () => {
    beforeEach(() => {
      engine.loadLevel(mockLevel);
    });

    it('selects region without filling if no crayon color is equipped', () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      const result = engine.selectRegion('r_circle_1');

      expect(result.filled).toBe(false);
      expect(result.reason).toBe('no_color');
      expect(engine.getSelectedRegionId()).toBe('r_circle_1');
      expect(engine.getFilledColor('r_circle_1')).toBeNull();
      expect(emitSpy).toHaveBeenCalledWith('region:selected', { regionId: 'r_circle_1' });
      emitSpy.mockRestore();
    });

    it('equips crayon color upon selectColor() and emits color:selected', () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      const result = engine.selectColor('#FF5722');

      expect(result.equipped).toBe(true);
      expect(result.color).toBe('#FF5722');
      expect(engine.getSelectedColor()).toBe('#FF5722');
      expect(emitSpy).toHaveBeenCalledWith('color:selected', { color: '#FF5722' });
      emitSpy.mockRestore();
    });

    it('immediately paints region when tapping shape while crayon is equipped', () => {
      engine.selectColor('#FF5722');
      const fillResult = engine.selectRegion('r_circle_1');

      expect(fillResult.filled).toBe(true);
      expect(fillResult.regionId).toBe('r_circle_1');
      expect(fillResult.color).toBe('#FF5722');
      expect(fillResult.correct).toBe(true);
      expect(engine.getFilledColor('r_circle_1')).toBe('#FF5722');
    });

    it('focus is removed from crayon after colouring a shape and user must tap crayon again', () => {
      engine.selectColor('#FF5722');
      expect(engine.getSelectedColor()).toBe('#FF5722');

      // 1st shape painted
      const fill1 = engine.selectRegion('r_circle_1');
      expect(fill1.filled).toBe(true);
      expect(engine.getFilledColor('r_circle_1')).toBe('#FF5722');
      // Crucial: Focus is immediately removed from the crayon
      expect(engine.getSelectedColor()).toBeNull();

      // Tapping 2nd shape without selecting crayon first does NOT fill
      const fill2 = engine.selectRegion('r_circle_2');
      expect(fill2.filled).toBe(false);
      expect(fill2.reason).toBe('no_color');
      expect(engine.getFilledColor('r_circle_2')).toBeNull();

      // User taps crayon again to colour 2nd shape
      engine.selectColor('#4CAF50');
      expect(engine.getSelectedColor()).toBe('#4CAF50');
      const fill3 = engine.selectRegion('r_circle_2');
      expect(fill3.filled).toBe(true);
      expect(engine.getFilledColor('r_circle_2')).toBe('#4CAF50');
      expect(engine.getSelectedColor()).toBeNull();
    });

    it('clears selection via clearSelection()', () => {
      engine.selectColor('#2196F3');
      expect(engine.getSelectedColor()).toBe('#2196F3');

      engine.clearSelection();
      expect(engine.getSelectedRegionId()).toBeNull();
      expect(engine.getSelectedColor()).toBeNull();
    });
  });

  describe('Filling & Validation Logic', () => {
    beforeEach(() => {
      engine.loadLevel(mockLevel);
    });

    it('fills region directly and identifies correct color match', () => {
      const result = engine.fillRegion('r_circle_1', '#FF5722');
      expect(result.success).toBe(true);
      expect(result.correct).toBe(true);
      expect(engine.getFilledColor('r_circle_1')).toBe('#FF5722');
    });

    it('identifies incorrect color match', () => {
      const result = engine.fillRegion('r_circle_1', '#2196F3');
      expect(result.success).toBe(true);
      expect(result.correct).toBe(false);
      expect(engine.getFilledColor('r_circle_1')).toBe('#2196F3');
    });

    it('fails to fill non-existent region', () => {
      const result = engine.fillRegion('invalid_region', '#FF5722');
      expect(result.success).toBe(false);
      expect(result.correct).toBe(false);
    });

    it('fails to fill when no level is loaded', () => {
      const emptyEngine = new ColoringEngine();
      const result = emptyEngine.fillRegion('r_circle_1', '#FF5722');
      expect(result.success).toBe(false);
    });
  });

  describe('Completion Check (isAllRegionsFilled)', () => {
    beforeEach(() => {
      engine.loadLevel(mockLevel);
    });

    it('returns false initially when no regions are filled', () => {
      expect(engine.isAllRegionsFilled()).toBe(false);
    });

    it('returns false when partially filled', () => {
      engine.fillRegion('r_circle_1', '#FF5722');
      expect(engine.isAllRegionsFilled()).toBe(false);
    });

    it('returns true when all regions are filled', () => {
      engine.fillRegion('r_circle_1', '#FF5722');
      engine.fillRegion('r_circle_2', '#4CAF50');
      expect(engine.isAllRegionsFilled()).toBe(true);
    });

    it('returns true even if wrong colors are used, as long as every region has a color', () => {
      engine.fillRegion('r_circle_1', '#2196F3');
      engine.fillRegion('r_circle_2', '#2196F3');
      expect(engine.isAllRegionsFilled()).toBe(true);
    });
  });

  describe('Similarity Calculation & Scoring', () => {
    beforeEach(() => {
      engine.loadLevel(mockLevel);
    });

    it('calculates 100% similarity (accuracy 1.0) with 3 stars when all match', () => {
      engine.fillRegion('r_circle_1', '#FF5722');
      engine.fillRegion('r_circle_2', '#4CAF50');

      const score = engine.calculateScoring();
      expect(score.totalRegions).toBe(2);
      expect(score.correctRegions).toBe(2);
      expect(score.accuracy).toBe(1.0);
      expect(score.stars).toBe(3);
    });

    it('calculates 50% similarity (accuracy 0.5) with 1 star when 1 of 2 matches', () => {
      engine.fillRegion('r_circle_1', '#FF5722'); // correct
      engine.fillRegion('r_circle_2', '#2196F3'); // wrong

      const score = engine.calculateScoring();
      expect(score.totalRegions).toBe(2);
      expect(score.correctRegions).toBe(1);
      expect(score.accuracy).toBe(0.5);
      expect(score.stars).toBe(1);
    });

    it('calculates 0% similarity (accuracy 0.0) with 1 star when 0 of 2 match', () => {
      engine.fillRegion('r_circle_1', '#2196F3');
      engine.fillRegion('r_circle_2', '#2196F3');

      const score = engine.calculateScoring();
      expect(score.totalRegions).toBe(2);
      expect(score.correctRegions).toBe(0);
      expect(score.accuracy).toBe(0.0);
      expect(score.stars).toBe(1);
    });
  });

  describe('Undo & Reset Operations', () => {
    beforeEach(() => {
      engine.loadLevel(mockLevel);
    });

    it('undo reverts filled region back to empty', () => {
      engine.fillRegion('r_circle_1', '#FF5722');
      expect(engine.getFilledColor('r_circle_1')).toBe('#FF5722');

      const undone = engine.undo();
      expect(undone).toBe(true);
      expect(engine.getFilledColor('r_circle_1')).toBeNull();
    });

    it('undo restores previous color when overwriting', () => {
      engine.fillRegion('r_circle_1', '#FF5722');
      engine.fillRegion('r_circle_1', '#2196F3');
      expect(engine.getFilledColor('r_circle_1')).toBe('#2196F3');

      engine.undo();
      expect(engine.getFilledColor('r_circle_1')).toBe('#FF5722');
    });

    it('undo returns false when history is empty', () => {
      expect(engine.undo()).toBe(false);
    });

    it('undo restores filled region to previous state', () => {
      engine.fillRegion('r_circle_1', '#FF5722');
      expect(engine.getFilledColor('r_circle_1')).toBe('#FF5722');

      engine.undo();
      expect(engine.getFilledColor('r_circle_1')).toBeNull();
    });

    it('resetCurrentLevel clears filled colors and history', () => {
      engine.fillRegion('r_circle_1', '#FF5722');
      engine.fillRegion('r_circle_2', '#4CAF50');
      engine.resetCurrentLevel();

      expect(engine.getFilledColors().size).toBe(0);
      expect(engine.isAllRegionsFilled()).toBe(false);
      expect(engine.undo()).toBe(false);
    });
  });

  describe('Interactive Hint Mechanics & Single-Use Enforcement', () => {
    beforeEach(() => {
      engine.loadLevel(mockLevel);
    });

    it('grants a hint in Colour-First flow by identifying the first unpainted shape and revealing its target crayon', () => {
      expect(engine.isHintUsed()).toBe(false);
      const res = engine.requestHint();

      expect(res.success).toBe(true);
      expect(res.targetColor).toBe('#FF5722');
      expect(res.regionId).toBe('r_circle_1');
      expect(engine.isHintUsed()).toBe(true);
      expect(engine.getHintedColor()).toBe('#FF5722');
      expect(engine.getHintedRegionId()).toBe('r_circle_1');

      // Crucial: hint highlights the crayon/shape but does NOT auto-fill it!
      expect(engine.getFilledColor('r_circle_1')).toBeNull();
    });

    it('identifies first incorrectly painted shape if earlier shape is already filled', () => {
      // Circle 1 correctly filled, Circle 2 filled with wrong color
      engine.fillRegion('r_circle_1', '#FF5722');
      engine.fillRegion('r_circle_2', '#FF5722'); // incorrect! Target is #4CAF50

      const res = engine.requestHint();
      expect(res.success).toBe(true);
      expect(res.regionId).toBe('r_circle_2');
      expect(res.targetColor).toBe('#4CAF50');
      expect(engine.getHintedColor()).toBe('#4CAF50');
      expect(engine.getHintedRegionId()).toBe('r_circle_2');
    });

    it('enforces strictly one hint per level attempt', () => {
      const firstHint = engine.requestHint();
      expect(firstHint.success).toBe(true);
      expect(engine.isHintUsed()).toBe(true);

      // Try requesting a second hint
      const secondHint = engine.requestHint();
      expect(secondHint.success).toBe(false);
      expect(secondHint.reason).toBe('already_used');
    });

    it('clears active hinted color and region after user paints the hinted shape', () => {
      engine.requestHint();
      expect(engine.getHintedColor()).toBe('#FF5722');
      expect(engine.getHintedRegionId()).toBe('r_circle_1');

      engine.selectColor('#FF5722');
      engine.selectRegion('r_circle_1');

      expect(engine.getFilledColor('r_circle_1')).toBe('#FF5722');
      expect(engine.getHintedColor()).toBeNull();
      expect(engine.getHintedRegionId()).toBeNull();
      // But hint remains marked as used
      expect(engine.isHintUsed()).toBe(true);
    });

    it('preserves hintUsed when level is cleared, only resets on level reload', () => {
      engine.requestHint();
      expect(engine.isHintUsed()).toBe(true);

      // Clearing the level must NOT re-enable the hint for the same level attempt
      engine.resetCurrentLevel();
      expect(engine.isHintUsed()).toBe(true);
      expect(engine.getHintedColor()).toBeNull();
      expect(engine.getHintedRegionId()).toBeNull();

      // Only loading / starting a new level resets hint
      engine.loadLevel(mockLevel);
      expect(engine.isHintUsed()).toBe(false);
      expect(engine.getHintedColor()).toBeNull();
      expect(engine.getHintedRegionId()).toBeNull();
    });
  });
});
