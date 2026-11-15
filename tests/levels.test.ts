import { describe, it, expect } from 'vitest';
import { LEVELS, getLevel, getLevelsByCategory, getTotalLevelCount } from '../src/game/levelsData';
import type { LevelCategory, ShapeKind } from '../src/shared/contracts';
import { TOTAL_LEVELS, CATEGORY_RANGES } from '../src/shared/constants';

describe('100 Levels Verification Suite', () => {
  const VALID_CATEGORIES: LevelCategory[] = [
    'tutorial',
    'basic_shapes',
    'simple_objects',
    'animals',
    'nature',
    'scenes',
    'master',
  ];

  const VALID_SHAPES: ShapeKind[] = [
    'circle',
    'ellipse',
    'rect',
    'roundRect',
    'polygon',
    'star',
    'heart',
    'arc',
    'ring',
  ];

  it('contains exactly 100 levels', () => {
    expect(getTotalLevelCount()).toBe(TOTAL_LEVELS);
    expect(LEVELS.length).toBe(100);
  });

  it('has sequential IDs from 1 to 100 without gaps or duplicates', () => {
    LEVELS.forEach((level, idx) => {
      expect(level.id).toBe(idx + 1);
    });
  });

  it('ensures every level has valid name, category, and difficulty', () => {
    for (const level of LEVELS) {
      expect(typeof level.name).toBe('string');
      expect(level.name.trim().length).toBeGreaterThan(0);

      expect(VALID_CATEGORIES).toContain(level.category);

      expect(typeof level.difficulty).toBe('number');
      expect(Number.isInteger(level.difficulty)).toBe(true);
      expect(level.difficulty).toBeGreaterThanOrEqual(1);
      expect(level.difficulty).toBeLessThanOrEqual(10);
    }
  });

  it('ensures every level has at least 1 region and valid palette', () => {
    for (const level of LEVELS) {
      expect(Array.isArray(level.regions)).toBe(true);
      expect(level.regions.length).toBeGreaterThanOrEqual(1);

      expect(Array.isArray(level.palette)).toBe(true);
      expect(level.palette.length).toBeGreaterThanOrEqual(2);

      // Validate hex format
      for (const hex of level.palette) {
        expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it('ensures every region has a valid shape and valid targetColor matching its palette', () => {
    for (const level of LEVELS) {
      const paletteLower = level.palette.map((c) => c.toLowerCase());

      for (const region of level.regions) {
        expect(typeof region.id).toBe('string');
        expect(region.id.length).toBeGreaterThan(0);

        expect(VALID_SHAPES).toContain(region.shape);

        expect(typeof region.targetColor).toBe('string');
        expect(region.targetColor).toMatch(/^#[0-9A-Fa-f]{6}$/);

        // targetColor must match its level palette
        expect(paletteLower).toContain(region.targetColor.toLowerCase());

        // Validate shape coordinate specifics
        if (region.shape === 'circle') {
          expect(Number.isFinite(region.cx)).toBe(true);
          expect(Number.isFinite(region.cy)).toBe(true);
          expect(Number.isFinite(region.r)).toBe(true);
          expect(region.r).toBeGreaterThan(0);
        } else if (region.shape === 'rect' || region.shape === 'roundRect') {
          expect(Number.isFinite(region.x)).toBe(true);
          expect(Number.isFinite(region.y)).toBe(true);
          expect(Number.isFinite(region.w)).toBe(true);
          expect(Number.isFinite(region.h)).toBe(true);
        } else if (region.shape === 'polygon') {
          expect(region.points.length).toBeGreaterThanOrEqual(6);
          region.points.forEach((p) => expect(Number.isFinite(p)).toBe(true));
        } else if (region.shape === 'star') {
          expect(Number.isFinite(region.cx)).toBe(true);
          expect(Number.isFinite(region.cy)).toBe(true);
          expect(region.outerR).toBeGreaterThan(region.innerR);
        } else if (region.shape === 'ring') {
          expect(Number.isFinite(region.cx)).toBe(true);
          expect(Number.isFinite(region.cy)).toBe(true);
          expect(region.outerR).toBeGreaterThan(region.innerR);
        } else if (region.shape === 'arc') {
          expect(Number.isFinite(region.cx)).toBe(true);
          expect(Number.isFinite(region.cy)).toBe(true);
          expect(region.r).toBeGreaterThan(0);
          expect(Number.isFinite(region.startAngle)).toBe(true);
          expect(Number.isFinite(region.endAngle)).toBe(true);
        }
      }
    }
  });

  it('verifies Level 1 is a tutorial circle', () => {
    const lvl1 = getLevel(1);
    expect(lvl1).toBeDefined();
    expect(lvl1?.id).toBe(1);
    expect(lvl1?.category).toBe('tutorial');
    expect(lvl1?.name.toLowerCase()).toContain('circle');
    expect(lvl1?.regions.length).toBeGreaterThanOrEqual(1);

    const circle = lvl1?.regions[0];
    expect(circle?.shape).toBe('circle');
  });

  it('verifies Level 51 is the 7-layer Rainbow', () => {
    const lvl51 = getLevel(51);
    expect(lvl51).toBeDefined();
    expect(lvl51?.id).toBe(51);
    expect(lvl51?.category).toBe('nature');
    expect(lvl51?.name.toLowerCase()).toContain('rainbow');

    // Exactly 7 layers
    expect(lvl51?.regions).toHaveLength(7);
    for (const r of lvl51!.regions) {
      expect(r.shape).toBe('arc');
    }
    expect(lvl51?.palette.length).toBeGreaterThanOrEqual(7);
  });

  it('verifies category distribution matches CATEGORY_RANGES', () => {
    for (const [catName, range] of Object.entries(CATEGORY_RANGES)) {
      for (let id = range.start; id <= range.end; id++) {
        const lvl = getLevel(id);
        expect(lvl).toBeDefined();
        expect(lvl!.category).toBe(catName);
      }
    }
  });

  it('correctly retrieves levels by category', () => {
    const tutorials = getLevelsByCategory('tutorial');
    expect(tutorials.length).toBe(5);

    const basicShapes = getLevelsByCategory('basic_shapes');
    expect(basicShapes.length).toBe(10);

    const simpleObjects = getLevelsByCategory('simple_objects');
    expect(simpleObjects.length).toBe(15);

    const animals = getLevelsByCategory('animals');
    expect(animals.length).toBe(20);

    const nature = getLevelsByCategory('nature');
    expect(nature.length).toBe(20);

    const scenes = getLevelsByCategory('scenes');
    expect(scenes.length).toBe(15);

    const master = getLevelsByCategory('master');
    expect(master.length).toBe(15);
  });
});
