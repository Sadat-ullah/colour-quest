// Global polyfills for headless / happy-dom test environments

if (typeof globalThis.Path2D === 'undefined') {
  class MockPath2D {
    public commands: unknown[] = [];
    arc(...args: unknown[]) { this.commands.push(['arc', ...args]); }
    arcTo(...args: unknown[]) { this.commands.push(['arcTo', ...args]); }
    ellipse(...args: unknown[]) { this.commands.push(['ellipse', ...args]); }
    rect(...args: unknown[]) { this.commands.push(['rect', ...args]); }
    moveTo(...args: unknown[]) { this.commands.push(['moveTo', ...args]); }
    lineTo(...args: unknown[]) { this.commands.push(['lineTo', ...args]); }
    bezierCurveTo(...args: unknown[]) { this.commands.push(['bezierCurveTo', ...args]); }
    closePath() { this.commands.push(['closePath']); }
  }
  // @ts-expect-error polyfill
  globalThis.Path2D = MockPath2D;
  if (typeof window !== 'undefined') {
    // @ts-expect-error polyfill
    window.Path2D = MockPath2D;
  }
}
