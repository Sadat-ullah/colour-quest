/* ─────────────────────────────────────────────────────────────
 *  sceneManager.ts – Game Scene State Machine
 *  Orchestrates transitions between Title, LevelSelect, Gameplay, and Results
 * ───────────────────────────────────────────────────────────── */
import type { SceneName } from '../shared/contracts';
import { eventBus } from '../shared/eventBus';

export interface Scene {
  name: SceneName;
  enter(params?: Record<string, unknown>): void;
  exit(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  onTap(x: number, y: number): void;
}

export class SceneManager {
  private scenes = new Map<SceneName, Scene>();
  private currentScene: Scene | null = null;
  private currentSceneName: SceneName = 'boot';

  public register(scene: Scene): void {
    this.scenes.set(scene.name, scene);
  }

  public switchTo(name: SceneName, params?: Record<string, unknown>): void {
    const nextScene = this.scenes.get(name);
    if (!nextScene) {
      console.error(`[SceneManager] Scene "${name}" not registered!`);
      return;
    }

    const prevName = this.currentSceneName;

    if (this.currentScene) {
      this.currentScene.exit();
    }

    this.currentScene = nextScene;
    this.currentSceneName = name;
    this.currentScene.enter(params);

    eventBus.emit('scene:change', { from: prevName, to: name });
  }

  public getCurrentSceneName(): SceneName {
    return this.currentSceneName;
  }

  public getCurrentScene(): Scene | null {
    return this.currentScene;
  }

  public update(dt: number): void {
    if (this.currentScene) {
      this.currentScene.update(dt);
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (this.currentScene) {
      this.currentScene.render(ctx);
    }
  }

  public handleTap(x: number, y: number): void {
    if (this.currentScene) {
      this.currentScene.onTap(x, y);
    }
  }
}

export const sceneManager = new SceneManager();
