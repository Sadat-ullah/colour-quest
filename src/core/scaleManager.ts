/* ─────────────────────────────────────────────────────────────
 *  scaleManager.ts – Responsive HTML5 Canvas Scale Manager
 *  Maintains aspect ratio, eliminates distortion, handles mobile portrait,
 *  tablet and desktop with zero letterboxing (100vw x 100dvh).
 * ───────────────────────────────────────────────────────────── */
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../shared/constants';

export type Breakpoint = 'DESKTOP_LANDSCAPE' | 'TABLET' | 'MOBILE_PORTRAIT';

export interface ViewportTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  displayWidth: number;
  displayHeight: number;
  virtualWidth: number;
  virtualHeight: number;
  isPortrait: boolean;
  breakpoint: Breakpoint;
  dpr: number;
}

export class ScaleManager {
  public static instance: ScaleManager | null = null;

  private canvas: HTMLCanvasElement;
  private container: HTMLElement;
  private transform: ViewportTransform = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    displayWidth: DESIGN_WIDTH,
    displayHeight: DESIGN_HEIGHT,
    virtualWidth: DESIGN_WIDTH,
    virtualHeight: DESIGN_HEIGHT,
    isPortrait: false,
    breakpoint: 'DESKTOP_LANDSCAPE',
    dpr: 1,
  };
  private resizeHandlers = new Set<(t: ViewportTransform) => void>();

  constructor(canvas: HTMLCanvasElement, container: HTMLElement) {
    this.canvas = canvas;
    this.container = container;
    ScaleManager.instance = this;
    this.init();
  }

  public static getInstance(): ScaleManager | null {
    return ScaleManager.instance;
  }

  private init(): void {
    // Attach resize listeners
    window.addEventListener('resize', () => this.updateLayout());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.updateLayout(), 150);
    });

    if (typeof ResizeObserver !== 'undefined' && this.container) {
      const ro = new ResizeObserver(() => {
        this.updateLayout();
      });
      ro.observe(this.container);
    }

    this.updateLayout();
  }

  public updateLayout(): void {
    const cW = this.container?.clientWidth;
    const cH = this.container?.clientHeight;
    const windowWidth = Math.max(320, (cW && cW > 0) ? cW : ((typeof window !== 'undefined' && window.innerWidth) || DESIGN_WIDTH));
    const windowHeight = Math.max(480, (cH && cH > 0) ? cH : ((typeof window !== 'undefined' && window.innerHeight) || DESIGN_HEIGHT));
    const aspect = windowWidth / windowHeight;

    let breakpoint: Breakpoint = 'DESKTOP_LANDSCAPE';
    let virtualWidth = DESIGN_WIDTH;
    let virtualHeight = DESIGN_HEIGHT;

    if (aspect < 0.85) {
      breakpoint = 'MOBILE_PORTRAIT';
      virtualWidth = 720;
      virtualHeight = Math.max(1280, Math.round(720 / aspect));
    } else if (aspect < 1.25) {
      breakpoint = 'TABLET';
      virtualWidth = 1024;
      virtualHeight = Math.round(1024 / aspect);
    } else {
      breakpoint = 'DESKTOP_LANDSCAPE';
      virtualHeight = 720;
      virtualWidth = Math.max(1280, Math.round(720 * aspect));
    }

    const isPortrait = windowHeight > windowWidth;
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.5) : 1;

    // Canvas internal buffer sized with DPR for crisp retina lines
    this.canvas.width = Math.round(virtualWidth * dpr);
    this.canvas.height = Math.round(virtualHeight * dpr);

    // Canvas fills 100% of container with zero letterboxing
    this.canvas.style.width = `${windowWidth}px`;
    this.canvas.style.height = `${windowHeight}px`;
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = '0px';
    this.canvas.style.top = '0px';
    this.canvas.style.touchAction = 'none';

    const scale = windowWidth / virtualWidth;

    this.transform = {
      scale,
      offsetX: 0,
      offsetY: 0,
      displayWidth: windowWidth,
      displayHeight: windowHeight,
      virtualWidth,
      virtualHeight,
      isPortrait,
      breakpoint,
      dpr,
    };

    // Notify listeners
    this.resizeHandlers.forEach((handler) => handler(this.transform));
  }

  public getTransform(): ViewportTransform {
    return this.transform;
  }

  public getBreakpoint(): Breakpoint {
    return this.transform.breakpoint;
  }

  public getVirtualWidth(): number {
    return this.transform.virtualWidth;
  }

  public getVirtualHeight(): number {
    return this.transform.virtualHeight;
  }

  public getDpr(): number {
    return this.transform.dpr;
  }

  public isPortrait(): boolean {
    return this.transform.isPortrait;
  }

  public onResize(handler: (t: ViewportTransform) => void): () => void {
    this.resizeHandlers.add(handler);
    return () => this.resizeHandlers.delete(handler);
  }

  /**
   * Converts client screen (clientX, clientY) coordinates to design canvas coordinates
   */
  public clientToCanvas(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();

    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }

    const { virtualWidth, virtualHeight } = this.transform;
    const scaleX = rect.width / virtualWidth;
    const scaleY = rect.height / virtualHeight;

    const x = (clientX - rect.left) / scaleX;
    const y = (clientY - rect.top) / scaleY;

    return {
      x: Math.max(0, Math.min(virtualWidth, x)),
      y: Math.max(0, Math.min(virtualHeight, y)),
    };
  }
}
