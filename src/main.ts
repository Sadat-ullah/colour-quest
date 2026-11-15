/* ─────────────────────────────────────────────────────────────
 *  main.ts – Colour Quest Application Entrypoint & Game Bootstrap
 *  Initializes Canvas, ScaleManager, InputManager, Audio, FX & Scenes
 * ───────────────────────────────────────────────────────────── */
import { ScaleManager } from './core/scaleManager';
import { InputManager } from './core/inputManager';
import { sceneManager } from './core/sceneManager';
import { titleScene } from './scenes/titleScene';
import { levelSelectScene } from './scenes/levelSelectScene';
import { gameplayScene } from './scenes/gameplayScene';
import { resultsModal } from './scenes/resultsModal';
import { audioManager } from './audio/audioManager';
import { initMobileUnlock } from './audio/mobileUnlock';
import { particleEmitter } from './fx/particles';
import { confettiSystem } from './fx/confetti';
import { getLevel } from './game/levelsData';
import { eventBus } from './shared/eventBus';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from './shared/constants';

function bootstrap(): void {
  const container = document.getElementById('game-container');
  if (!container) {
    console.error('[ColourQuest] Container #game-container not found!');
    return;
  }

  // 1. Create and mount high-DPI HTML5 canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'game-canvas';
  canvas.width = DESIGN_WIDTH;
  canvas.height = DESIGN_HEIGHT;
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[ColourQuest] 2D canvas context could not be created.');
    return;
  }
  const renderCtx: CanvasRenderingContext2D = ctx;

  // 2. Scale & Input Managers
  const scaleManager = new ScaleManager(canvas, container);
  const inputManager = new InputManager(canvas, scaleManager);

  // 3. Audio & Web Audio instant mobile unlock
  initMobileUnlock();

  // 4. Register all scenes in state machine
  sceneManager.register(titleScene);
  sceneManager.register(levelSelectScene);
  sceneManager.register(gameplayScene);
  sceneManager.register(resultsModal);

  // 5. Connect gameplay scene hooks
  gameplayScene.onPlaySound = (sound: string) => {
    audioManager.playSound(sound);
  };

  gameplayScene.onSpawnSparkles = (x: number, y: number, color: string) => {
    particleEmitter.spawnSparkles(x, y, color, 24);
    particleEmitter.spawnRipple(x, y, color);
  };

  gameplayScene.onGetLevel = (id: number) => {
    return getLevel(id);
  };

  // 6. Connect global eventBus listeners
  eventBus.on('level:start', ({ levelId }) => {
    audioManager.playSound('tap');
    sceneManager.switchTo('gameplay', { levelId });
  });

  eventBus.on('level:complete', ({ result }) => {
    audioManager.playLevelComplete(result.stars);
    if (result.stars === 3) {
      confettiSystem.celebrate(DESIGN_WIDTH, DESIGN_HEIGHT, 150);
    }
  });

  // 7. Handle Unified Touch / Pointer Tap Events
  inputManager.onTap((e) => {
    sceneManager.handleTap(e.x, e.y);
  });

  // 8. 60 FPS RequestAnimationFrame Game Loop
  let lastTime = performance.now();

  function gameLoop(time: number): void {
    const rawDt = time - lastTime;
    lastTime = time;

    // Clamp dt to max 100ms to prevent huge jumps after tab freeze
    const dt = Math.min(rawDt, 100);
    const dtSeconds = dt / 1000;

    // Update active scene and particles
    sceneManager.update(dt);
    particleEmitter.update(dtSeconds);
    confettiSystem.update(dtSeconds);

    // Clear and Render
    renderCtx.clearRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    sceneManager.render(renderCtx);

    // Render Particle & Confetti FX Overlays
    particleEmitter.draw(renderCtx);
    confettiSystem.draw(renderCtx);

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);

  // 9. Start with Title Screen
  sceneManager.switchTo('title');

  // 10. Register Service Worker for PWA offline play
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
    });
  }

  console.log('[ColourQuest] Game initialized successfully. Ready to play!');
}

// Bootstrap on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
