/* ─────────────────────────────────────────────────────────────
 *  soundEffects.ts – Procedural Web Audio Sound Effects & BGM
 *  Zero external audio files required. Instant low-latency synthesis.
 * ───────────────────────────────────────────────────────────── */

import { getAudioContext } from './mobileUnlock';
import { SFX_DEFAULT_VOL } from '../shared/constants';

let cachedNoiseBuffer: AudioBuffer | null = null;

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!cachedNoiseBuffer || cachedNoiseBuffer.sampleRate !== ctx.sampleRate) {
    const bufferSize = ctx.sampleRate; // 1 second of noise
    cachedNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = cachedNoiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return cachedNoiseBuffer;
}

export class SoundEffects {
  private volume: number = SFX_DEFAULT_VOL;
  private muted: boolean = false;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private currentContext: AudioContext | null = null;
  private activeCelebrationNodes: Array<{ osc?: OscillatorNode; gain: GainNode }> = [];

  // BGM State
  private bgmIntervalId: any = null;
  private bgmStep: number = 0;
  private bgmVolume: number = 0.3;

  private getMasterNode(ctx: AudioContext): GainNode {
    if (!this.masterGain || this.currentContext !== ctx) {
      this.currentContext = ctx;
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, ctx.currentTime);

      if (typeof ctx.createDynamicsCompressor === 'function') {
        this.compressor = ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-12, ctx.currentTime);
        this.compressor.knee.setValueAtTime(10, ctx.currentTime);
        this.compressor.ratio.setValueAtTime(8, ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, ctx.currentTime);
        this.compressor.release.setValueAtTime(0.25, ctx.currentTime);

        this.masterGain.connect(this.compressor);
        this.compressor.connect(ctx.destination);
      } else {
        this.masterGain.connect(ctx.destination);
      }
    }
    return this.masterGain;
  }

  public registerCelebrationNode(gain: GainNode, osc?: OscillatorNode): void {
    this.activeCelebrationNodes.push({ osc, gain });
  }

  public stopCelebration(): void {
    if (!this.currentContext) return;
    const now = this.currentContext.currentTime;
    for (const item of this.activeCelebrationNodes) {
      try {
        item.gain.gain.cancelScheduledValues(now);
        item.gain.gain.setValueAtTime(Math.max(0.0001, item.gain.gain.value), now);
        item.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        if (item.osc) {
          item.osc.stop(now + 0.055);
        }
      } catch {}
    }
    this.activeCelebrationNodes = [];
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.currentContext) {
      const now = this.currentContext.currentTime;
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, now, 0.015);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.currentContext) {
      const now = this.currentContext.currentTime;
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, now, 0.015);
    }
    if (muted) {
      this.stopBGM();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private prepareContext(): { ctx: AudioContext; master: GainNode } | null {
    if (this.muted || this.volume <= 0.001) return null;
    const ctx = getAudioContext();
    if (!ctx) return null;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const master = this.getMasterNode(ctx);
    return { ctx, master };
  }

  /**
   * 1. playTap: Super bouncy cartoon balloon/bubble pop squeak
   */
  public playTap(volMultiplier: number = 1.0): void {
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.7 * vol, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    gain.gain.setValueAtTime(0, now + 0.095);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.1);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  /**
   * 2. playSelect: Magical xylophone bounce blip
   */
  public playSelect(volMultiplier: number = 1.0): void {
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.06);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.6 * vol, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.13);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  /**
   * 3. playFill: Cheerful playful water slide glissando
   */
  public playFill(volMultiplier: number = 1.0): void {
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(950, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.25);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.5 * vol, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.3);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  /**
   * 4. playCorrect: Bright joyful multi-note marimba success chime
   */
  public playCorrect(volMultiplier: number = 1.0): void {
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const noteTime = now + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.0001, noteTime);
      gain.gain.linearRampToValueAtTime(0.55 * vol, noteTime + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.4);

      osc.connect(gain);
      gain.connect(master);
      osc.start(noteTime);
      osc.stop(noteTime + 0.45);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  /**
   * 5. playStar: Sparkling fairy dust shimmer arpeggio
   */
  public playStar(starIndex: number = 1, volMultiplier: number = 1.0): void {
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    const baseFreq = starIndex === 1 ? 1046.50 : starIndex === 2 ? 1318.51 : 1567.98;
    const sparkleNotes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2];

    sparkleNotes.forEach((freq, idx) => {
      const noteTime = now + idx * 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.0001, noteTime);
      gain.gain.linearRampToValueAtTime(0.4 * vol, noteTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.5);

      osc.connect(gain);
      gain.connect(master);
      this.registerCelebrationNode(gain, osc);

      osc.start(noteTime);
      osc.stop(noteTime + 0.55);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  /**
   * 6. playLevelComplete: Grand celebratory victory fanfare
   */
  public playLevelComplete(stars: number = 3, volMultiplier: number = 1.0): void {
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    const melody = [
      { freq: 523.25, time: 0.0, dur: 0.15 },
      { freq: 659.25, time: 0.15, dur: 0.15 },
      { freq: 783.99, time: 0.3, dur: 0.15 },
      { freq: 1046.50, time: 0.45, dur: 0.5 },
    ];

    melody.forEach(({ freq, time, dur }) => {
      const noteTime = now + time;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.0001, noteTime);
      gain.gain.linearRampToValueAtTime(0.6 * vol, noteTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + dur);

      osc.connect(gain);
      gain.connect(master);
      this.registerCelebrationNode(gain, osc);

      osc.start(noteTime);
      osc.stop(noteTime + dur + 0.05);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  /**
   * 7. playMismatch: Friendly, non-punishing soft cartoon wobble "Oops!"
   */
  public playMismatch(volMultiplier: number = 1.0): void {
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.2);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.45 * vol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.25);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  /**
   * 8. playClear: Whimsical whoosh reset
   */
  public playClear(volMultiplier: number = 1.0): void {
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.35 * vol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.25);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  public playLetsPlay(volMultiplier: number = 1.0): void {
    this.stopCelebration();
    this.playTap(volMultiplier);
  }

  public playNextLevel(volMultiplier: number = 1.0): void {
    this.stopCelebration();
    this.playTap(volMultiplier);
  }

  public playLevelTransition(volMultiplier: number = 1.0): void {
    this.stopCelebration();
    this.playTap(volMultiplier);
  }

  /**
   * 9. Background Music (BGM): Generative cute nursery-rhyme loop
   */
  public startBGM(): void {
    if (this.bgmIntervalId || this.muted) return;
    
    const chordNotes = [523.25, 659.25, 783.99, 1046.50, 783.99, 659.25];
    
    this.bgmIntervalId = setInterval(() => {
      if (this.muted) return;
      const ready = this.prepareContext();
      if (!ready) return;
      const { ctx, master } = ready;
      const now = ctx.currentTime;

      const freq = chordNotes[this.bgmStep % chordNotes.length];
      this.bgmStep++;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const bgmVol = this.bgmVolume * 0.15;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(bgmVol, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

      osc.connect(gain);
      gain.connect(master);

      osc.start(now);
      osc.stop(now + 0.65);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }, 450);
  }

  public stopBGM(): void {
    if (this.bgmIntervalId) {
      clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
      this.bgmStep = 0;
    }
  }

  public toggleBGM(): boolean {
    if (this.bgmIntervalId) {
      this.stopBGM();
      return false;
    } else {
      this.startBGM();
      return true;
    }
  }
}

export const soundEffects = new SoundEffects();

// Convenience standalone exports
export const playTap = (vol?: number): void => soundEffects.playTap(vol);
export const playSelect = (vol?: number): void => soundEffects.playSelect(vol);
export const playFill = (vol?: number): void => soundEffects.playFill(vol);
export const playCorrect = (vol?: number): void => soundEffects.playCorrect(vol);
export const playStar = (starIndex?: number, vol?: number): void => soundEffects.playStar(starIndex, vol);
export const playLevelComplete = (stars?: number, vol?: number): void => soundEffects.playLevelComplete(stars, vol);
export const playMismatch = (vol?: number): void => soundEffects.playMismatch(vol);
export const playClear = (vol?: number): void => soundEffects.playClear(vol);
export const playNextLevel = (vol?: number): void => soundEffects.playNextLevel(vol);
export const playLevelTransition = (vol?: number): void => soundEffects.playLevelTransition(vol);
export const playLetsPlay = (vol?: number): void => soundEffects.playLetsPlay(vol);
export const stopCelebration = (): void => soundEffects.stopCelebration();
export const startBGM = (): void => soundEffects.startBGM();
export const stopBGM = (): void => soundEffects.stopBGM();
export const toggleBGM = (): boolean => soundEffects.toggleBGM();
