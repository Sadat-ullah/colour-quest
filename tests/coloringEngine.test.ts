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

  describe('Region & Color Selection', () => {
    beforeEach(() => {
      engine.loadLevel(mockLevel);
    });

    it('selects region without filling if no color is pre-selected', () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      const result = engine.selectRegion('r_circle_1');

      expect(result.filled).toBe(false);
      expect(engine.getSelectedRegionId()).toBe('r_circle_1');
      expect(emitSpy).toHaveBeenCalledWith('region:selected', { regionId: 'r_circle_1' });
      emitSpy.mockRestore();
    });

    it('selects color without filling if no region is pre-selected and does not stick', () => {
      const result = engine.selectColor('#FF5722');
      expect(result.filled).toBe(false);
      expect(engine.getSelectedColor()).toBeNull();
    });

    it('immediately fills region when selecting color after container is selected and resets', () => {
      engine.selectRegion('r_circle_1');
      const fillResult = engine.selectColor('#FF5722');

      expect(fillResult.filled).toBe(true);
      expect(fillResult.regionId).toBe('r_circle_1');
      expect(fillResult.correct).toBe(true);
      expect(engine.getFilledColor('r_circle_1')).toBe('#FF5722');

      // Crucial: Step C immediate reset
      expect(engine.getSelectedRegionId()).toBeNull();
      expect(engine.getSelectedColor()).toBeNull();
    });

    it('tapping 2nd container never auto-fills previous color', () => {
      // 1st container filled
      engine.selectRegion('r_circle_1');
      engine.selectColor('#FF5722');
      expect(engine.getFilledColor('r_circle_1')).toBe('#FF5722');
      expect(engine.getSelectedColor()).toBeNull();

      // Tap 2nd container
      const result = engine.selectRegion('r_circle_2');
      expect(result.filled).toBe(false);
      expect(engine.getFilledColor('r_circle_2')).toBeNull();
      expect(engine.getSelectedRegionId()).toBe('r_circle_2');
      expect(engine.getSelectedColor()).toBeNull();

      // Now fill 2nd container with its own color
      const fill2 = engine.selectColor('#4CAF50');
      expect(fill2.filled).toBe(true);
      expect(fill2.regionId).toBe('r_circle_2');
      expect(engine.getFilledColor('r_circle_2')).toBe('#4CAF50');
      expect(engine.getSelectedRegionId()).toBeNull();
    });

    it('clears selection via clearSelection()', () => {
      engine.selectRegion('r_circle_1');
      engine.selectColor('#2196F3');
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

    it('requires a container to be selected before granting a hint', () => {
      expect(engine.getSelectedRegionId()).toBeNull();
      const res = engine.requestHint();

      expect(res.success).toBe(false);
      expect(res.reason).toBe('no_selection');
      expect(engine.isHintUsed()).toBe(false);
      expect(engine.getHintedColor()).toBeNull();
    });

    it('grants a hint for selected container and reveals matching target color', () => {
      engine.selectRegion('r_circle_1');
      const res = engine.requestHint();

      expect(res.success).toBe(true);
      expect(res.targetColor).toBe('#FF5722');
      expect(res.regionId).toBe('r_circle_1');
      expect(engine.isHintUsed()).toBe(true);
      expect(engine.getHintedColor()).toBe('#FF5722');

      // Crucial: hint does NOT automatically fill the container!
      expect(engine.getFilledColor('r_circle_1')).toBeNull();
    });

    it('enforces strictly one hint per level attempt', () => {
      engine.selectRegion('r_circle_1');
      const firstHint = engine.requestHint();
      expect(firstHint.success).toBe(true);
      expect(engine.isHintUsed()).toBe(true);

      // Try requesting a second hint on another container
      engine.selectRegion('r_circle_2');
      const secondHint = engine.requestHint();
      expect(secondHint.success).toBe(false);
      expect(secondHint.reason).toBe('already_used');
    });

    it('clears hinted color after user selects a color to fill container', () => {
      engine.selectRegion('r_circle_1');
      engine.requestHint();
      expect(engine.getHintedColor()).toBe('#FF5722');

      engine.selectColor('#FF5722');
      expect(engine.getFilledColor('r_circle_1')).toBe('#FF5722');
      expect(engine.getHintedColor()).toBeNull();
      // But hint remains marked as used
      expect(engine.isHintUsed()).toBe(true);
    });

    it('resets hint state when level is reset or reloaded', () => {
      engine.selectRegion('r_circle_1');
      engine.requestHint();
      expect(engine.isHintUsed()).toBe(true);

      engine.resetCurrentLevel();
      expect(engine.isHintUsed()).toBe(false);
      expect(engine.getHintedColor()).toBeNull();

      // Reloading level also resets hint
      engine.loadLevel(mockLevel);
      expect(engine.isHintUsed()).toBe(false);
      expect(engine.getHintedColor()).toBeNull();
    });
  });
});
