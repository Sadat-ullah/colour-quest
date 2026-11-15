/* ─────────────────────────────────────────────────────────────
 *  coloringEngine.ts – Interactive Region Coloring & Scoring Logic
 *  Manages region selection, color assignment, validation & star scoring
 * ───────────────────────────────────────────────────────────── */
import type { LevelData, ScoringResult } from '../shared/contracts';
import { STAR_THRESHOLDS } from '../shared/constants';
import { eventBus } from '../shared/eventBus';

export class ColoringEngine {
  private level: LevelData | null = null;
  private selectedRegionId: string | null = null;
  private selectedColor: string | null = null;
  private filledColors = new Map<string, string>(); // regionId -> hex colour
  private fillHistory: Array<{ regionId: string; prevColor: string | null }> = [];

  public loadLevel(level: LevelData): void {
    this.level = level;
    this.selectedRegionId = null;
    this.selectedColor = null;
    this.filledColors.clear();
    this.fillHistory = [];
    eventBus.emit('level:start', { levelId: level.id });
  }

  public getLevel(): LevelData | null {
    return this.level;
  }

  public getSelectedRegionId(): string | null {
    return this.selectedRegionId;
  }

  public getSelectedColor(): string | null {
    return this.selectedColor;
  }

  public getFilledColors(): Map<string, string> {
    return this.filledColors;
  }

  public getFilledColor(regionId: string): string | null {
    return this.filledColors.get(regionId) ?? null;
  }

  /**
   * Selects a region in the template.
   * If a color is already selected, immediately fills this region with that color!
   */
  public selectRegion(regionId: string): { filled: boolean; color?: string; correct?: boolean } {
    if (!this.level) return { filled: false };

    this.selectedRegionId = regionId;
    eventBus.emit('region:selected', { regionId });

    // If child already picked a color, fill this region right away!
    if (this.selectedColor) {
      const fillResult = this.fillRegion(regionId, this.selectedColor);
      return { filled: true, color: this.selectedColor, correct: fillResult.correct };
    }

    return { filled: false };
  }

  /**
   * Selects a color from the palette.
   * If a region is already selected, immediately fills that region with this color!
   */
  public selectColor(color: string): { filled: boolean; regionId?: string; correct?: boolean } {
    if (!this.level) return { filled: false };

    this.selectedColor = color;
    eventBus.emit('color:selected', { color });

    // If child already highlighted a region, fill it immediately!
    if (this.selectedRegionId) {
      const regionId = this.selectedRegionId;
      const fillResult = this.fillRegion(regionId, color);
      return { filled: true, regionId, correct: fillResult.correct };
    }

    return { filled: false };
  }

  /**
   * Fills a specific region with a colour.
   */
  public fillRegion(regionId: string, color: string): { success: boolean; correct: boolean } {
    if (!this.level) return { success: false, correct: false };

    const targetRegion = this.level.regions.find((r) => r.id === regionId);
    if (!targetRegion) return { success: false, correct: false };

    const prev = this.filledColors.get(regionId) ?? null;
    this.filledColors.set(regionId, color);
    this.fillHistory.push({ regionId, prevColor: prev });

    const correct = targetRegion.targetColor.toLowerCase() === color.toLowerCase();
    eventBus.emit('region:filled', { regionId, color, correct });

    return { success: true, correct };
  }

  /**
   * Checks if all regions in the current level have been filled with some colour.
   */
  public isAllRegionsFilled(): boolean {
    if (!this.level) return false;
    return this.level.regions.every((r) => this.filledColors.has(r.id));
  }

  /**
   * Calculates similarity / accuracy and assigns 1, 2, or 3 stars.
   */
  public calculateScoring(): ScoringResult {
    if (!this.level || this.level.regions.length === 0) {
      return { totalRegions: 0, correctRegions: 0, accuracy: 1, stars: 3 };
    }

    const totalRegions = this.level.regions.length;
    let correctRegions = 0;

    for (const region of this.level.regions) {
      const userColor = this.filledColors.get(region.id);
      if (userColor && userColor.toLowerCase() === region.targetColor.toLowerCase()) {
        correctRegions++;
      }
    }

    const accuracy = totalRegions > 0 ? correctRegions / totalRegions : 1;

    let stars: 1 | 2 | 3 = 1;
    if (accuracy >= STAR_THRESHOLDS[3]) {
      stars = 3;
    } else if (accuracy >= STAR_THRESHOLDS[2]) {
      stars = 2;
    } else {
      stars = 1;
    }

    return {
      totalRegions,
      correctRegions,
      accuracy,
      stars,
    };
  }

  public undo(): boolean {
    if (this.fillHistory.length === 0) return false;
    const last = this.fillHistory.pop()!;
    if (last.prevColor === null) {
      this.filledColors.delete(last.regionId);
    } else {
      this.filledColors.set(last.regionId, last.prevColor);
    }
    return true;
  }

  public resetCurrentLevel(): void {
    this.filledColors.clear();
    this.fillHistory = [];
    this.selectedRegionId = null;
  }

  public clearSelection(): void {
    this.selectedRegionId = null;
    this.selectedColor = null;
  }
}

export const coloringEngine = new ColoringEngine();
