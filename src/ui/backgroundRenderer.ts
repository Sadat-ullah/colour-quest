/* ─────────────────────────────────────────────────────────────
 *  backgroundRenderer.ts – Warm British Picture-Book Backdrop
 *  Renders watercolor paper (#FAF5EC / #EEE2CB), soft watercolor washes,
 *  rolling hills, lush corner botanical foliage, and illustrated critters.
 *  Supports image asset layer with high-fidelity procedural canvas fallback.
 * ───────────────────────────────────────────────────────────── */

import { COLORS } from './tokens';
import { drawBubble, drawSparkle } from './components';

function safeEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  rotation: number = 0,
  startAngle: number = 0,
  endAngle: number = Math.PI * 2
): void {
  if (typeof ctx.ellipse === 'function') {
    ctx.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle);
  } else {
    ctx.arc(x, y, Math.min(radiusX, radiusY), startAngle, endAngle);
  }
}

export class BackgroundRenderer {
  private static instance: BackgroundRenderer | null = null;
  private bgImage: HTMLImageElement | null = null;
  private bgImageLoaded: boolean = false;
  private animTimer: number = 0;

  constructor() {
    this.loadImage();
  }

  public static getInstance(): BackgroundRenderer {
    if (!BackgroundRenderer.instance) {
      BackgroundRenderer.instance = new BackgroundRenderer();
    }
    return BackgroundRenderer.instance;
  }

  private loadImage(): void {
    if (typeof window === 'undefined' || typeof Image === 'undefined') return;

    try {
      const img = new Image();
      // Handle relative paths for local dev and GitHub Pages base
      const basePath = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './';
      const cleanBase = basePath.endsWith('/') ? basePath : basePath + '/';
      img.src = `${cleanBase}images/gameplay_bg.jpg`;
      img.onload = () => {
        this.bgImage = img;
        this.bgImageLoaded = true;
      };
      img.onerror = () => {
        // Fallback silently to procedural drawing
        this.bgImageLoaded = false;
      };
    } catch {
      this.bgImageLoaded = false;
    }
  }

  public update(dtSeconds: number): void {
    this.animTimer += dtSeconds;
  }

  /**
   * Main render call for backgrounds across all scenes
   */
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: {
      showHills?: boolean;
      showFlora?: boolean;
      showCritters?: boolean;
      showWashes?: boolean;
      dimCenterArea?: boolean;
    } = {}
  ): void {
    const {
      showHills = true,
      showFlora = true,
      showCritters = true,
      showWashes = true,
      dimCenterArea = false,
    } = options;

    ctx.save();

    // 1. If background image asset is loaded, draw it with letterbox-free cover aspect
    if (this.bgImageLoaded && this.bgImage && this.bgImage.naturalWidth > 0) {
      const imgW = this.bgImage.naturalWidth;
      const imgH = this.bgImage.naturalHeight;
      const scale = Math.max(width / imgW, height / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const drawX = (width - drawW) / 2;
      const drawY = (height - drawH) / 2;

      ctx.drawImage(this.bgImage, drawX, drawY, drawW, drawH);

      // Soft paper tint overlay to ensure perfect color harmonization
      ctx.fillStyle = 'rgba(250, 245, 236, 0.15)';
      ctx.fillRect(0, 0, width, height);
    } else {
      // 2. High-fidelity Procedural Picture-Book Watercolor Canvas
      this.renderProceduralPaper(ctx, width, height);

      if (showWashes) {
        this.renderWatercolorWashes(ctx, width, height);
      }

      if (showHills) {
        this.renderHills(ctx, width, height);
      }

      if (showFlora) {
        this.renderCornerFlora(ctx, width, height);
      }

      if (showCritters) {
        this.renderCritters(ctx, width, height);
      }
    }

    // 3. Optional subtle center clear area for gameplay canvas
    if (dimCenterArea) {
      ctx.save();
      ctx.fillStyle = 'rgba(250, 245, 236, 0.35)';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Warm Clotted Cream textured watercolor paper (#FAF5EC / #EEE2CB)
   */
  private renderProceduralPaper(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#FAF5EC');
    grad.addColorStop(0.35, '#F7EFE1');
    grad.addColorStop(0.7, '#EEE2CB');
    grad.addColorStop(1, '#E6D7BD');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle paper grain/stipple simulation
    ctx.save();
    ctx.fillStyle = 'rgba(216, 201, 174, 0.08)';
    const step = 48;
    for (let x = 12; x < width; x += step) {
      for (let y = 12; y < height; y += step) {
        ctx.beginPath();
        ctx.arc(x + ((y * 7) % 19), y + ((x * 11) % 17), 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Soft organic watercolor washes (mint, peach/coral, sky blue, lemon yellow)
   */
  private renderWatercolorWashes(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Top-Left: Mint Green Watercolor Bloom
    const mintGrad = ctx.createRadialGradient(
      width * 0.12, height * 0.14, 10,
      width * 0.12, height * 0.14, Math.max(120, width * 0.22)
    );
    mintGrad.addColorStop(0, 'rgba(125, 194, 160, 0.35)');
    mintGrad.addColorStop(0.5, 'rgba(168, 218, 193, 0.22)');
    mintGrad.addColorStop(0.8, 'rgba(200, 235, 218, 0.10)');
    mintGrad.addColorStop(1, 'rgba(250, 245, 236, 0)');
    ctx.fillStyle = mintGrad;
    ctx.beginPath();
    ctx.arc(width * 0.12, height * 0.14, Math.max(120, width * 0.22), 0, Math.PI * 2);
    ctx.fill();

    // Mint droplets
    ctx.fillStyle = 'rgba(92, 170, 132, 0.35)';
    ctx.beginPath();
    ctx.arc(width * 0.22, height * 0.06, 12, 0, Math.PI * 2);
    ctx.arc(width * 0.25, height * 0.09, 8, 0, Math.PI * 2);
    ctx.arc(width * 0.08, height * 0.24, 10, 0, Math.PI * 2);
    ctx.fill();

    // Top-Right: Peach / Coral Watercolor Cloud
    const peachGrad = ctx.createRadialGradient(
      width * 0.88, height * 0.22, 10,
      width * 0.88, height * 0.22, Math.max(160, width * 0.32)
    );
    peachGrad.addColorStop(0, 'rgba(247, 164, 138, 0.38)');
    peachGrad.addColorStop(0.45, 'rgba(249, 185, 164, 0.24)');
    peachGrad.addColorStop(0.8, 'rgba(253, 216, 203, 0.12)');
    peachGrad.addColorStop(1, 'rgba(250, 245, 236, 0)');
    ctx.fillStyle = peachGrad;
    ctx.beginPath();
    ctx.arc(width * 0.88, height * 0.22, Math.max(160, width * 0.32), 0, Math.PI * 2);
    ctx.fill();

    // Peach wash ledge for bird
    const ledgeGrad = ctx.createRadialGradient(
      width * 0.8, height * 0.18, 10,
      width * 0.8, height * 0.18, 110
    );
    ledgeGrad.addColorStop(0, 'rgba(247, 180, 155, 0.40)');
    ledgeGrad.addColorStop(1, 'rgba(250, 245, 236, 0)');
    ctx.fillStyle = ledgeGrad;
    ctx.beginPath();
    safeEllipse(ctx, width * 0.8, height * 0.18, 100, 36, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bottom-Left / Center subtle golden glow
    const goldGrad = ctx.createRadialGradient(
      width * 0.3, height * 0.75, 10,
      width * 0.3, height * 0.75, Math.max(140, width * 0.25)
    );
    goldGrad.addColorStop(0, 'rgba(255, 222, 140, 0.25)');
    goldGrad.addColorStop(1, 'rgba(250, 245, 236, 0)');
    ctx.fillStyle = goldGrad;
    ctx.beginPath();
    ctx.arc(width * 0.3, height * 0.75, Math.max(140, width * 0.25), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Layered rolling hills along the bottom
   */
  private renderHills(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Back Hill (Warm Muted Tan-Sage #D9CCA8)
    ctx.fillStyle = '#D9CCA8';
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.quadraticCurveTo(width * 0.32, height - 120, width * 0.72, height - 75);
    ctx.quadraticCurveTo(width * 0.88, height - 55, width, height - 65);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Front Hill (Soft Tan-Cream #CBB892)
    ctx.fillStyle = '#CBB892';
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, height - 80);
    ctx.quadraticCurveTo(width * 0.28, height - 105, width * 0.58, height - 52);
    ctx.quadraticCurveTo(width * 0.82, height - 18, width, height - 42);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Gentle contour outline
    ctx.strokeStyle = 'rgba(27, 69, 50, 0.2)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Bottom-Left and Bottom-Right Lush Botanical Foliage & Wildflowers
   */
  private renderCornerFlora(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    const scale = Math.min(1.2, Math.max(0.65, width / 1000));

    // ── BOTTOM-LEFT BOTANICAL CLUSTER ──
    const blX = 0;
    const blY = height;

    ctx.save();
    ctx.translate(blX, blY);
    ctx.scale(scale, scale);

    // Deep Teal Bush Backdrop
    ctx.fillStyle = '#2D6A4F';
    ctx.beginPath();
    ctx.arc(45, -45, 55, 0, Math.PI * 2);
    ctx.arc(110, -35, 48, 0, Math.PI * 2);
    ctx.arc(80, -75, 45, 0, Math.PI * 2);
    ctx.fill();

    // Sage Green Foliage Front
    ctx.fillStyle = '#40916C';
    ctx.beginPath();
    ctx.arc(30, -30, 42, 0, Math.PI * 2);
    ctx.arc(75, -40, 38, 0, Math.PI * 2);
    ctx.arc(135, -25, 34, 0, Math.PI * 2);
    ctx.fill();

    // Hand-drawn Fern / Leaf Sprigs extending upwards
    ctx.strokeStyle = '#1B4532';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    // Stem 1
    ctx.beginPath();
    ctx.moveTo(35, -20);
    ctx.quadraticCurveTo(25, -95, 40, -150);
    ctx.stroke();

    // Leaves on stem 1
    const drawLeaf = (lx: number, ly: number, angle: number, size: number, color: string) => {
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#1B4532';
      ctx.lineWidth = 2;
      ctx.beginPath();
      safeEllipse(ctx, 0, 0, size, size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    drawLeaf(28, -55, -0.6, 16, '#52B788');
    drawLeaf(36, -75, 0.5, 17, '#74C69D');
    drawLeaf(26, -95, -0.65, 17, '#52B788');
    drawLeaf(34, -118, 0.55, 16, '#74C69D');
    drawLeaf(32, -140, -0.7, 14, '#95D5B2');
    drawLeaf(40, -150, 0, 13, '#95D5B2');

    // Stem 2 (shorter, angled right)
    ctx.beginPath();
    ctx.moveTo(85, -25);
    ctx.quadraticCurveTo(95, -70, 110, -110);
    ctx.stroke();
    drawLeaf(90, -50, -0.5, 14, '#74C69D');
    drawLeaf(98, -72, 0.6, 15, '#52B788');
    drawLeaf(105, -95, -0.4, 13, '#95D5B2');

    // Little Red & Coral Wildflowers
    const drawFlower = (fx: number, fy: number, r: number, color: string, centerColor: string) => {
      ctx.save();
      ctx.translate(fx, fy);
      ctx.fillStyle = color;
      for (let p = 0; p < 5; p++) {
        const ang = (p * Math.PI * 2) / 5;
        const px = Math.cos(ang) * (r * 0.7);
        const py = Math.sin(ang) * (r * 0.7);
        ctx.beginPath();
        ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = centerColor;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    drawFlower(100, -95, 12, '#E63946', '#FFD166');
    drawFlower(125, -70, 10, '#F77F00', '#FFE3A8');
    drawFlower(145, -45, 11, '#E63946', '#FFD166');
    drawFlower(60, -85, 9, '#FCBF49', '#E63946');

    ctx.restore();

    // ── BOTTOM-RIGHT BOTANICAL CLUSTER ──
    const brX = width;
    const brY = height;

    ctx.save();
    ctx.translate(brX, brY);
    ctx.scale(scale, scale);

    // Deep Bush
    ctx.fillStyle = '#1B4532';
    ctx.beginPath();
    ctx.arc(-55, -45, 60, 0, Math.PI * 2);
    ctx.arc(-125, -35, 52, 0, Math.PI * 2);
    ctx.arc(-85, -80, 48, 0, Math.PI * 2);
    ctx.fill();

    // Sage Front
    ctx.fillStyle = '#2D6A4F';
    ctx.beginPath();
    ctx.arc(-40, -30, 44, 0, Math.PI * 2);
    ctx.arc(-95, -40, 40, 0, Math.PI * 2);
    ctx.arc(-150, -25, 36, 0, Math.PI * 2);
    ctx.fill();

    // Right Foliage Stem
    ctx.strokeStyle = '#1B4532';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-35, -20);
    ctx.quadraticCurveTo(-25, -95, -40, -150);
    ctx.stroke();

    drawLeaf(-28, -55, 0.6, 16, '#52B788');
    drawLeaf(-36, -75, -0.5, 17, '#74C69D');
    drawLeaf(-26, -95, 0.65, 17, '#52B788');
    drawLeaf(-34, -118, -0.55, 16, '#74C69D');
    drawLeaf(-38, -145, 0.2, 13, '#95D5B2');

    // Wildflowers on right
    drawFlower(-110, -90, 12, '#E63946', '#FFD166');
    drawFlower(-135, -68, 11, '#F77F00', '#FFE3A8');
    drawFlower(-160, -42, 10, '#E63946', '#FFD166');
    drawFlower(-75, -85, 9, '#FCBF49', '#E63946');

    // Golden 4-point sparkle over foliage
    drawSparkle(ctx, -70, -130, 16, '#FFD000');

    ctx.restore();

    ctx.restore();
  }

  /**
   * Illustrated Picture-Book Critters peeking from corners:
   * 1. Pink winged critter on bottom-left
   * 2. Teal bunny/alien critter with antenna on bottom-right
   * 3. Orange bird on top-right watercolor ledge
   */
  private renderCritters(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const scale = Math.min(1.2, Math.max(0.65, width / 1000));

    // 1. Cute Pink Winged Critter (Bottom-Left)
    const blX = 0;
    const blY = height;
    ctx.save();
    ctx.translate(blX, blY);
    ctx.scale(scale, scale);

    const critter1X = 220;
    const critter1Y = -55;

    // Little body
    ctx.save();
    ctx.translate(critter1X, critter1Y);

    // Cute little wing
    ctx.fillStyle = '#8B263E';
    ctx.beginPath();
    safeEllipse(ctx, 32, -6, 15, 8, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5A1627';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Body: chubby bean shape
    const bodyGrad = ctx.createLinearGradient(0, -30, 0, 20);
    bodyGrad.addColorStop(0, '#E26D7D');
    bodyGrad.addColorStop(1, '#F4A5AE');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    safeEllipse(ctx, 0, 0, 24, 28, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7D2235';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Little ears/horns
    ctx.fillStyle = '#C94A5C';
    ctx.beginPath();
    ctx.moveTo(-14, -22);
    ctx.lineTo(-20, -36);
    ctx.lineTo(-6, -26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(8, -26);
    ctx.lineTo(16, -38);
    ctx.lineTo(16, -20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cute eyes
    ctx.fillStyle = '#2B121A';
    ctx.beginPath();
    ctx.arc(-8, -8, 3.2, 0, Math.PI * 2);
    ctx.arc(8, -8, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Specular eye shine
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-9, -9, 1.2, 0, Math.PI * 2);
    ctx.arc(7, -9, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Rosy blush
    ctx.fillStyle = 'rgba(235, 75, 100, 0.55)';
    ctx.beginPath();
    safeEllipse(ctx, -14, -1, 5, 3, 0, 0, Math.PI * 2);
    safeEllipse(ctx, 14, -1, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cute happy smile
    ctx.strokeStyle = '#5A1627';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -2, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.restore();
    ctx.restore();

    // 2. Cute Teal Alien/Bunny Critter Peeking (Bottom-Right)
    const brX = width;
    const brY = height;
    ctx.save();
    ctx.translate(brX, brY);
    ctx.scale(scale, scale);

    const critter2X = -270;
    const critter2Y = -95;

    ctx.save();
    ctx.translate(critter2X, critter2Y);

    // Cute peeking posture tilted forward
    ctx.rotate(0.18);

    // Body
    ctx.fillStyle = '#489FB5';
    ctx.beginPath();
    safeEllipse(ctx, 0, 0, 22, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1B4532';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Antennae / ears
    ctx.fillStyle = '#3A7D8F';
    ctx.beginPath();
    safeEllipse(ctx, -8, -35, 4, 10, -0.2, 0, Math.PI * 2);
    safeEllipse(ctx, 8, -35, 4, 10, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#1B4532';
    ctx.beginPath();
    ctx.arc(-7, -12, 3.2, 0, Math.PI * 2);
    ctx.arc(7, -12, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-8, -13, 1.2, 0, Math.PI * 2);
    ctx.arc(6, -13, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Pink nose / blush
    ctx.fillStyle = '#FF8FA3';
    ctx.beginPath();
    ctx.arc(0, -6, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Little sweat/sparkle drop
    ctx.fillStyle = '#A2D2FF';
    ctx.beginPath();
    ctx.arc(16, -18, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();

    // 3. Cute Orange Bird perched on top-right wash
    ctx.save();
    const birdX = width * 0.8;
    const birdY = height * 0.14;
    ctx.translate(birdX, birdY);
    ctx.scale(scale * 0.85, scale * 0.85);

    // Body
    ctx.fillStyle = '#E76F51';
    ctx.beginPath();
    safeEllipse(ctx, 0, 0, 16, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6B2D1B';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Little wing
    ctx.fillStyle = '#F4A261';
    ctx.beginPath();
    safeEllipse(ctx, 4, 1, 9, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#E9C46A';
    ctx.beginPath();
    ctx.moveTo(-14, -2);
    ctx.lineTo(-24, 0);
    ctx.lineTo(-14, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Eye
    ctx.fillStyle = '#264653';
    ctx.beginPath();
    ctx.arc(-6, -4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-7, -5, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.restore();
  }
}

export const backgroundRenderer = BackgroundRenderer.getInstance();
