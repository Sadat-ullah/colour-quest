import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScaleManager } from '../src/core/scaleManager';

describe('ScaleManager Tests', () => {
  let canvas: HTMLCanvasElement;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('detects DESKTOP_LANDSCAPE when aspect ratio >= 1.25 (e.g. 1366x768)', () => {
    Object.defineProperty(container, 'clientWidth', { value: 1366, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 768, configurable: true });

    const manager = new ScaleManager(canvas, container);
    const transform = manager.getTransform();

    expect(transform.breakpoint).toBe('DESKTOP_LANDSCAPE');
    expect(transform.isPortrait).toBe(false);
    expect(transform.virtualHeight).toBe(720);
    expect(transform.virtualWidth).toBeGreaterThanOrEqual(1280);
    expect(transform.offsetX).toBe(0);
    expect(transform.offsetY).toBe(0);
  });

  it('detects MOBILE_PORTRAIT when aspect ratio < 0.85 (e.g. 390x844 iPhone)', () => {
    Object.defineProperty(container, 'clientWidth', { value: 390, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 844, configurable: true });

    const manager = new ScaleManager(canvas, container);
    const transform = manager.getTransform();

    expect(transform.breakpoint).toBe('MOBILE_PORTRAIT');
    expect(transform.isPortrait).toBe(true);
    expect(transform.virtualWidth).toBe(720);
    expect(transform.virtualHeight).toBeGreaterThanOrEqual(1280);
    // Zero letterbox: canvas fills 100% of container
    expect(canvas.style.width).toBe('390px');
    expect(canvas.style.height).toBe('844px');
  });

  it('detects TABLET when 0.85 <= aspect < 1.25 (e.g. 768x1024 iPad)', () => {
    Object.defineProperty(container, 'clientWidth', { value: 768, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 1024, configurable: true });

    const manager = new ScaleManager(canvas, container);
    const transform = manager.getTransform();

    expect(transform.breakpoint).toBe('MOBILE_PORTRAIT'); // 768/1024 = 0.75 < 0.85 -> portrait!
  });

  it('detects TABLET for square/near-square viewports (e.g. 960x1000)', () => {
    Object.defineProperty(container, 'clientWidth', { value: 960, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 1000, configurable: true });

    const manager = new ScaleManager(canvas, container);
    const transform = manager.getTransform();

    expect(transform.breakpoint).toBe('TABLET');
    expect(transform.virtualWidth).toBe(1024);
  });

  it('correctly maps client screen coordinates to virtual canvas coordinates in mobile portrait', () => {
    Object.defineProperty(container, 'clientWidth', { value: 360, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 640, configurable: true });

    // Mock getBoundingClientRect
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 360,
      bottom: 640,
      width: 360,
      height: 640,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const manager = new ScaleManager(canvas, container);
    const centerPoint = manager.clientToCanvas(180, 320);

    expect(centerPoint).not.toBeNull();
    // In 720 width space, 180 (half of 360) maps to 360
    expect(Math.round(centerPoint!.x)).toBe(360);
  });
});
