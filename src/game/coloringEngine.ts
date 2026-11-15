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
  private hintUsed: boolean = false;
  private hintedColor: string | null = null;

  public loadLevel(level: LevelData): void {
    this.level = level;
    this.selectedRegionId = null;
    this.selectedColor = null;
    this.filledColors.clear();
    this.fillHistory = [];
    this.hintUsed = false;
    this.hintedColor = null;
    eventBus.emit('level:start', { levelId: level.id });
  }

  public getLevel(): LevelData | null {
    return this.level;
  }

  public isHintUsed(): boolean {
    return this.hintUsed;
  }

  public getHintedColor(): string | null {
    return this.hintedColor;
  }

  public clearHintedColor(): void {
    this.hintedColor = null;
  }

  /**
   * Request a single-use hint for the currently selected container.
   */
  public requestHint(): {
    success: boolean;
    reason?: 'no_selection' | 'already_used' | 'invalid_region';
    targetColor?: string;
    regionId?: string;
  } {
    if (this.hintUsed) {
      return { success: false, reason: 'already_used' };
    }
    if (!this.selectedRegionId || !this.level) {
      return { success: false, reason: 'no_selection' };
    }
    const region = this.level.regions.find((r) => r.id === this.selectedRegionId);
    if (!region) {
      return { success: false, reason: 'invalid_region' };
    }

    this.hintUsed = true;
    this.hintedColor = region.targetColor;
    return { success: true, targetColor: region.targetColor, regionId: region.id };
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
   * Step A: Tap Container
   * Selects a region in the template.
   * NEVER fills a colour on container tap!
   * Highlights the container outline and activates the colour palette.
   */
  public selectRegion(regionId: string): { filled: boolean; regionId: string } {
    if (!this.level) return { filled: false, regionId };

    this.selectedRegionId = regionId;
    this.selectedColor = null; // Always clear sticky color so container tap NEVER auto-fills
    eventBus.emit('region:selected', { regionId });

    return { filled: false, regionId };
  }

  /**
   * Step B: Tap Colour
   * While a container (region) is selected, fills ONLY that selectedRegionId with this color.
   * Step C: Immediate Reset
   * Immediately resets selectedRegionId = null and selectedColor = null, clearing palette highlight.
   */
  public selectColor(color: string): { filled: boolean; regionId?: string; color?: string; correct?: boolean } {
    if (!this.level) return { filled: false };

    // If no region is selected, color tap does NOT stick or auto-fill later
    if (!this.selectedRegionId) {
      this.selectedColor = null;
      return { filled: false };
    }

    const regionId = this.selectedRegionId;
    const fillResult = this.fillRegion(regionId, color);

    // Step C: Immediate Reset
    this.selectedRegionId = null;
    this.selectedColor = null;
    this.hintedColor = null;
    eventBus.emit('color:selected', { color: '' });

    return { filled: true, regionId, color, correct: fillResult.correct };
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
    this.selectedColor = null;
    this.hintUsed = false;
    this.hintedColor = null;
  }

  public clearSelection(): void {
    this.selectedRegionId = null;
    this.selectedColor = null;
  }
}

export const coloringEngine = new ColoringEngine();
