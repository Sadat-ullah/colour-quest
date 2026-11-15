import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { SAVE_KEY, SAVE_VERSION, MUSIC_DEFAULT_VOL, SFX_DEFAULT_VOL, TOTAL_LEVELS } from '../src/shared/constants';
import { eventBus } from '../src/shared/eventBus';

class LocalStorageMock implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

const mockStorage = new LocalStorageMock();
Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
  configurable: true,
});

describe('SaveManager Tests', async () => {
  const { SaveManager } = await import('../src/game/saveManager');
  let saveManager: InstanceType<typeof SaveManager>;

  beforeEach(() => {
    localStorage.clear();
    saveManager = new SaveManager();
  });

  describe('Default Progress Initialization', () => {
    it('initializes with default values when localStorage is empty', () => {
      const progress = saveManager.getProgress();
      expect(progress.version).toBe(SAVE_VERSION);
      expect(progress.currentLevel).toBe(1);
      expect(progress.highestUnlocked).toBe(1);
      expect(progress.results).toEqual({});
      expect(progress.settings).toEqual({
        musicVolume: MUSIC_DEFAULT_VOL,
        sfxVolume: SFX_DEFAULT_VOL,
        musicMuted: false,
        sfxMuted: false,
      });
    });

    it('identifies Level 1 as unlocked initially, while Level 2 is locked', () => {
      expect(saveManager.isLevelUnlocked(1)).toBe(true);
      expect(saveManager.isLevelUnlocked(2)).toBe(false);
      expect(saveManager.isLevelUnlocked(100)).toBe(false);
    });
  });

  describe('Persistence to localStorage', () => {
    it('persists progress changes to localStorage', () => {
      saveManager.setCurrentLevel(5);
      const raw = localStorage.getItem(SAVE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.currentLevel).toBe(5);
    });

    it('reloads saved state on new SaveManager instance', () => {
      saveManager.recordLevelResult(1, 3, { r1: '#FF0000' });
      saveManager.setCurrentLevel(2);

      // Create a fresh instance to simulate app reload
      const newManager = new SaveManager();
      const progress = newManager.getProgress();

      expect(progress.currentLevel).toBe(2);
      expect(progress.highestUnlocked).toBe(2);
      expect(progress.results[1]?.stars).toBe(3);
      expect(progress.results[1]?.colorsUsed).toEqual({ r1: '#FF0000' });
    });
  });

  describe('Level Unlocking Logic', () => {
    it('unlocks next level when current level is completed with >= 1 star', () => {
      expect(saveManager.isLevelUnlocked(2)).toBe(false);

      saveManager.recordLevelResult(1, 1, {});
      expect(saveManager.getProgress().highestUnlocked).toBe(2);
      expect(saveManager.isLevelUnlocked(2)).toBe(true);
      expect(saveManager.isLevelUnlocked(3)).toBe(false);
    });

    it('does not unlock next level when 0 stars are awarded', () => {
      saveManager.recordLevelResult(1, 0, {});
      expect(saveManager.getProgress().highestUnlocked).toBe(1);
      expect(saveManager.isLevelUnlocked(2)).toBe(false);
    });

    it('does not decrease highestUnlocked when replaying an earlier level', () => {
      // Advance to level 5
      saveManager.recordLevelResult(1, 3, {});
      saveManager.recordLevelResult(2, 3, {});
      saveManager.recordLevelResult(3, 3, {});
      saveManager.recordLevelResult(4, 3, {});
      expect(saveManager.getProgress().highestUnlocked).toBe(5);

      // Replay level 2
      saveManager.recordLevelResult(2, 1, {});
      expect(saveManager.getProgress().highestUnlocked).toBe(5);
    });

    it('does not exceed TOTAL_LEVELS when unlocking', () => {
      // Simulate completing level 100
      for (let i = 1; i <= TOTAL_LEVELS; i++) {
        saveManager.recordLevelResult(i, 3, {});
      }
      expect(saveManager.getProgress().highestUnlocked).toBe(TOTAL_LEVELS);
    });
  });

  describe('Level Result Saves & Best Score Preservation', () => {
    it('records level completion with timestamp', () => {
      const beforeTime = Date.now();
      saveManager.recordLevelResult(1, 2, { r1: '#00FF00' });
      const afterTime = Date.now();

      const result = saveManager.getProgress().results[1];
      expect(result).toBeDefined();
      expect(result.levelId).toBe(1);
      expect(result.stars).toBe(2);
      expect(result.colorsUsed).toEqual({ r1: '#00FF00' });
      expect(result.completedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(result.completedAt).toBeLessThanOrEqual(afterTime);
    });

    it('preserves the highest star count achieved on replay', () => {
      saveManager.recordLevelResult(1, 3, { r1: '#FF0000' });
      expect(saveManager.getStarsForLevel(1)).toBe(3);

      // Replay and get 1 star -> best remains 3
      saveManager.recordLevelResult(1, 1, { r1: '#00FF00' });
      expect(saveManager.getStarsForLevel(1)).toBe(3);

      // Replay with 2 stars -> best remains 3
      saveManager.recordLevelResult(1, 2, { r1: '#0000FF' });
      expect(saveManager.getStarsForLevel(1)).toBe(3);
    });

    it('upgrades star count if higher stars are earned on replay', () => {
      saveManager.recordLevelResult(2, 1, {});
      expect(saveManager.getStarsForLevel(2)).toBe(1);

      saveManager.recordLevelResult(2, 2, {});
      expect(saveManager.getStarsForLevel(2)).toBe(2);

      saveManager.recordLevelResult(2, 3, {});
      expect(saveManager.getStarsForLevel(2)).toBe(3);
    });

    it('returns 0 stars for unplayed level', () => {
      expect(saveManager.getStarsForLevel(42)).toBe(0);
    });

    it('clamps setCurrentLevel between 1 and TOTAL_LEVELS', () => {
      saveManager.setCurrentLevel(-5);
      expect(saveManager.getProgress().currentLevel).toBe(1);

      saveManager.setCurrentLevel(999);
      expect(saveManager.getProgress().currentLevel).toBe(TOTAL_LEVELS);

      saveManager.setCurrentLevel(50);
      expect(saveManager.getProgress().currentLevel).toBe(50);
    });
  });

  describe('Settings Management', () => {
    it('updates partial settings and emits settings:change event', () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      saveManager.updateSettings({ musicVolume: 0.8, musicMuted: true });

      const settings = saveManager.getSettings();
      expect(settings.musicVolume).toBe(0.8);
      expect(settings.musicMuted).toBe(true);
      expect(settings.sfxVolume).toBe(SFX_DEFAULT_VOL);
      expect(settings.sfxMuted).toBe(false);

      expect(emitSpy).toHaveBeenCalledWith('settings:change', { settings });
      emitSpy.mockRestore();
    });
  });

  describe('Migration & Corrupted Data Handling', () => {
    it('recovers gracefully from corrupted JSON in localStorage', () => {
      localStorage.setItem(SAVE_KEY, 'invalid-json{{{');
      const corruptedManager = new SaveManager();
      const progress = corruptedManager.getProgress();

      expect(progress.version).toBe(SAVE_VERSION);
      expect(progress.currentLevel).toBe(1);
      expect(progress.highestUnlocked).toBe(1);
    });

    it('recovers gracefully when non-object is saved in localStorage', () => {
      localStorage.setItem(SAVE_KEY, JSON.stringify('string-value'));
      const stringManager = new SaveManager();
      expect(stringManager.getProgress().version).toBe(SAVE_VERSION);
    });

    it('migrates partial saved state, maintaining existing progress and filling defaults', () => {
      const partialData = {
        currentLevel: 10,
        highestUnlocked: 15,
        results: {
          1: { levelId: 1, stars: 3, colorsUsed: {}, completedAt: 123456 },
        },
        // missing settings and version
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(partialData));

      const migratedManager = new SaveManager();
      const progress = migratedManager.getProgress();

      expect(progress.version).toBe(SAVE_VERSION);
      expect(progress.currentLevel).toBe(10);
      expect(progress.highestUnlocked).toBe(15);
      expect(progress.results[1]?.stars).toBe(3);
      expect(progress.settings.musicVolume).toBe(MUSIC_DEFAULT_VOL);
      expect(progress.settings.sfxVolume).toBe(SFX_DEFAULT_VOL);
      expect(progress.settings.musicMuted).toBe(false);
    });

    it('resetProgress resets all state back to default and saves', () => {
      saveManager.recordLevelResult(1, 3, {});
      saveManager.setCurrentLevel(5);
      saveManager.updateSettings({ musicMuted: true });

      saveManager.resetProgress();
      const progress = saveManager.getProgress();

      expect(progress.currentLevel).toBe(1);
      expect(progress.highestUnlocked).toBe(1);
      expect(progress.results).toEqual({});
      expect(progress.settings.musicMuted).toBe(false);

      // Verify localStorage was updated
      const reloaded = new SaveManager();
      expect(reloaded.getProgress().currentLevel).toBe(1);
    });
  });
});
