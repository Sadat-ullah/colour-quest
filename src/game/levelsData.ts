/* ─────────────────────────────────────────────────────────────
 *  levelsData.ts – Colour Quest 100-Level Data & Accessors
 *  Agent A2: Level Designer & Data Architect
 * ───────────────────────────────────────────────────────────── */
import type { LevelData, LevelCategory } from '../shared/contracts';
import rawLevels from '../data/levels.json';

/**
 * All 100 levels typed according to the frozen contracts.
 */
export const LEVELS: LevelData[] = rawLevels as LevelData[];

/**
 * Retrieve a specific level by its 1-based numerical ID.
 * Returns undefined if level ID is out of bounds [1..100].
 */
export function getLevel(id: number): LevelData | undefined {
  if (id < 1 || id > LEVELS.length) {
    return undefined;
  }
  return LEVELS[id - 1];
}

/**
 * Retrieve all levels belonging to a specific category.
 */
export function getLevelsByCategory(category: LevelCategory): LevelData[] {
  return LEVELS.filter((lvl) => lvl.category === category);
}

/**
 * Total number of designed levels.
 */
export function getTotalLevels(): number {
  return LEVELS.length;
}

/**
 * Alias for getTotalLevels matching test suites and external callers.
 */
export function getTotalLevelCount(): number {
  return LEVELS.length;
}

/**
 * Validates whether an ID corresponds to an existing level.
 */
export function isValidLevelId(id: number): boolean {
  return id >= 1 && id <= LEVELS.length;
}

/**
 * Retrieves the next level in progression, or undefined if at the last level.
 */
export function getNextLevel(currentId: number): LevelData | undefined {
  return getLevel(currentId + 1);
}

/**
 * Retrieves the previous level in progression, or undefined if at the first level.
 */
export function getPreviousLevel(currentId: number): LevelData | undefined {
  return getLevel(currentId - 1);
}

/**
 * Ordered list of all 7 level categories in progression sequence.
 */
export const LEVEL_CATEGORIES: LevelCategory[] = [
  'tutorial',
  'basic_shapes',
  'simple_objects',
  'animals',
  'nature',
  'scenes',
  'master',
];

/**
 * Helper to fetch levels from the public static endpoint if dynamic runtime loading is preferred.
 */
export async function loadLevelsFromPublic(): Promise<LevelData[]> {
  try {
    const res = await fetch('/data/levels.json');
    if (!res.ok) {
      throw new Error(`Failed to fetch /data/levels.json: HTTP ${res.status}`);
    }
    const data = (await res.json()) as LevelData[];
    return data;
  } catch (err) {
    console.warn('[levelsData] Fallback to embedded LEVELS array due to fetch error:', err);
    return LEVELS;
  }
}
