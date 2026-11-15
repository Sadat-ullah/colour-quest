/* ─────────────────────────────────────────────────────────────
 *  musicSynth.ts – Procedural Web Audio Background Music Synth
 *  Gentle, cheerful, relaxing pentatonic marimba arpeggio.
 *  Zero external audio files required.
 * ───────────────────────────────────────────────────────────── */

import { getAudioContext } from './mobileUnlock';
import { MUSIC_DEFAULT_VOL } from '../shared/constants';

// Note frequencies in Hz (C Major Pentatonic & diatonic extensions)
const PITCHES: Record<string, number> = {
  F2: 87.31,
  G2: 98.00,
  A2: 110.00,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.00,
  A3: 220.00,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.00,
  A4: 440.00,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880.00,
  C6: 1046.50,
  E6: 1318.51,
};

interface StepNote {
  note: string;
  dur?: number;
  vel?: number;
}

interface StepPattern {
  lead?: StepNote;
  bass?: StepNote;
  sparkle?: StepNote;
}

// 32-step cheerful pentatonic progression (4 bars of 8 steps each, ~96 BPM)
// Bar 1: C Major (warm, welcoming)
// Bar 2: A Minor / Pentatonic (playful, curious)
// Bar 3: F / Subdominant (gentle daydream)
// Bar 4: G Major (happy turnaround)
const MUSIC_PATTERN: StepPattern[] = [
  // ── Bar 1 (C Major) ──
  { bass: { note: 'C3', vel: 0.45 }, lead: { note: 'C4', vel: 0.55 } }, // Step 0
  { lead: { note: 'E4', vel: 0.40 } },                                    // Step 1
  { lead: { note: 'G4', vel: 0.45 } },                                    // Step 2
  { lead: { note: 'C5', vel: 0.55 } },                                    // Step 3
  { bass: { note: 'G3', vel: 0.35 }, lead: { note: 'E5', vel: 0.50 } }, // Step 4
  { lead: { note: 'D5', vel: 0.40 } },                                    // Step 5
  { lead: { note: 'C5', vel: 0.48 } },                                    // Step 6
  { lead: { note: 'G4', vel: 0.38 } },                                    // Step 7

  // ── Bar 2 (A Minor / Pentatonic) ──
  { bass: { note: 'A2', vel: 0.45 }, lead: { note: 'E4', vel: 0.45 } }, // Step 8
  { lead: { note: 'A4', vel: 0.50 } },                                    // Step 9
  { lead: { note: 'C5', vel: 0.55 } },                                    // Step 10
  { lead: { note: 'D5', vel: 0.42 } },                                    // Step 11
  { bass: { note: 'E3', vel: 0.35 }, lead: { note: 'E5', vel: 0.60 } }, // Step 12
  { sparkle: { note: 'C6', vel: 0.30 }, lead: { note: 'G5', vel: 0.50 } }, // Step 13
  { lead: { note: 'E5', vel: 0.45 } },                                    // Step 14
  { lead: { note: 'D5', vel: 0.38 } },                                    // Step 15

  // ── Bar 3 (F Major Pentatonic) ──
  { bass: { note: 'F2', vel: 0.45 }, lead: { note: 'A4', vel: 0.45 } }, // Step 16
  { lead: { note: 'C5', vel: 0.50 } },                                    // Step 17
  { lead: { note: 'D5', vel: 0.45 } },                                    // Step 18
  { lead: { note: 'F5', vel: 0.55 } },                                    // Step 19
  { bass: { note: 'C3', vel: 0.35 }, lead: { note: 'G5', vel: 0.58 } }, // Step 20
  { lead: { note: 'E5', vel: 0.48 } },                                    // Step 21
  { lead: { note: 'D5', vel: 0.42 } },                                    // Step 22
  { lead: { note: 'C5', vel: 0.45 } },                                    // Step 23

  // ── Bar 4 (G Major turnaround) ──
  { bass: { note: 'G2', vel: 0.48 }, lead: { note: 'D4', vel: 0.45 } }, // Step 24
  { lead: { note: 'G4', vel: 0.50 } },                                    // Step 25
  { lead: { note: 'B4', vel: 0.48 } },                                    // Step 26
  { lead: { note: 'D5', vel: 0.55 } },                                    // Step 27
  { bass: { note: 'D3', vel: 0.35 }, lead: { note: 'G5', vel: 0.60 } }, // Step 28
  { sparkle: { note: 'E6', vel: 0.28 }, lead: { note: 'E5', vel: 0.48 } }, // Step 29
  { lead: { note: 'D5', vel: 0.42 } },                                    // Step 30
  { lead: { note: 'C5', vel: 0.48 } },                                    // Step 31
];

export class MusicSynth {
  private volume: number = MUSIC_DEFAULT_VOL;
  private muted: boolean = false;
  private playing: boolean = false;
  private paused: boolean = false;

  private currentStep: number = 0;
  private nextNoteTime: number = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;

  // Audio nodes
  private masterGain: GainNode | null = null;
  private warmFilter: BiquadFilterNode | null = null;
  private currentContext: AudioContext | null = null;
  private activeScheduledNodes: Array<{ stop: (time?: number) => void }> = [];

  // Timing constants
  private readonly stepDurationSec: number = 0.156; // ~96 BPM sixteenth notes
  private readonly lookaheadMs: number = 25;
  private readonly scheduleAheadSec: number = 0.12;

  private getAudioNodes(ctx: AudioContext): { master: GainNode; filter: BiquadFilterNode } {
    if (!this.masterGain || !this.warmFilter || this.currentContext !== ctx) {
      this.currentContext = ctx;

      // Master output gain
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, ctx.currentTime);

      // Warm acoustic lowpass filter (softens marimba clicks for children's ears)
      this.warmFilter = ctx.createBiquadFilter();
      this.warmFilter.type = 'lowpass';
      this.warmFilter.frequency.setValueAtTime(1450, ctx.currentTime);
      this.warmFilter.Q.setValueAtTime(0.85, ctx.currentTime);

      this.warmFilter.connect(this.masterGain);
      this.masterGain.connect(ctx.destination);
    }
    return { master: this.masterGain, filter: this.warmFilter };
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.currentContext) {
      const target = this.muted ? 0 : this.volume;
      this.masterGain.gain.setTargetAtTime(target, this.currentContext.currentTime, 0.03);
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.currentContext) {
      const target = this.muted ? 0 : this.volume;
      this.masterGain.gain.setTargetAtTime(target, this.currentContext.currentTime, 0.03);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Start or restart background music loop with a gentle fade-in.
   */
  public start(): void {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const { master } = this.getAudioNodes(ctx);

    if (this.playing) {
      return;
    }

    this.playing = true;
    this.paused = false;
    this.currentStep = 0;
    this.nextNoteTime = ctx.currentTime + 0.08;

    // Smooth gentle fade-in (450ms)
    const targetGain = this.muted ? 0 : this.volume;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.45);

    this.startScheduler();
  }

  /**
   * Stop background music, fade out, and reset playhead to beginning.
   */
  public stop(): void {
    this.playing = false;
    this.paused = false;
    this.currentStep = 0;
    this.stopScheduler();
    this.cancelScheduledNotes();

    if (this.masterGain && this.currentContext) {
      const now = this.currentContext.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + 0.15);
    }
  }

  /**
   * Pause background music, retaining position.
   */
  public pause(): void {
    if (!this.playing) return;

    this.playing = false;
    this.paused = true;
    this.stopScheduler();
    this.cancelScheduledNotes();

    if (this.masterGain && this.currentContext) {
      const now = this.currentContext.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + 0.15);
    }
  }

  /**
   * Resume background music from paused position.
   */
  public resume(): void {
    if (this.playing) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const { master } = this.getAudioNodes(ctx);

    this.playing = true;
    this.paused = false;
    this.nextNoteTime = ctx.currentTime + 0.05;

    // Fade back in smoothly
    const targetGain = this.muted ? 0 : this.volume;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.3);

    this.startScheduler();
  }

  private startScheduler(): void {
    this.stopScheduler();
    this.timerId = setInterval(() => {
      this.schedulerTick();
    }, this.lookaheadMs);
  }

  private stopScheduler(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private schedulerTick(): void {
    const ctx = this.currentContext || getAudioContext();
    if (!ctx || !this.playing) return;

    // If context is suspended (e.g. mobile tab lock), do not schedule until resumed
    if (ctx.state === 'suspended') return;

    // Schedule all steps within the lookahead window
    while (this.nextNoteTime < ctx.currentTime + this.scheduleAheadSec) {
      this.scheduleStep(this.currentStep, this.nextNoteTime, ctx);
      this.advanceStep();
    }
  }

  private advanceStep(): void {
    this.nextNoteTime += this.stepDurationSec;
    this.currentStep = (this.currentStep + 1) % MUSIC_PATTERN.length;
  }

  private scheduleStep(stepIndex: number, time: number, ctx: AudioContext): void {
    const step = MUSIC_PATTERN[stepIndex];
    if (!step) return;

    const { filter } = this.getAudioNodes(ctx);

    // 1. Play Lead Marimba / Kalimba voice
    if (step.lead) {
      this.playMarimbaVoice(step.lead, time, ctx, filter);
    }

    // 2. Play Warm Bass accompaniment
    if (step.bass) {
      this.playBassVoice(step.bass, time, ctx, filter);
    }

    // 3. Play Sparkle Glockenspiel accent
    if (step.sparkle) {
      this.playSparkleVoice(step.sparkle, time, ctx, filter);
    }
  }

  /**
   * Marimba / Kalimba synthetic voice (Dual Sine + Triangle with wood body envelope)
   */
  private playMarimbaVoice(
    noteInfo: StepNote,
    time: number,
    ctx: AudioContext,
    destination: AudioNode
  ): void {
    const freq = PITCHES[noteInfo.note];
    if (!freq) return;

    const velocity = (noteInfo.vel ?? 0.5) * 0.45;
    const dur = noteInfo.dur ?? 0.22;

    // Fundamental Sine wave (soft melodic core)
    const oscSine = ctx.createOscillator();
    const gainSine = ctx.createGain();
    oscSine.type = 'sine';
    oscSine.frequency.setValueAtTime(freq, time);

    // Wooden strike overtone (Triangle wave)
    const oscTri = ctx.createOscillator();
    const gainTri = ctx.createGain();
    oscTri.type = 'triangle';
    oscTri.frequency.setValueAtTime(freq, time);

    gainSine.gain.setValueAtTime(0.0001, time);
    gainSine.gain.linearRampToValueAtTime(velocity, time + 0.004);
    gainSine.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    gainSine.gain.setValueAtTime(0, time + dur + 0.001);

    gainTri.gain.setValueAtTime(0.0001, time);
    gainTri.gain.linearRampToValueAtTime(velocity * 0.35, time + 0.003);
    gainTri.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.65);
    gainTri.gain.setValueAtTime(0, time + dur * 0.65 + 0.001);

    oscSine.connect(gainSine);
    oscTri.connect(gainTri);
    gainSine.connect(destination);
    gainTri.connect(destination);

    oscSine.start(time);
    oscTri.start(time);
    oscSine.stop(time + dur + 0.01);
    oscTri.stop(time + dur + 0.01);

    this.activeScheduledNodes.push(oscSine, oscTri);

    oscSine.onended = () => {
      oscSine.disconnect();
      oscTri.disconnect();
      gainSine.disconnect();
      gainTri.disconnect();
      const sIdx = this.activeScheduledNodes.indexOf(oscSine);
      if (sIdx !== -1) this.activeScheduledNodes.splice(sIdx, 1);
      const tIdx = this.activeScheduledNodes.indexOf(oscTri);
      if (tIdx !== -1) this.activeScheduledNodes.splice(tIdx, 1);
    };
  }

  /**
   * Warm Pillowy Bass voice
   */
  private playBassVoice(
    noteInfo: StepNote,
    time: number,
    ctx: AudioContext,
    destination: AudioNode
  ): void {
    const freq = PITCHES[noteInfo.note];
    if (!freq) return;

    const velocity = (noteInfo.vel ?? 0.5) * 0.40;
    const dur = noteInfo.dur ?? 0.38;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const bassFilter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    bassFilter.type = 'lowpass';
    bassFilter.frequency.setValueAtTime(320, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(velocity, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    gain.gain.setValueAtTime(0, time + dur + 0.001);

    osc.connect(bassFilter);
    bassFilter.connect(gain);
    gain.connect(destination);

    osc.start(time);
    osc.stop(time + dur + 0.01);

    this.activeScheduledNodes.push(osc);

    osc.onended = () => {
      osc.disconnect();
      bassFilter.disconnect();
      gain.disconnect();
      const idx = this.activeScheduledNodes.indexOf(osc);
      if (idx !== -1) this.activeScheduledNodes.splice(idx, 1);
    };
  }

  /**
   * Delicate Sparkle Glockenspiel voice
   */
  private playSparkleVoice(
    noteInfo: StepNote,
    time: number,
    ctx: AudioContext,
    destination: AudioNode
  ): void {
    const freq = PITCHES[noteInfo.note];
    if (!freq) return;

    const velocity = (noteInfo.vel ?? 0.3) * 0.28;
    const dur = noteInfo.dur ?? 0.45;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(velocity, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    gain.gain.setValueAtTime(0, time + dur + 0.001);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(time);
    osc.stop(time + dur + 0.01);

    this.activeScheduledNodes.push(osc);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      const idx = this.activeScheduledNodes.indexOf(osc);
      if (idx !== -1) this.activeScheduledNodes.splice(idx, 1);
    };
  }

  private cancelScheduledNotes(): void {
    for (const node of this.activeScheduledNodes) {
      try {
        node.stop();
      } catch {
        // Node might have already finished
      }
    }
    this.activeScheduledNodes = [];
  }
}

export const musicSynth = new MusicSynth();
