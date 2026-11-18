/* ─────────────────────────────────────────────────────────────
 *  inputManager.ts – Unified Pointer & Touch Input Handler
 *  Prevents native mobile gestures, maps coordinates to design space, detects taps
 * ───────────────────────────────────────────────────────────── */
import type { ScaleManager } from './scaleManager';
import { getAudioContext } from '../audio/mobileUnlock';

export interface TapEvent {
  x: number;          // design canvas x (0..1280)
  y: number;          // design canvas y (0..720)
  originalEvent: PointerEvent | TouchEvent | MouseEvent;
}

export class InputManager {
  private canvas: HTMLCanvasElement;
  private scaleManager: ScaleManager;
  private tapHandlers = new Set<(e: TapEvent) => void>();
  private pointerDownTime = 0;
  private pointerDownPos: { x: number; y: number } | null = null;
  private activePointerId: number | null = null;

  constructor(canvas: HTMLCanvasElement, scaleManager: ScaleManager) {
    this.canvas = canvas;
    this.scaleManager = scaleManager;
    this.setupListeners();
  }

  private lastTapTimestamp = 0;

  private setupListeners(): void {
    // 1. Prevent native browser gestures on the canvas & container
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });

    // Prevent pinch-zoom & double-tap zoom on document body
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());
    document.addEventListener('gestureend', (e) => e.preventDefault());

    // 2. Modern unified pointer events
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.onPointerCancel(e));

    // 3. Fallback click handler (debounced)
    this.canvas.addEventListener('click', (e) => {
      const now = performance.now();
      if (now - this.lastTapTimestamp > 250) {
        this.emitTap(e.clientX, e.clientY, e);
      }
    });
  }

  private emitTap(clientX: number, clientY: number, originalEvent: UIEvent): void {
    this.lastTapTimestamp = performance.now();
    const canvasCoord = this.scaleManager.clientToCanvas(clientX, clientY);
    if (canvasCoord) {
      const tapEv: TapEvent = {
        x: canvasCoord.x,
        y: canvasCoord.y,
        originalEvent: originalEvent as any,
      };
      this.tapHandlers.forEach((handler) => handler(tapEv));
    }
  }

  private handleTouchStart(e: TouchEvent): void {
    if (e.touches.length > 1) {
      e.preventDefault(); // prevent multi-touch zoom
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    // touch end handled via pointer events
  }

  private onPointerDown(e: PointerEvent): void {
    // Immediately awaken AudioContext synchronously during pointerdown user gesture
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Only accept primary pointer or first touch to avoid chaotic multi-touch glitches
    if (this.activePointerId !== null && this.activePointerId !== e.pointerId) {
      return;
    }

    this.activePointerId = e.pointerId;
    this.pointerDownTime = performance.now();
    this.pointerDownPos = { x: e.clientX, y: e.clientY };

    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if setPointerCapture fails on some mobile browsers
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.activePointerId !== e.pointerId) return;

    const dt = performance.now() - this.pointerDownTime;
    const startPos = this.pointerDownPos;

    this.activePointerId = null;
    this.pointerDownPos = null;

    if (!startPos) return;

    const dx = e.clientX - startPos.x;
    const dy = e.clientY - startPos.y;
    const distSq = dx * dx + dy * dy;

    // Detect tap: duration < 600ms and movement < 20px
    if (dt < 600 && distSq < 400) {
      this.emitTap(e.clientX, e.clientY, e);
    }
  }

  private onPointerCancel(e: PointerEvent): void {
    if (this.activePointerId === e.pointerId) {
      this.activePointerId = null;
      this.pointerDownPos = null;
    }
  }

  public onTap(handler: (e: TapEvent) => void): () => void {
    this.tapHandlers.add(handler);
    return () => this.tapHandlers.delete(handler);
  }
}
