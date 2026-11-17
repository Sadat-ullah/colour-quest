/* ─────────────────────────────────────────────────────────────
 *  soundEffects.ts – Procedural Web Audio Sound Effects
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

  private getMasterNode(ctx: AudioContext): GainNode {
    if (!this.masterGain || this.currentContext !== ctx) {
      this.currentContext = ctx;
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, ctx.currentTime);

      // Master DynamicsCompressorNode to prevent clipping, distortion, and mobile speaker crackle
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

  /**
   * Smoothly fades out any active fanfare, star chimes, or completion chords
   * to prevent harsh cuts or crackling during scene transitions.
   */
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
      } catch {
        // Node already finished or disposed
      }
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
   * playTap: crisp high-pitch wooden/bubble pop (<40ms duration)
   */
  public playTap(volMultiplier: number = 1.0): void {
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    // 1. High bubble/wooden tone (Sine pitch-drop)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.025);

    gain.gain.setValueAtTime(0.85 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    gain.gain.setValueAtTime(0, now + 0.036);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.038);

    // 2. Wooden body thump transient (Triangle wave)
    const woodOsc = ctx.createOscillator();
    const woodGain = ctx.createGain();
    woodOsc.type = 'triangle';
    woodOsc.frequency.setValueAtTime(600, now);
    woodOsc.frequency.exponentialRampToValueAtTime(240, now + 0.018);

    woodGain.gain.setValueAtTime(0.4 * vol, now);
    woodGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    woodGain.gain.setValueAtTime(0, now + 0.026);

    woodOsc.connect(woodGain);
    woodGain.connect(master);
    woodOsc.start(now);
    woodOsc.stop(now + 0.028);

    // 3. Crisp tactile click (Filtered noise snap, 5ms)
    try {
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2600, now);
      filter.Q.setValueAtTime(3, now);

      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(0.25 * vol, now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);
      clickGain.gain.setValueAtTime(0, now + 0.013);

      noise.connect(filter);
      filter.connect(clickGain);
      clickGain.connect(master);
      noise.start(now);
      noise.stop(now + 0.015);
    } catch {
      // Noise buffer fallback
    }

    // Cleanup
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      woodOsc.disconnect();
      woodGain.disconnect();
    };
  }

  /**
   * playSelect: bright ascending blip (~75ms)
   */
  public playSelect(volMultiplier: number = 1.0): void {
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    // Lead sine sweep (C5 to C6: 523Hz -> 1046Hz)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, now);
    osc.frequency.exponentialRampToValueAtTime(1046, now + 0.055);

    // Harmonic overtone for sparkle
    const harmOsc = ctx.createOscillator();
    const harmGain = ctx.createGain();
    harmOsc.type = 'triangle';
    harmOsc.frequency.setValueAtTime(1046, now);
    harmOsc.frequency.exponentialRampToValueAtTime(2093, now + 0.055);

    // Filter for rounded warmth
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, now);
    filter.Q.setValueAtTime(1.5, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.75 * vol, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    gain.gain.setValueAtTime(0, now + 0.076);

    harmGain.gain.setValueAtTime(0.0001, now);
    harmGain.gain.linearRampToValueAtTime(0.2 * vol, now + 0.006);
    harmGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
    harmGain.gain.setValueAtTime(0, now + 0.066);

    osc.connect(gain);
    harmOsc.connect(harmGain);
    gain.connect(filter);
    harmGain.connect(filter);
    filter.connect(master);

    osc.start(now);
    harmOsc.start(now);
    osc.stop(now + 0.08);
    harmOsc.stop(now + 0.08);

    osc.onended = () => {
      osc.disconnect();
      harmOsc.disconnect();
      gain.disconnect();
      harmGain.disconnect();
      filter.disconnect();
    };
  }

  /**
   * playFill: rich harmonic liquid/brush whoosh pop (~220ms)
   */
  public playFill(volMultiplier: number = 1.0): void {
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    // 1. Liquid droplet pop (Sine wave rise & pitch fall)
    const bubbleOsc = ctx.createOscillator();
    const bubbleGain = ctx.createGain();
    bubbleOsc.type = 'sine';
    bubbleOsc.frequency.setValueAtTime(460, now);
    bubbleOsc.frequency.exponentialRampToValueAtTime(720, now + 0.035);
    bubbleOsc.frequency.exponentialRampToValueAtTime(360, now + 0.16);

    bubbleGain.gain.setValueAtTime(0.0001, now);
    bubbleGain.gain.linearRampToValueAtTime(0.8 * vol, now + 0.02);
    bubbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    bubbleGain.gain.setValueAtTime(0, now + 0.181);

    bubbleOsc.connect(bubbleGain);
    bubbleGain.connect(master);
    bubbleOsc.start(now);
    bubbleOsc.stop(now + 0.19);

    // 2. Liquid / Brush whoosh layer (Bandpass sweeping noise)
    try {
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(700, now);
      filter.frequency.exponentialRampToValueAtTime(2000, now + 0.05);
      filter.frequency.exponentialRampToValueAtTime(850, now + 0.20);
      filter.Q.setValueAtTime(2.2, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.linearRampToValueAtTime(0.35 * vol, now + 0.03);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      noiseGain.gain.setValueAtTime(0, now + 0.221);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(master);
      noise.start(now);
      noise.stop(now + 0.23);
    } catch {
      // Noise fallback
    }

    // 3. Shimmering harmonic ring (E5 = 659.25Hz)
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(659.25, now + 0.02);

    shimmerGain.gain.setValueAtTime(0.0001, now);
    shimmerGain.gain.linearRampToValueAtTime(0.25 * vol, now + 0.05);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    shimmerGain.gain.setValueAtTime(0, now + 0.221);

    shimmer.connect(shimmerGain);
    shimmerGain.connect(master);
    shimmer.start(now + 0.02);
    shimmer.stop(now + 0.23);

    bubbleOsc.onended = () => {
      bubbleOsc.disconnect();
      bubbleGain.disconnect();
      shimmer.disconnect();
      shimmerGain.disconnect();
    };
  }

  /**
   * playCorrect: joyful chime / bell chord (C-E-G) (~700ms)
   */
  public playCorrect(volMultiplier: number = 1.0): void {
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    // Staggered arpeggiated bell notes: C5, E5, G5, C6
    const chord = [
      { freq: 523.25, delay: 0.000, gain: 0.55 }, // C5
      { freq: 659.25, delay: 0.035, gain: 0.55 }, // E5
      { freq: 783.99, delay: 0.070, gain: 0.60 }, // G5
      { freq: 1046.50, delay: 0.105, gain: 0.50 }, // C6
    ];

    chord.forEach(({ freq, delay, gain: noteGainWeight }) => {
      const noteTime = now + delay;

      // Primary bell tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      // Bell overtone (natural metallic chime ratio ~2.76)
      const overtone = ctx.createOscillator();
      const overtoneGain = ctx.createGain();
      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(freq * 2.76, noteTime);

      // Warm acoustic lowpass filter
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2600, noteTime);
      filter.Q.setValueAtTime(1.2, noteTime);

      gain.gain.setValueAtTime(0.0001, noteTime);
      gain.gain.linearRampToValueAtTime(noteGainWeight * vol, noteTime + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.65);
      gain.gain.setValueAtTime(0, noteTime + 0.651);

      overtoneGain.gain.setValueAtTime(0.0001, noteTime);
      overtoneGain.gain.linearRampToValueAtTime(noteGainWeight * 0.18 * vol, noteTime + 0.003);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.35);
      overtoneGain.gain.setValueAtTime(0, noteTime + 0.351);

      osc.connect(gain);
      overtone.connect(overtoneGain);
      gain.connect(filter);
      overtoneGain.connect(filter);
      filter.connect(master);

      osc.start(noteTime);
      overtone.start(noteTime);
      osc.stop(noteTime + 0.68);
      overtone.stop(noteTime + 0.38);

      osc.onended = () => {
        osc.disconnect();
        overtone.disconnect();
        gain.disconnect();
        overtoneGain.disconnect();
        filter.disconnect();
      };
    });
  }

  /**
   * playStar: dazzling sparkle chime, higher pitch for stars 1, 2, 3 (~850ms)
   */
  public playStar(starIndex: number = 1, volMultiplier: number = 1.0): void {
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    // Pitch scales with starIndex: Star 1 (G5 root), Star 2 (C6 root), Star 3 (E6 root)
    let notes: number[];
    if (starIndex <= 1) {
      notes = [783.99, 987.77, 1174.66, 1567.98]; // G5, B5, D6, G6
    } else if (starIndex === 2) {
      notes = [1046.50, 1318.51, 1567.98, 2093.00]; // C6, E6, G6, C7
    } else {
      notes = [1318.51, 1661.22, 1975.53, 2637.02, 3135.96]; // E6, G#6, B6, E7, G7
    }

    notes.forEach((freq, idx) => {
      const noteTime = now + idx * 0.038;

      // Glockenspiel crystal tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      // Detuned shimmer oscillator for chorus sparkle (+4 cents)
      const shimmer = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      shimmer.type = 'sine';
      shimmer.frequency.setValueAtTime(freq * 1.0023, noteTime);

      gain.gain.setValueAtTime(0.0001, noteTime);
      gain.gain.linearRampToValueAtTime(0.48 * vol, noteTime + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.65);
      gain.gain.setValueAtTime(0, noteTime + 0.651);

      shimmerGain.gain.setValueAtTime(0.0001, noteTime);
      shimmerGain.gain.linearRampToValueAtTime(0.24 * vol, noteTime + 0.004);
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.55);
      shimmerGain.gain.setValueAtTime(0, noteTime + 0.551);

      osc.connect(gain);
      shimmer.connect(shimmerGain);
      gain.connect(master);
      shimmerGain.connect(master);

      this.registerCelebrationNode(gain, osc);
      this.registerCelebrationNode(shimmerGain, shimmer);

      osc.start(noteTime);
      shimmer.start(noteTime);
      osc.stop(noteTime + 0.68);
      shimmer.stop(noteTime + 0.58);

      osc.onended = () => {
        osc.disconnect();
        shimmer.disconnect();
        gain.disconnect();
        shimmerGain.disconnect();
      };
    });

    // Magical airy sparkle noise sweep
    try {
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(4500, now);

      const sparkleGain = ctx.createGain();
      sparkleGain.gain.setValueAtTime(0.0001, now);
      sparkleGain.gain.linearRampToValueAtTime(0.12 * vol, now + 0.05);
      sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      sparkleGain.gain.setValueAtTime(0, now + 0.281);

      noise.connect(filter);
      filter.connect(sparkleGain);
      sparkleGain.connect(master);
      noise.start(now);
      noise.stop(now + 0.30);
    } catch {
      // Noise fallback
    }
  }

  /**
   * playLevelComplete: triumphant fanfare (~1.8s)
   */
  public playLevelComplete(stars: number = 3, volMultiplier: number = 1.0): void {
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    // Herald melody notes: G4 -> C5 -> E5 -> G5
    const herald = [
      { freq: 392.00, start: 0.00, dur: 0.10 }, // G4
      { freq: 523.25, start: 0.12, dur: 0.10 }, // C5
      { freq: 659.25, start: 0.24, dur: 0.10 }, // E5
      { freq: 783.99, start: 0.36, dur: 0.22 }, // G5
    ];

    herald.forEach(({ freq, start, dur }) => {
      const noteTime = now + start;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.0001, noteTime);
      gain.gain.linearRampToValueAtTime(0.6 * vol, noteTime + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + dur + 0.05);
      gain.gain.setValueAtTime(0, noteTime + dur + 0.051);

      osc.connect(gain);
      gain.connect(master);
      this.registerCelebrationNode(gain, osc);
      osc.start(noteTime);
      osc.stop(noteTime + dur + 0.06);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });

    // Grand Climax Chord at t = 0.60s (C Major Triad + high octave)
    const chordNotes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const chordStart = now + 0.60;

    chordNotes.forEach((freq) => {
      // Warm brass/synth organ blend (Triangle + low Sawtooth)
      const oscTri = ctx.createOscillator();
      const oscSaw = ctx.createOscillator();
      const chordGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      oscTri.type = 'triangle';
      oscTri.frequency.setValueAtTime(freq, chordStart);
      oscSaw.type = 'sawtooth';
      oscSaw.frequency.setValueAtTime(freq, chordStart);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, chordStart);
      filter.frequency.exponentialRampToValueAtTime(900, chordStart + 0.7);

      chordGain.gain.setValueAtTime(0.0001, chordStart);
      chordGain.gain.linearRampToValueAtTime(0.42 * vol, chordStart + 0.015);
      chordGain.gain.exponentialRampToValueAtTime(0.0001, chordStart + 0.85);
      chordGain.gain.setValueAtTime(0, chordStart + 0.851);

      const sawGain = ctx.createGain();
      sawGain.gain.setValueAtTime(0.2, chordStart);

      oscTri.connect(chordGain);
      oscSaw.connect(sawGain);
      sawGain.connect(chordGain);
      chordGain.connect(filter);
      filter.connect(master);

      this.registerCelebrationNode(chordGain, oscTri);
      this.registerCelebrationNode(sawGain, oscSaw);

      oscTri.start(chordStart);
      oscSaw.start(chordStart);
      oscTri.stop(chordStart + 0.88);
      oscSaw.stop(chordStart + 0.88);

      oscTri.onended = () => {
        oscTri.disconnect();
        oscSaw.disconnect();
        sawGain.disconnect();
        chordGain.disconnect();
        filter.disconnect();
      };
    });

    // 3-Star Celebration Sparkle Trill cascade at t = 0.95s
    if (stars >= 3) {
      const sparkleTrill = [1174.66, 1318.51, 1567.98, 2093.00, 2637.02]; // D6, E6, G6, C7, E7
      sparkleTrill.forEach((freq, idx) => {
        const trillTime = now + 0.95 + idx * 0.045;
        const bell = ctx.createOscillator();
        const bellGain = ctx.createGain();
        bell.type = 'sine';
        bell.frequency.setValueAtTime(freq, trillTime);

        bellGain.gain.setValueAtTime(0.0001, trillTime);
        bellGain.gain.linearRampToValueAtTime(0.35 * vol, trillTime + 0.004);
        bellGain.gain.exponentialRampToValueAtTime(0.0001, trillTime + 0.6);
        bellGain.gain.setValueAtTime(0, trillTime + 0.601);

        bell.connect(bellGain);
        bellGain.connect(master);
        this.registerCelebrationNode(bellGain, bell);
        bell.start(trillTime);
        bell.stop(trillTime + 0.62);

        bell.onended = () => {
          bell.disconnect();
          bellGain.disconnect();
        };
      });
    }
  }

  /**
   * playMismatch: soft gentle 'boing' or low chime (never punishing, child-friendly) (~250ms)
   */
  public playMismatch(volMultiplier: number = 1.0): void {
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    // Cute soft cartoon spring boing (Sine pitch bend downwards + 14Hz gentle wobble)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';

    // Start around 330 Hz (E4), smoothly bend to 180 Hz with pleasant bounce
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.22);

    // Warm lowpass filter to remove any abrasive buzz
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.Q.setValueAtTime(1.8, now);

    // Subtle pitch modulation (LFO wobble) for springy cartoon character
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(14, now);
    lfoGain.gain.setValueAtTime(18, now);
    lfoGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    lfo.connect(osc.frequency);

    oscGain.gain.setValueAtTime(0.0001, now);
    oscGain.gain.linearRampToValueAtTime(0.6 * vol, now + 0.008);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    oscGain.gain.setValueAtTime(0, now + 0.251);

    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(master);

    lfo.start(now);
    osc.start(now);
    lfo.stop(now + 0.25);
    osc.stop(now + 0.26);

    osc.onended = () => {
      osc.disconnect();
      lfo.disconnect();
      lfoGain.disconnect();
      filter.disconnect();
      oscGain.disconnect();
    };
  }

  /**
   * playClear: swoosh rewind (~260ms)
   */
  public playClear(volMultiplier: number = 1.0): void {
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    // 1. Filtered noise reverse whoosh (sweeping high to low)
    try {
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(380, now + 0.22);
      filter.Q.setValueAtTime(2.0, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.linearRampToValueAtTime(0.45 * vol, now + 0.025);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      noiseGain.gain.setValueAtTime(0, now + 0.241);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(master);
      noise.start(now);
      noise.stop(now + 0.25);
    } catch {
      // Noise fallback
    }

    // 2. Tonal tape rewind glide (Sine 880Hz down to 220Hz)
    const rewindTone = ctx.createOscillator();
    const rewindGain = ctx.createGain();
    rewindTone.type = 'sine';
    rewindTone.frequency.setValueAtTime(880, now);
    rewindTone.frequency.exponentialRampToValueAtTime(220, now + 0.22);

    rewindGain.gain.setValueAtTime(0.0001, now);
    rewindGain.gain.linearRampToValueAtTime(0.28 * vol, now + 0.02);
    rewindGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    rewindGain.gain.setValueAtTime(0, now + 0.241);

    rewindTone.connect(rewindGain);
    rewindGain.connect(master);
    rewindTone.start(now);
    rewindTone.stop(now + 0.25);

    rewindTone.onended = () => {
      rewindTone.disconnect();
      rewindGain.disconnect();
    };
  }

  /**
   * Shared helper: one soft, glassy "bell/pluck" note.
   * Fundamental + two quiet, faster-decaying overtones, smooth attack,
   * exponential decay to near silence (no clicks), gentle lowpass.
   */
  /**
   * Shared helper: one soft, glassy "bell/pluck" note.
   * Fundamental + two quiet, faster-decaying overtones, smooth attack,
   * exponential decay to near silence (no clicks), gentle lowpass.
   */
  private playBellNote(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    startTime: number,
    dur: number,
    peak: number
  ): void {
    const partials = [
      { ratio: 1, amp: 1.0, decay: 1.0 },
      { ratio: 2, amp: 0.22, decay: 0.6 },
      { ratio: 3, amp: 0.07, decay: 0.35 },
    ];

    const safeStart = Math.max(startTime, ctx.currentTime);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3800, safeStart);
    filter.Q.setValueAtTime(0.5, safeStart);
    filter.connect(dest);

    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    partials.forEach(({ ratio, amp, decay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const d = dur * decay;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * ratio, safeStart);

      gain.gain.setValueAtTime(0.0001, safeStart);
      gain.gain.linearRampToValueAtTime(peak * amp, safeStart + 0.004); // ultra-fast responsive 4ms attack
      gain.gain.exponentialRampToValueAtTime(0.0001, safeStart + d);    // smooth tail

      osc.connect(gain);
      gain.connect(filter);
      osc.start(safeStart);
      osc.stop(safeStart + d + 0.03);

      oscs.push(osc);
      gains.push(gain);
    });

    if (oscs[0]) {
      oscs[0].onended = () => {
        oscs.forEach(o => o.disconnect());
        gains.forEach(g => g.disconnect());
        filter.disconnect();
      };
    }
  }

  /**
   * playMarimbaNote: warm wooden marimba/harp note with triangle + sine harmonics
   */
  private playMarimbaNote(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    startTime: number,
    dur: number,
    peak: number
  ): void {
    const safeStart = Math.max(startTime, ctx.currentTime);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, safeStart);
    filter.Q.setValueAtTime(0.7, safeStart);
    filter.connect(dest);

    // 1. Warm Fundamental (Sine + subtle Triangle body)
    const sineOsc = ctx.createOscillator();
    const triOsc = ctx.createOscillator();
    const mainGain = ctx.createGain();

    sineOsc.type = 'sine';
    sineOsc.frequency.setValueAtTime(freq, safeStart);

    triOsc.type = 'triangle';
    triOsc.frequency.setValueAtTime(freq, safeStart);

    mainGain.gain.setValueAtTime(0.0001, safeStart);
    mainGain.gain.linearRampToValueAtTime(peak, safeStart + 0.003); // ultra-fast 3ms wooden strike attack
    mainGain.gain.exponentialRampToValueAtTime(0.0001, safeStart + dur); // smooth warm resonant tail

    sineOsc.connect(mainGain);
    triOsc.connect(mainGain);
    mainGain.connect(filter);

    sineOsc.start(safeStart);
    triOsc.start(safeStart);
    sineOsc.stop(safeStart + dur + 0.04);
    triOsc.stop(safeStart + dur + 0.04);

    // 2. Wooden bar strike transient (sine 3x overtone, very short decay)
    const strikeOsc = ctx.createOscillator();
    const strikeGain = ctx.createGain();
    strikeOsc.type = 'sine';
    strikeOsc.frequency.setValueAtTime(freq * 3.0, safeStart);

    strikeGain.gain.setValueAtTime(0.0001, safeStart);
    strikeGain.gain.linearRampToValueAtTime(peak * 0.22, safeStart + 0.002);
    strikeGain.gain.exponentialRampToValueAtTime(0.0001, safeStart + 0.06);

    strikeOsc.connect(strikeGain);
    strikeGain.connect(filter);
    strikeOsc.start(safeStart);
    strikeOsc.stop(safeStart + 0.07);

    sineOsc.onended = () => {
      sineOsc.disconnect();
      triOsc.disconnect();
      mainGain.disconnect();
      strikeOsc.disconnect();
      strikeGain.disconnect();
      filter.disconnect();
    };
  }

  /**
   * playLetsPlay: warm, playful marimba/harp-like ascending flourish
   * C5 (523.25) -> E5 (659.25) -> G5 (783.99) -> B5 (987.77) -> C6 (1046.50)
   * cascaded sparkle chord with soft triangle + sine harmonics and gentle reverb-like tail
   */
  public playLetsPlay(volMultiplier: number = 1.0): void {
    this.stopCelebration();
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    const flourishNotes = [
      { freq: 523.25, offset: 0.000, dur: 0.32, peak: 0.32 * vol }, // C5
      { freq: 659.25, offset: 0.055, dur: 0.34, peak: 0.34 * vol }, // E5
      { freq: 783.99, offset: 0.110, dur: 0.36, peak: 0.36 * vol }, // G5
      { freq: 987.77, offset: 0.165, dur: 0.38, peak: 0.38 * vol }, // B5
      { freq: 1046.50, offset: 0.220, dur: 0.58, peak: 0.42 * vol }, // C6
    ];

    flourishNotes.forEach(({ freq, offset, dur, peak }) => {
      this.playMarimbaNote(ctx, master, freq, now + offset, dur, peak);
    });
  }

  /**
   * playNextLevel: uplifting celebratory fanfare
   * G4 (392.00) -> C5 (523.25) -> E5 (659.25) -> G5 (783.99) triumphant bounce
   * + shimmering octave sparkle C6 (1046.50)
   */
  public playNextLevel(volMultiplier: number = 1.0): void {
    this.stopCelebration();
    const ready = this.prepareContext();
    if (!ready) return;
    const { ctx, master } = ready;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(1, volMultiplier));

    const fanfareNotes = [
      { freq: 392.00, offset: 0.000, dur: 0.28, peak: 0.30 * vol }, // G4
      { freq: 523.25, offset: 0.075, dur: 0.30, peak: 0.32 * vol }, // C5
      { freq: 659.25, offset: 0.150, dur: 0.32, peak: 0.34 * vol }, // E5
      { freq: 783.99, offset: 0.225, dur: 0.38, peak: 0.36 * vol }, // G5
      { freq: 1046.50, offset: 0.300, dur: 0.65, peak: 0.42 * vol }, // C6 sparkle
    ];

    fanfareNotes.forEach(({ freq, offset, dur, peak }) => {
      this.playMarimbaNote(ctx, master, freq, now + offset, dur, peak);
    });

    // Shimmering octave sparkle overtone on final C6
    this.playBellNote(ctx, master, 2093.00, now + 0.305, 0.45, 0.16 * vol); // C7 sparkle
  }

  /**
   * playLevelTransition: alias for warm bell level transition sound
   */
  public playLevelTransition(volMultiplier: number = 1.0): void {
    this.playNextLevel(volMultiplier);
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
