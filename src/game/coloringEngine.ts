/* ─────────────────────────────────────────────────────────────
 *  coloringEngine.ts – Interactive Region Coloring & Scoring Logic
 *  Colour-First flow: Pick Crayon First → Tap Shape(s) to Paint
 *  Manages persistent crayon selection, region painting, validation & star scoring
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
  private hintedRegionId: string | null = null;

  public loadLevel(level: LevelData): void {
    this.level = level;
    this.selectedRegionId = null;
    this.selectedColor = null;
    this.filledColors.clear();
    this.fillHistory = [];
    this.hintUsed = false;
    this.hintedColor = null;
    this.hintedRegionId = null;
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

  public getHintedRegionId(): string | null {
    return this.hintedRegionId;
  }

  public clearHintedColor(): void {
    this.hintedColor = null;
    this.hintedRegionId = null;
  }

  /**
   * Request a single-use hint in the Colour-First flow:
   * Finds the first unpainted shape (or incorrectly colored shape),
   * reveals its target crayon color, and highlights both the crayon and target shape.
   */
  public requestHint(): {
    success: boolean;
    reason?: 'already_used' | 'no_level' | 'no_selection' | 'invalid_region';
    targetColor?: string;
    regionId?: string;
  } {
    if (this.hintUsed) {
      return { success: false, reason: 'already_used' };
    }
    if (!this.level || this.level.regions.length === 0) {
      return { success: false, reason: 'no_level' };
    }

    // Identify first unpainted region or first incorrectly filled region
    let targetRegion = this.level.regions.find((r) => !this.filledColors.has(r.id));
    if (!targetRegion) {
      targetRegion = this.level.regions.find(
        (r) => this.filledColors.get(r.id)?.toLowerCase() !== r.targetColor.toLowerCase()
      );
    }
    if (!targetRegion) {
      targetRegion = this.level.regions[0];
    }

    this.hintUsed = true;
    this.hintedColor = targetRegion.targetColor;
    this.hintedRegionId = targetRegion.id;
    // Automatically equip the target crayon so hint is fully armed & ready to paint
    this.selectedColor = targetRegion.targetColor;
    eventBus.emit('color:selected', { color: targetRegion.targetColor });

    return { success: true, targetColor: targetRegion.targetColor, regionId: targetRegion.id };
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
   * Step 1: Pick / Equip a Crayon Colour (Colour-First Flow)
   * Tapping a crayon equips it for colouring the next shape.
   */
  public selectColor(color: string): { equipped: boolean; color: string } {
    this.selectedColor = color;
    eventBus.emit('color:selected', { color });
    return { equipped: true, color };
  }

  /**
   * Clears the currently equipped crayon color.
   */
  public clearSelectedColor(): void {
    this.selectedColor = null;
    eventBus.emit('color:selected', { color: '' });
  }

  /**
   * Step 2: Tap Shape / Region on Canvas
   * If a crayon is equipped, immediately paints the shape.
   * Immediately after colouring, removes focus from the crayon so the user taps a crayon again.
   * If no crayon is equipped, returns filled: false with reason: 'no_color'.
   */
  public selectRegion(regionId: string): {
    filled: boolean;
    regionId: string;
    color?: string;
    correct?: boolean;
    reason?: 'no_color' | 'invalid_region';
  } {
    if (!this.level) return { filled: false, regionId, reason: 'invalid_region' };

    const targetRegion = this.level.regions.find((r) => r.id === regionId);
    if (!targetRegion) return { filled: false, regionId, reason: 'invalid_region' };

    this.selectedRegionId = regionId;

    // If a crayon is equipped, immediately paint the shape!
    if (this.selectedColor) {
      const colorFilled = this.selectedColor;
      const fillRes = this.fillRegion(regionId, colorFilled);

      // Focus removal rule: After shape is coloured, remove focus from crayon
      this.selectedColor = null;
      this.selectedRegionId = null;
      this.hintedColor = null;
      this.hintedRegionId = null;
      eventBus.emit('color:selected', { color: '' });

      return {
        filled: fillRes.success,
        regionId,
        color: colorFilled,
        correct: fillRes.correct,
      };
    }

    // No crayon equipped
    eventBus.emit('region:selected', { regionId });
    return { filled: false, regionId, reason: 'no_color' };
  }

  /**
   * Fills a specific region with a colour (or the currently equipped colour).
   */
  public fillRegion(
    regionId: string,
    color?: string
  ): { success: boolean; correct: boolean; reason?: 'no_color' | 'invalid_region' } {
    if (!this.level) return { success: false, correct: false, reason: 'invalid_region' };

    const colorToUse = color || this.selectedColor;
    if (!colorToUse) {
      return { success: false, correct: false, reason: 'no_color' };
    }

    const targetRegion = this.level.regions.find((r) => r.id === regionId);
    if (!targetRegion) return { success: false, correct: false, reason: 'invalid_region' };

    const prev = this.filledColors.get(regionId) ?? null;
    this.filledColors.set(regionId, colorToUse);
    this.fillHistory.push({ regionId, prevColor: prev });

    const correct = targetRegion.targetColor.toLowerCase() === colorToUse.toLowerCase();

    // If the hinted shape is now filled, clear the active hint auras
    if (regionId === this.hintedRegionId) {
      this.hintedColor = null;
      this.hintedRegionId = null;
    }

    eventBus.emit('region:filled', { regionId, color: colorToUse, correct });

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

  /**
   * Undo reverts the last painted shape.
   * Keeps the currently equipped crayon color active.
   */
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

  /**
   * Resets all painted shapes in the current level.
   * Preserves single-use hint status within the same level attempt.
   */
  public resetCurrentLevel(): void {
    this.filledColors.clear();
    this.fillHistory = [];
    this.selectedRegionId = null;
    this.hintedColor = null;
    this.hintedRegionId = null;
  }

  public clearSelection(): void {
    this.selectedRegionId = null;
    this.selectedColor = null;
    eventBus.emit('color:selected', { color: '' });
  }
}

export const coloringEngine = new ColoringEngine();
