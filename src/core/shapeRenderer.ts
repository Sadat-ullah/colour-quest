/* ─────────────────────────────────────────────────────────────
 *  shapeRenderer.ts – Canvas 2D Region Shape Drawing & Hit-Testing
 *  Renders templates, reference previews, fills, outlines & hit tests
 * ───────────────────────────────────────────────────────────── */
import type { Region } from '../shared/contracts';

export interface RenderOptions {
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  isHighlighted?: boolean;
  highlightColor?: string;
  glow?: boolean;
  glowBlur?: number;
  pulseScale?: number;
}

export class ShapeRenderer {
  /**
   * Calculates the bounding box of a collection of regions in template space.
   */
  public static calculateBoundingBox(regions: Region[]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  } {
    if (!regions || regions.length === 0) {
      return { minX: 0, minY: 0, maxX: 500, maxY: 500, width: 500, height: 500 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const r of regions) {
      switch (r.shape) {
        case 'circle':
          minX = Math.min(minX, r.cx - r.r);
          minY = Math.min(minY, r.cy - r.r);
          maxX = Math.max(maxX, r.cx + r.r);
          maxY = Math.max(maxY, r.cy + r.r);
          break;
        case 'ellipse':
          minX = Math.min(minX, r.cx - r.rx);
          minY = Math.min(minY, r.cy - r.ry);
          maxX = Math.max(maxX, r.cx + r.rx);
          maxY = Math.max(maxY, r.cy + r.ry);
          break;
        case 'rect':
        case 'roundRect':
          minX = Math.min(minX, r.x);
          minY = Math.min(minY, r.y);
          maxX = Math.max(maxX, r.x + r.w);
          maxY = Math.max(maxY, r.y + r.h);
          break;
        case 'polygon':
          for (let i = 0; i < r.points.length; i += 2) {
            minX = Math.min(minX, r.points[i]);
            minY = Math.min(minY, r.points[i + 1]);
            maxX = Math.max(maxX, r.points[i]);
            maxY = Math.max(maxY, r.points[i + 1]);
          }
          break;
        case 'star':
          minX = Math.min(minX, r.cx - r.outerR);
          minY = Math.min(minY, r.cy - r.outerR);
          maxX = Math.max(maxX, r.cx + r.outerR);
          maxY = Math.max(maxY, r.cy + r.outerR);
          break;
        case 'heart':
          minX = Math.min(minX, r.cx - r.size);
          minY = Math.min(minY, r.cy - r.size);
          maxX = Math.max(maxX, r.cx + r.size);
          maxY = Math.max(maxY, r.cy + r.size);
          break;
        case 'arc':
        case 'ring': {
          const rad = r.shape === 'ring' ? r.outerR : r.r;
          minX = Math.min(minX, r.cx - rad);
          minY = Math.min(minY, r.cy - rad);
          maxX = Math.max(maxX, r.cx + rad);
          maxY = Math.max(maxY, r.cy + rad);
          break;
        }
        default:
          minX = Math.min(minX, 0);
          minY = Math.min(minY, 0);
          maxX = Math.max(maxX, 500);
          maxY = Math.max(maxY, 500);
          break;
      }
    }

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return { minX: 0, minY: 0, maxX: 500, maxY: 500, width: 500, height: 500 };
    }

    const width = Math.max(10, maxX - minX);
    const height = Math.max(10, maxY - minY);
    return { minX, minY, maxX, maxY, width, height };
  }

  /**
   * Builds the Path2D object for a given region in standard template space.
   */
  public static createPath(region: Region): Path2D {
    const path = new Path2D();

    switch (region.shape) {
      case 'circle': {
        path.arc(region.cx, region.cy, region.r, 0, Math.PI * 2);
        break;
      }

      case 'ellipse': {
        path.ellipse(region.cx, region.cy, region.rx, region.ry, 0, 0, Math.PI * 2);
        break;
      }

      case 'rect': {
        path.rect(region.x, region.y, region.w, region.h);
        break;
      }

      case 'roundRect': {
        const { x, y, w, h, radius } = region;
        const r = Math.min(radius, w / 2, h / 2);
        path.moveTo(x + r, y);
        path.lineTo(x + w - r, y);
        path.arcTo(x + w, y, x + w, y + r, r);
        path.lineTo(x + w, y + h - r);
        path.arcTo(x + w, y + h, x + w - r, y + h, r);
        path.lineTo(x + r, y + h);
        path.arcTo(x, y + h, x, y + h - r, r);
        path.lineTo(x, y + r);
        path.arcTo(x, y, x + r, y, r);
        path.closePath();
        break;
      }

      case 'polygon': {
        const pts = region.points;
        if (pts.length >= 4) {
          path.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) {
            path.lineTo(pts[i], pts[i + 1]);
          }
          path.closePath();
        }
        break;
      }

      case 'star': {
        const { cx, cy, points, outerR, innerR } = region;
        const step = Math.PI / points;
        let angle = -Math.PI / 2;

        for (let i = 0; i < points * 2; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (i === 0) path.moveTo(x, y);
          else path.lineTo(x, y);
          angle += step;
        }
        path.closePath();
        break;
      }

      case 'heart': {
        const { cx, cy, size } = region;
        const s = size / 30; // normalized scale
        path.moveTo(cx, cy + 10 * s);
        path.bezierCurveTo(cx, cy - 5 * s, cx - 25 * s, cy - 20 * s, cx - 25 * s, cy - 5 * s);
        path.bezierCurveTo(cx - 25 * s, cy + 12 * s, cx, cy + 25 * s, cx, cy + 30 * s);
        path.bezierCurveTo(cx, cy + 25 * s, cx + 25 * s, cy + 12 * s, cx + 25 * s, cy - 5 * s);
        path.bezierCurveTo(cx + 25 * s, cy - 20 * s, cx, cy - 5 * s, cx, cy + 10 * s);
        path.closePath();
        break;
      }

      case 'arc': {
        const { cx, cy, r, startAngle, endAngle } = region;
        path.arc(cx, cy, r, startAngle, endAngle, false);
        break;
      }

      case 'ring': {
        const { cx, cy, outerR, innerR } = region;
        path.arc(cx, cy, outerR, 0, Math.PI * 2, false);
        path.arc(cx, cy, innerR, 0, Math.PI * 2, true); // counter-clockwise for donut cutout
        path.closePath();
        break;
      }
    }

    return path;
  }

  /**
   * Draws a region with support for scaling, translation, fill, outline, and highlights.
   */
  public static drawRegion(
    ctx: CanvasRenderingContext2D,
    region: Region,
    options: RenderOptions = {}
  ): void {
    const {
      offsetX = 0,
      offsetY = 0,
      scale = 1,
      fillColor = '#FFFFFF',
      strokeColor = '#1B4532',
      strokeWidth = 3,
      isHighlighted = false,
      highlightColor = '#1B4532',
      glow = false,
      glowBlur = 16,
      pulseScale = 1.0,
    } = options;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    if (pulseScale !== 1.0) {
      const bbox = ShapeRenderer.calculateBoundingBox([region]);
      const cx = bbox.minX + bbox.width / 2;
      const cy = bbox.minY + bbox.height / 2;
      ctx.translate(cx, cy);
      ctx.scale(pulseScale, pulseScale);
      ctx.translate(-cx, -cy);
    }

    const path = ShapeRenderer.createPath(region);

    // Glow effect when highlighted
    if (glow || isHighlighted) {
      ctx.shadowColor = highlightColor;
      ctx.shadowBlur = glowBlur;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Fill
    ctx.fillStyle = fillColor;
    ctx.fill(path);

    // Reset shadow before stroke
    ctx.shadowBlur = 0;

    // Stroke
    if (strokeWidth > 0) {
      ctx.strokeStyle = isHighlighted ? highlightColor : strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(path);

      // Inner stroke for extra pop when highlighted
      if (isHighlighted) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke(path);
      }
    }

    ctx.restore();
  }

  /**
   * Checks if a canvas point (design space) falls inside a region
   * taking template position & scale into account.
   */
  public static hitTest(
    ctx: CanvasRenderingContext2D,
    region: Region,
    canvasX: number,
    canvasY: number,
    templateOffsetX: number,
    templateOffsetY: number,
    templateScale: number
  ): boolean {
    // Transform point to local template space
    const localX = (canvasX - templateOffsetX) / templateScale;
    const localY = (canvasY - templateOffsetY) / templateScale;

    // Fast bounding box rejection where possible
    const path = ShapeRenderer.createPath(region);
    return ctx.isPointInPath(path, localX, localY);
  }

  /**
   * Finds the center of a region for particle bursts or indicators.
   */
  public static getRegionCenter(region: Region): { x: number; y: number } {
    switch (region.shape) {
      case 'circle':
      case 'ellipse':
      case 'star':
      case 'heart':
      case 'arc':
      case 'ring':
        return { x: region.cx, y: region.cy };
      case 'rect':
      case 'roundRect':
        return { x: region.x + region.w / 2, y: region.y + region.h / 2 };
      case 'polygon': {
        let sumX = 0;
        let sumY = 0;
        const count = region.points.length / 2;
        for (let i = 0; i < region.points.length; i += 2) {
          sumX += region.points[i];
          sumY += region.points[i + 1];
        }
        return { x: sumX / count, y: sumY / count };
      }
      default:
        return { x: 250, y: 250 };
    }
  }
}
