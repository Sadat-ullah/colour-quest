/* ─────────────────────────────────────────────────────────────
 *  audioManager.ts – Master Audio Coordinator for Colour Quest
 *  Coordinates procedural sound effects and background music.
 *  Listens to eventBus for settings and mobile unlock events.
 * ───────────────────────────────────────────────────────────── */

import { eventBus } from '../shared/eventBus';
import type { PlayerSettings } from '../shared/contracts';
import { MUSIC_DEFAULT_VOL, SFX_DEFAULT_VOL } from '../shared/constants';
import { musicSynth, MusicSynth } from './musicSynth';
import {
  soundEffects,
  SoundEffects,
  playTap,
  playSelect,
  playFill,
  playCorrect,
  playStar,
  playLevelComplete,
  playMismatch,
  playClear,
  playNextLevel,
  playLevelTransition,
  stopCelebration,
} from './soundEffects';
import { unlockAudio, isAudioUnlocked, initMobileUnlock, getAudioContext } from './mobileUnlock';

export class AudioManager {
  private musicVolume: number = MUSIC_DEFAULT_VOL;
  private sfxVolume: number = SFX_DEFAULT_VOL;
  private musicMuted: boolean = false;
  private sfxMuted: boolean = false;
  private musicWanted: boolean = false;

  constructor() {
    this.init();
  }

  private init(): void {
    // Sync initial state with sub-synthesizers
    musicSynth.setVolume(this.musicVolume);
    musicSynth.setMuted(this.musicMuted);
    soundEffects.setVolume(this.sfxVolume);
    soundEffects.setMuted(this.sfxMuted);

    // Listen to settings changes from saveManager / UI
    eventBus.on('settings:change', ({ settings }) => {
      this.handleSettingsChange(settings);
    });

    // Listen to mobile audio unlock event
    eventBus.on('audio:unlock', () => {
      this.handleAudioUnlocked();
    });

    // Ensure mobile unlock listeners are initialized
    initMobileUnlock();
  }

  private handleSettingsChange(settings: PlayerSettings): void {
    if (typeof settings.musicVolume === 'number') {
      this.setMusicVolume(settings.musicVolume);
    }
    if (typeof settings.sfxVolume === 'number') {
      this.setSfxVolume(settings.sfxVolume);
    }
    if (typeof settings.musicMuted === 'boolean') {
      this.setMusicMuted(settings.musicMuted);
    }
    if (typeof settings.sfxMuted === 'boolean') {
      this.setSfxMuted(settings.sfxMuted);
    }
  }

  private handleAudioUnlocked(): void {
    // If background music was started prior to user gesture, resume/start it now
    if (this.musicWanted && !this.musicMuted && !musicSynth.isPlaying()) {
      musicSynth.start();
    }
  }

  // ── Settings Getters / Setters ──

  public getSettings(): PlayerSettings {
    return {
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
      musicMuted: this.musicMuted,
      sfxMuted: this.sfxMuted,
    };
  }

  public applySettings(settings: Partial<PlayerSettings>): void {
    if (typeof settings.musicVolume === 'number') {
      this.setMusicVolume(settings.musicVolume);
    }
    if (typeof settings.sfxVolume === 'number') {
      this.setSfxVolume(settings.sfxVolume);
    }
    if (typeof settings.musicMuted === 'boolean') {
      this.setMusicMuted(settings.musicMuted);
    }
    if (typeof settings.sfxMuted === 'boolean') {
      this.setSfxMuted(settings.sfxMuted);
    }

    eventBus.emit('settings:change', { settings: this.getSettings() });
  }

  public setMusicVolume(vol: number): void {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    musicSynth.setVolume(this.musicVolume);
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    soundEffects.setVolume(this.sfxVolume);
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public setMusicMuted(muted: boolean): void {
    this.musicMuted = muted;
    musicSynth.setMuted(muted);
    if (!muted && this.musicWanted && !musicSynth.isPlaying() && isAudioUnlocked()) {
      musicSynth.start();
    }
  }

  public isMusicMuted(): boolean {
    return this.musicMuted;
  }

  public toggleMusicMute(): boolean {
    this.setMusicMuted(!this.musicMuted);
    eventBus.emit('settings:change', { settings: this.getSettings() });
    return this.musicMuted;
  }

  public setSfxMuted(muted: boolean): void {
    this.sfxMuted = muted;
    soundEffects.setMuted(muted);
  }

  public isSfxMuted(): boolean {
    return this.sfxMuted;
  }

  public toggleSfxMute(): boolean {
    this.setSfxMuted(!this.sfxMuted);
    eventBus.emit('settings:change', { settings: this.getSettings() });
    return this.sfxMuted;
  }

  // ── Music Controls ──

  public startMusic(): void {
    this.musicWanted = true;
    if (isAudioUnlocked() || (getAudioContext() && getAudioContext()!.state === 'running')) {
      musicSynth.start();
    }
  }

  public stopMusic(): void {
    this.musicWanted = false;
    musicSynth.stop();
  }

  public pauseMusic(): void {
    musicSynth.pause();
  }

  public resumeMusic(): void {
    this.musicWanted = true;
    if (isAudioUnlocked() || (getAudioContext() && getAudioContext()!.state === 'running')) {
      musicSynth.resume();
    }
  }

  public isMusicPlaying(): boolean {
    return musicSynth.isPlaying();
  }

  // ── Sound Effects Controls ──

  public playTap(vol?: number): void {
    soundEffects.playTap(vol);
  }

  public playSelect(vol?: number): void {
    soundEffects.playSelect(vol);
  }

  public playFill(vol?: number): void {
    soundEffects.playFill(vol);
  }

  public playCorrect(vol?: number): void {
    soundEffects.playCorrect(vol);
  }

  public playStar(starIndex: number = 1, vol?: number): void {
    soundEffects.playStar(starIndex, vol);
  }

  public playLevelComplete(stars: number = 3, vol?: number): void {
    soundEffects.playLevelComplete(stars, vol);
  }

  public playMismatch(vol?: number): void {
    soundEffects.playMismatch(vol);
  }

  public playClear(vol?: number): void {
    soundEffects.playClear(vol);
  }

  public playNextLevel(vol?: number): void {
    soundEffects.playNextLevel(vol);
  }

  public playLevelTransition(vol?: number): void {
    soundEffects.playLevelTransition(vol);
  }

  public stopCelebration(): void {
    soundEffects.stopCelebration();
  }

  /**
   * Universal sound dispatcher for scenes and UI hooks (e.g. gameplayScene.onPlaySound)
   */
  public playSound(sound: string, ...args: unknown[]): void {
    const key = sound.toLowerCase().trim();
    switch (key) {
      case 'level_transition':
      case 'leveltransition':
      case 'transition':
        this.playLevelTransition(typeof args[0] === 'number' ? args[0] : undefined);
        break;
      case 'nextlevel':
      case 'next_level':
      case 'next':
        this.playNextLevel(typeof args[0] === 'number' ? args[0] : undefined);
        break;
      case 'tap':
      case 'click':
      case 'button':
        this.playTap(typeof args[0] === 'number' ? args[0] : undefined);
        break;
      case 'select':
      case 'palette':
      case 'color':
        this.playSelect(typeof args[0] === 'number' ? args[0] : undefined);
        break;
      case 'fill':
      case 'brush':
      case 'paint':
        this.playFill(typeof args[0] === 'number' ? args[0] : undefined);
        break;
      case 'correct':
      case 'match':
      case 'success':
        this.playCorrect(typeof args[0] === 'number' ? args[0] : undefined);
        break;
      case 'star':
        this.playStar(
          typeof args[0] === 'number' ? args[0] : 1,
          typeof args[1] === 'number' ? args[1] : undefined
        );
        break;
      case 'levelcomplete':
      case 'level_complete':
      case 'complete':
      case 'fanfare':
      case 'win':
        this.playLevelComplete(
          typeof args[0] === 'number' ? args[0] : 3,
          typeof args[1] === 'number' ? args[1] : undefined
        );
        break;
      case 'mismatch':
      case 'wrong':
      case 'error':
      case 'boing':
        this.playMismatch(typeof args[0] === 'number' ? args[0] : undefined);
        break;
      case 'clear':
      case 'undo':
      case 'reset':
      case 'rewind':
        this.playClear(typeof args[0] === 'number' ? args[0] : undefined);
        break;
      default:
        console.warn(`[AudioManager] Unknown sound effect: "${sound}"`);
    }
  }

  // ── Mobile Unlock Helpers ──

  public async unlock(): Promise<boolean> {
    return unlockAudio();
  }

  public isUnlocked(): boolean {
    return isAudioUnlocked();
  }
}

export const audioManager = new AudioManager();

// Re-exports for convenience
export {
  musicSynth,
  MusicSynth,
  soundEffects,
  SoundEffects,
  playTap,
  playSelect,
  playFill,
  playCorrect,
  playStar,
  playLevelComplete,
  playMismatch,
  playClear,
  playNextLevel,
  playLevelTransition,
  stopCelebration,
  unlockAudio,
  isAudioUnlocked,
  initMobileUnlock,
  getAudioContext,
};
