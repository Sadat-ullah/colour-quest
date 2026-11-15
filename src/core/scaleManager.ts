/* ─────────────────────────────────────────────────────────────
 *  scaleManager.ts – Responsive HTML5 Canvas Scale Manager
 *  Maintains aspect ratio, eliminates distortion, handles mobile portrait & landscape
 * ───────────────────────────────────────────────────────────── */
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../shared/constants';

export interface ViewportTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  displayWidth: number;
  displayHeight: number;
  isPortrait: boolean;
}

export class ScaleManager {
  private canvas: HTMLCanvasElement;
  private container: HTMLElement;
  private transform: ViewportTransform = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    displayWidth: DESIGN_WIDTH,
    displayHeight: DESIGN_HEIGHT,
    isPortrait: false,
  };
  private resizeHandlers = new Set<(t: ViewportTransform) => void>();

  constructor(canvas: HTMLCanvasElement, container: HTMLElement) {
    this.canvas = canvas;
    this.container = container;
    this.init();
  }

  private init(): void {
    // Canvas internal resolution locked to DESIGN_WIDTH x DESIGN_HEIGHT
    this.canvas.width = DESIGN_WIDTH;
    this.canvas.height = DESIGN_HEIGHT;

    // Attach resize listener
    window.addEventListener('resize', () => this.updateLayout());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.updateLayout(), 150);
    });

    this.updateLayout();
  }

  public updateLayout(): void {
    const windowWidth = this.container.clientWidth || window.innerWidth;
    const windowHeight = this.container.clientHeight || window.innerHeight;

    const isPortrait = windowHeight > windowWidth;

    // Calculate scale to fit within container while preserving 16:9 aspect ratio
    const scaleX = windowWidth / DESIGN_WIDTH;
    const scaleY = windowHeight / DESIGN_HEIGHT;
    const scale = Math.min(scaleX, scaleY);

    const displayWidth = Math.round(DESIGN_WIDTH * scale);
    const displayHeight = Math.round(DESIGN_HEIGHT * scale);

    const offsetX = Math.round((windowWidth - displayWidth) / 2);
    const offsetY = Math.round((windowHeight - displayHeight) / 2);

    // Apply CSS styling to position canvas centrally with crisp pixel density
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = `${offsetX}px`;
    this.canvas.style.top = `${offsetY}px`;

    this.transform = {
      scale,
      offsetX,
      offsetY,
      displayWidth,
      displayHeight,
      isPortrait,
    };

    // Notify listeners
    this.resizeHandlers.forEach(handler => handler(this.transform));
  }

  public getTransform(): ViewportTransform {
    return this.transform;
  }

  public onResize(handler: (t: ViewportTransform) => void): () => void {
    this.resizeHandlers.add(handler);
    return () => this.resizeHandlers.delete(handler);
  }

  /**
   * Converts client screen (clientX, clientY) coordinates to design canvas coordinates (0..1280, 0..720)
   */
  public clientToCanvas(clientX: number, clientY: number): { x: number; y: number } | null {
    const { offsetX, offsetY, displayWidth, displayHeight, scale } = this.transform;

    // Check if point is inside canvas bounds
    if (
      clientX < offsetX ||
      clientX > offsetX + displayWidth ||
      clientY < offsetY ||
      clientY > offsetY + displayHeight
    ) {
      return null;
    }

    const x = (clientX - offsetX) / scale;
    const y = (clientY - offsetY) / scale;

    return {
      x: Math.max(0, Math.min(DESIGN_WIDTH, x)),
      y: Math.max(0, Math.min(DESIGN_HEIGHT, y)),
    };
  }
}
