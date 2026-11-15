/* ─────────────────────────────────────────────────────────────
 *  contracts.ts – FROZEN shared type contracts
 *  All agents may read; NO agent may change existing signatures.
 *  Only non-breaking optional properties may be added.
 * ───────────────────────────────────────────────────────────── */

// ── Region shapes ──
export type ShapeKind = 'circle' | 'ellipse' | 'rect' | 'roundRect' | 'polygon' | 'star' | 'heart' | 'arc' | 'ring';

export interface RegionBase {
  id: string;
  targetColor: string;       // hex colour the child should pick
  label?: string;            // optional accessible label
}

export interface CircleRegion extends RegionBase {
  shape: 'circle';
  cx: number; cy: number; r: number;
}

export interface EllipseRegion extends RegionBase {
  shape: 'ellipse';
  cx: number; cy: number; rx: number; ry: number;
}

export interface RectRegion extends RegionBase {
  shape: 'rect';
  x: number; y: number; w: number; h: number;
}

export interface RoundRectRegion extends RegionBase {
  shape: 'roundRect';
  x: number; y: number; w: number; h: number; radius: number;
}

export interface PolygonRegion extends RegionBase {
  shape: 'polygon';
  points: number[];          // flat [x1,y1,x2,y2,...] array
}

export interface StarRegion extends RegionBase {
  shape: 'star';
  cx: number; cy: number; points: number; outerR: number; innerR: number;
}

export interface HeartRegion extends RegionBase {
  shape: 'heart';
  cx: number; cy: number; size: number;
}

export interface ArcRegion extends RegionBase {
  shape: 'arc';
  cx: number; cy: number; r: number;
  startAngle: number; endAngle: number;
}

export interface RingRegion extends RegionBase {
  shape: 'ring';
  cx: number; cy: number; outerR: number; innerR: number;
}

export type Region =
  | CircleRegion | EllipseRegion | RectRegion | RoundRectRegion
  | PolygonRegion | StarRegion | HeartRegion | ArcRegion | RingRegion;

// ── Level data ──
export type LevelCategory =
  | 'tutorial' | 'basic_shapes' | 'simple_objects'
  | 'animals' | 'nature' | 'scenes' | 'master';

export interface LevelData {
  id: number;
  name: string;
  category: LevelCategory;
  difficulty: number;          // 1-10
  regions: Region[];
  palette: string[];           // hex colours available to pick
  background?: string;         // optional bg hex
  timeBonus?: number;          // optional seconds for bonus star
}

// ── Player progress ──
export interface LevelResult {
  levelId: number;
  stars: 0 | 1 | 2 | 3;
  colorsUsed: Record<string, string>;  // regionId → hex
  completedAt: number;                  // unix ms
}

export interface PlayerProgress {
  version: number;
  currentLevel: number;
  highestUnlocked: number;
  results: Record<number, LevelResult>;
  settings: PlayerSettings;
}

export interface PlayerSettings {
  musicVolume: number;   // 0-1
  sfxVolume: number;     // 0-1
  musicMuted: boolean;
  sfxMuted: boolean;
}

// ── Scoring ──
export interface ScoringResult {
  totalRegions: number;
  correctRegions: number;
  accuracy: number;        // 0-1
  stars: 1 | 2 | 3;
}

// ── Scene names ──
export type SceneName = 'boot' | 'preload' | 'title' | 'levelSelect' | 'gameplay' | 'results';

// ── Game Events ──
export interface GameEvents {
  'region:selected': { regionId: string };
  'region:filled': { regionId: string; color: string; correct: boolean };
  'color:selected': { color: string };
  'level:complete': { levelId: number; result: ScoringResult };
  'level:start': { levelId: number; silentAudio?: boolean };
  'scene:change': { from: SceneName; to: SceneName };
  'audio:unlock': {};
  'settings:change': { settings: PlayerSettings };
}
