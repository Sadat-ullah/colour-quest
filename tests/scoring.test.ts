import { describe, it, expect, beforeEach } from 'vitest';
import { ColoringEngine } from '../src/game/coloringEngine';
import { STAR_THRESHOLDS } from '../src/shared/constants';
import type { LevelData } from '../src/shared/contracts';

describe('Scoring Algorithm Tests', () => {
  let engine: ColoringEngine;

  const createMockLevel = (numRegions: number): LevelData => {
    return {
      id: 999,
      name: 'Test Level',
      category: 'basic_shapes',
      difficulty: 1,
      palette: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'],
      regions: Array.from({ length: numRegions }, (_, i) => ({
        id: `r${i + 1}`,
        shape: 'circle',
        cx: 100 * (i + 1),
        cy: 100,
        r: 30,
        targetColor: i % 2 === 0 ? '#FF0000' : '#00FF00',
      })),
    };
  };

  beforeEach(() => {
    engine = new ColoringEngine();
  });

  it('verifies STAR_THRESHOLDS constant alignment (100% = 3 stars, 70% = 2 stars, 40% = 1 star)', () => {
    expect(STAR_THRESHOLDS[3]).toBe(1.0);
    expect(STAR_THRESHOLDS[2]).toBe(0.7);
    expect(STAR_THRESHOLDS[1]).toBe(0.4);
  });

  it('awards 3 stars for 100% accuracy', () => {
    const level = createMockLevel(10);
    engine.loadLevel(level);

    // Fill all 10 correctly
    for (const region of level.regions) {
      engine.fillRegion(region.id, region.targetColor);
    }

    const score = engine.calculateScoring();
    expect(score.totalRegions).toBe(10);
    expect(score.correctRegions).toBe(10);
    expect(score.accuracy).toBe(1.0);
    expect(score.stars).toBe(3);
  });

  it('awards 2 stars for 70% to 99% accuracy', () => {
    const level = createMockLevel(10);
    engine.loadLevel(level);

    // Fill 7 correctly and 3 incorrectly (70% accuracy)
    level.regions.forEach((region, idx) => {
      if (idx < 7) {
        engine.fillRegion(region.id, region.targetColor);
      } else {
        engine.fillRegion(region.id, '#FFFF00'); // wrong color
      }
    });

    const score70 = engine.calculateScoring();
    expect(score70.totalRegions).toBe(10);
    expect(score70.correctRegions).toBe(7);
    expect(score70.accuracy).toBeCloseTo(0.7);
    expect(score70.stars).toBe(2);

    // Test 80% accuracy
    engine.fillRegion(level.regions[7].id, level.regions[7].targetColor);
    const score80 = engine.calculateScoring();
    expect(score80.correctRegions).toBe(8);
    expect(score80.accuracy).toBeCloseTo(0.8);
    expect(score80.stars).toBe(2);

    // Test 90% accuracy
    engine.fillRegion(level.regions[8].id, level.regions[8].targetColor);
    const score90 = engine.calculateScoring();
    expect(score90.correctRegions).toBe(9);
    expect(score90.accuracy).toBeCloseTo(0.9);
    expect(score90.stars).toBe(2);
  });

  it('awards 1 star for 40% to 69% accuracy', () => {
    const level = createMockLevel(10);
    engine.loadLevel(level);

    // Fill 4 correctly and 6 incorrectly (40% accuracy)
    level.regions.forEach((region, idx) => {
      if (idx < 4) {
        engine.fillRegion(region.id, region.targetColor);
      } else {
        engine.fillRegion(region.id, '#FFFF00');
      }
    });

    const score40 = engine.calculateScoring();
    expect(score40.totalRegions).toBe(10);
    expect(score40.correctRegions).toBe(4);
    expect(score40.accuracy).toBeCloseTo(0.4);
    expect(score40.stars).toBe(1);

    // Test 50% accuracy
    engine.fillRegion(level.regions[4].id, level.regions[4].targetColor);
    const score50 = engine.calculateScoring();
    expect(score50.correctRegions).toBe(5);
    expect(score50.accuracy).toBeCloseTo(0.5);
    expect(score50.stars).toBe(1);

    // Test 60% accuracy
    engine.fillRegion(level.regions[5].id, level.regions[5].targetColor);
    const score60 = engine.calculateScoring();
    expect(score60.correctRegions).toBe(6);
    expect(score60.accuracy).toBeCloseTo(0.6);
    expect(score60.stars).toBe(1);
  });

  it('handles lower accuracies (< 40%) gracefully giving 1 completion star', () => {
    const level = createMockLevel(10);
    engine.loadLevel(level);

    // Fill only 2 correctly (20%)
    level.regions.forEach((region, idx) => {
      if (idx < 2) {
        engine.fillRegion(region.id, region.targetColor);
      } else {
        engine.fillRegion(region.id, '#FFFF00');
      }
    });

    const score20 = engine.calculateScoring();
    expect(score20.accuracy).toBeCloseTo(0.2);
    expect(score20.stars).toBe(1);
  });

  it('matches colours case-insensitively', () => {
    const level = createMockLevel(2);
    engine.loadLevel(level);

    // Target is #FF0000, fill with lowercase #ff0000
    engine.fillRegion(level.regions[0].id, '#ff0000');
    // Target is #00FF00, fill with #00ff00
    engine.fillRegion(level.regions[1].id, '#00ff00');

    const score = engine.calculateScoring();
    expect(score.correctRegions).toBe(2);
    expect(score.accuracy).toBe(1.0);
    expect(score.stars).toBe(3);
  });

  it('single region level: 1/1 = 3 stars, 0/1 = 1 star', () => {
    const level = createMockLevel(1);
    engine.loadLevel(level);

    // Correct
    engine.fillRegion(level.regions[0].id, level.regions[0].targetColor);
    expect(engine.calculateScoring().stars).toBe(3);

    // Wrong
    engine.fillRegion(level.regions[0].id, '#000000');
    expect(engine.calculateScoring().stars).toBe(1);
  });

  it('returns default 3 stars for empty level or no level loaded', () => {
    const emptyEngine = new ColoringEngine();
    const result = emptyEngine.calculateScoring();
    expect(result.stars).toBe(3);
    expect(result.totalRegions).toBe(0);
    expect(result.accuracy).toBe(1);
  });
});
