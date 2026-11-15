/* ─────────────────────────────────────────────────────────────
 *  eventBus.ts – FROZEN typed event bus
 *  All agents may read; NO agent may change existing signatures.
 * ───────────────────────────────────────────────────────────── */
import type { GameEvents } from './contracts';

type Handler<T> = (payload: T) => void;

class EventBus {
  private listeners = new Map<string, Set<Handler<unknown>>>();

  on<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler as Handler<unknown>);
  }

  off<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): void {
    this.listeners.get(event)?.delete(handler as Handler<unknown>);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    this.listeners.get(event)?.forEach(h => {
      try { h(payload); } catch (e) { console.error(`[EventBus] Error in ${event} handler:`, e); }
    });
  }

  once<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): void {
    const wrapper: Handler<GameEvents[K]> = (p) => { this.off(event, wrapper); handler(p); };
    this.on(event, wrapper);
  }

  clear(): void { this.listeners.clear(); }
}

export const eventBus = new EventBus();
