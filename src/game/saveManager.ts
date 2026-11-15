/* ─────────────────────────────────────────────────────────────
 *  saveManager.ts – Persistent Local Storage Progress & Settings
 *  Guarantees save state integrity across refreshes & version migrations
 * ───────────────────────────────────────────────────────────── */
import { SAVE_KEY, SAVE_VERSION, MUSIC_DEFAULT_VOL, SFX_DEFAULT_VOL, TOTAL_LEVELS } from '../shared/constants';
import type { PlayerProgress, PlayerSettings, LevelResult } from '../shared/contracts';
import { eventBus } from '../shared/eventBus';

export class SaveManager {
  private progress: PlayerProgress;

  constructor() {
    this.progress = this.load();
  }

  private getDefaultProgress(): PlayerProgress {
    return {
      version: SAVE_VERSION,
      currentLevel: 1,
      highestUnlocked: 1,
      results: {},
      settings: {
        musicVolume: MUSIC_DEFAULT_VOL,
        sfxVolume: SFX_DEFAULT_VOL,
        musicMuted: false,
        sfxMuted: false,
      },
    };
  }

  private getStorage(): Storage | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
      if (typeof localStorage !== 'undefined') {
        return localStorage;
      }
    } catch {
      // In-memory fallback
    }
    return null;
  }

  public load(): PlayerProgress {
    try {
      const storage = this.getStorage();
      const raw = storage ? storage.getItem(SAVE_KEY) : null;
      if (!raw) return this.getDefaultProgress();

      const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
      if (!parsed || typeof parsed !== 'object') return this.getDefaultProgress();

      // Migration check
      const current: PlayerProgress = {
        version: SAVE_VERSION,
        currentLevel: typeof parsed.currentLevel === 'number' ? parsed.currentLevel : 1,
        highestUnlocked: typeof parsed.highestUnlocked === 'number' ? parsed.highestUnlocked : 1,
        results: parsed.results && typeof parsed.results === 'object' ? parsed.results : {},
        settings: {
          musicVolume: parsed.settings?.musicVolume ?? MUSIC_DEFAULT_VOL,
          sfxVolume: parsed.settings?.sfxVolume ?? SFX_DEFAULT_VOL,
          musicMuted: parsed.settings?.musicMuted ?? false,
          sfxMuted: parsed.settings?.sfxMuted ?? false,
        },
      };

      return current;
    } catch (e) {
      console.warn('[SaveManager] Failed to load save, using defaults', e);
      return this.getDefaultProgress();
    }
  }

  public save(): void {
    try {
      const storage = this.getStorage();
      if (storage) {
        storage.setItem(SAVE_KEY, JSON.stringify(this.progress));
      }
    } catch (e) {
      console.error('[SaveManager] Failed to persist progress to localStorage', e);
    }
  }

  public getProgress(): PlayerProgress {
    return this.progress;
  }

  public getSettings(): PlayerSettings {
    return this.progress.settings;
  }

  public updateSettings(partial: Partial<PlayerSettings>): void {
    this.progress.settings = { ...this.progress.settings, ...partial };
    this.save();
    eventBus.emit('settings:change', { settings: this.progress.settings });
  }

  public recordLevelResult(
    levelId: number,
    stars: 0 | 1 | 2 | 3,
    colorsUsed: Record<string, string>
  ): void {
    const prev = this.progress.results[levelId];
    // Keep best star count
    const bestStars = prev ? (Math.max(prev.stars, stars) as 0 | 1 | 2 | 3) : stars;

    const result: LevelResult = {
      levelId,
      stars: bestStars,
      colorsUsed,
      completedAt: Date.now(),
    };

    this.progress.results[levelId] = result;

    // Unlock next level if completed with at least 1 star
    if (stars > 0 && levelId >= this.progress.highestUnlocked && levelId < TOTAL_LEVELS) {
      this.progress.highestUnlocked = levelId + 1;
    }

    this.save();
  }

  public setCurrentLevel(levelId: number): void {
    this.progress.currentLevel = Math.max(1, Math.min(TOTAL_LEVELS, levelId));
    this.save();
  }

  public isLevelUnlocked(levelId: number): boolean {
    return levelId <= this.progress.highestUnlocked;
  }

  public getStarsForLevel(levelId: number): number {
    return this.progress.results[levelId]?.stars ?? 0;
  }

  public resetProgress(): void {
    this.progress = this.getDefaultProgress();
    this.save();
  }
}

export const saveManager = new SaveManager();
