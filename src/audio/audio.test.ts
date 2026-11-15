// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { audioManager, AudioManager } from './audioManager';
import { soundEffects, playTap, playSelect, playFill, playCorrect, playStar, playLevelComplete, playMismatch, playClear } from './soundEffects';
import { musicSynth, MusicSynth } from './musicSynth';
import { getAudioContext, isAudioUnlocked, unlockAudio, initMobileUnlock, _resetUnlockForTesting } from './mobileUnlock';
import { eventBus } from '../shared/eventBus';

// Mock Web Audio API for test environment
class MockAudioNode {
  connect = vi.fn().mockReturnValue(this);
  disconnect = vi.fn();
}

class MockAudioParam {
  value = 1;
  setValueAtTime = vi.fn().mockReturnThis();
  linearRampToValueAtTime = vi.fn().mockReturnThis();
  exponentialRampToValueAtTime = vi.fn().mockReturnThis();
  setTargetAtTime = vi.fn().mockReturnThis();
  cancelScheduledValues = vi.fn().mockReturnThis();
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

class MockBiquadFilterNode extends MockAudioNode {
  frequency = new MockAudioParam();
  Q = new MockAudioParam();
  type = 'lowpass';
}

class MockDynamicsCompressorNode extends MockAudioNode {
  threshold = new MockAudioParam();
  knee = new MockAudioParam();
  ratio = new MockAudioParam();
  attack = new MockAudioParam();
  release = new MockAudioParam();
}

class MockOscillatorNode extends MockAudioNode {
  type = 'sine';
  frequency = new MockAudioParam();
  start = vi.fn();
  stop = vi.fn();
  onended: (() => void) | null = null;
}

class MockAudioBufferSourceNode extends MockAudioNode {
  buffer: unknown = null;
  start = vi.fn();
  stop = vi.fn();
  onended: (() => void) | null = null;
}

class MockAudioBuffer {
  sampleRate: number;
  length: number;
  duration: number;
  private channelData: Float32Array;

  constructor(options: { numberOfChannels: number; length: number; sampleRate: number }) {
    this.sampleRate = options.sampleRate;
    this.length = options.length;
    this.duration = options.length / options.sampleRate;
    this.channelData = new Float32Array(options.length);
  }

  getChannelData(): Float32Array {
    return this.channelData;
  }
}

class MockAudioContext {
  state: AudioContextState = 'suspended';
  currentTime = 0;
  sampleRate = 44100;
  destination = new MockAudioNode();

  createGain() { return new MockGainNode(); }
  createDynamicsCompressor() { return new MockDynamicsCompressorNode(); }
  createOscillator() { return new MockOscillatorNode(); }
  createBiquadFilter() { return new MockBiquadFilterNode(); }
  createBufferSource() { return new MockAudioBufferSourceNode(); }
  createBuffer(channels: number, length: number, sampleRate: number) {
    return new MockAudioBuffer({ numberOfChannels: channels, length, sampleRate });
  }
  resume = vi.fn().mockImplementation(async () => {
    this.state = 'running';
  });
  suspend = vi.fn().mockImplementation(async () => {
    this.state = 'suspended';
  });
}

describe('Audio Subsystem (Agent A5)', () => {
  beforeEach(() => {
    _resetUnlockForTesting();
    (window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mobileUnlock', () => {
    it('creates or retrieves the shared AudioContext', () => {
      const ctx = getAudioContext();
      expect(ctx).toBeDefined();
      expect(ctx?.sampleRate).toBe(44100);
    });

    it('unlocks audio on user interaction and emits audio:unlock on eventBus', async () => {
      const unlockListener = vi.fn();
      eventBus.on('audio:unlock', unlockListener);

      const unlocked = await unlockAudio();
      expect(unlocked).toBe(true);
      expect(isAudioUnlocked()).toBe(true);
      expect(unlockListener).toHaveBeenCalled();

      eventBus.off('audio:unlock', unlockListener);
    });

    it('attaches listeners to window and document', () => {
      const addWindowSpy = vi.spyOn(window, 'addEventListener');
      const addDocSpy = vi.spyOn(document, 'addEventListener');

      initMobileUnlock();
      expect(addWindowSpy).toHaveBeenCalled();
      expect(addDocSpy).toHaveBeenCalled();
    });
  });

  describe('soundEffects', () => {
    it('plays tap sound without error', () => {
      expect(() => playTap()).not.toThrow();
      expect(() => soundEffects.playTap(0.8)).not.toThrow();
    });

    it('plays select sound without error', () => {
      expect(() => playSelect()).not.toThrow();
      expect(() => soundEffects.playSelect(0.8)).not.toThrow();
    });

    it('plays fill sound without error', () => {
      expect(() => playFill()).not.toThrow();
      expect(() => soundEffects.playFill(0.8)).not.toThrow();
    });

    it('plays correct chord sound without error', () => {
      expect(() => playCorrect()).not.toThrow();
      expect(() => soundEffects.playCorrect(0.8)).not.toThrow();
    });

    it('plays star sound for stars 1, 2, and 3', () => {
      expect(() => playStar(1)).not.toThrow();
      expect(() => playStar(2)).not.toThrow();
      expect(() => playStar(3)).not.toThrow();
      expect(() => soundEffects.playStar(3, 0.9)).not.toThrow();
    });

    it('plays level complete fanfare without error', () => {
      expect(() => playLevelComplete(1)).not.toThrow();
      expect(() => playLevelComplete(2)).not.toThrow();
      expect(() => playLevelComplete(3)).not.toThrow();
      expect(() => soundEffects.playLevelComplete(3, 0.9)).not.toThrow();
    });

    it('plays mismatch friendly sound without error', () => {
      expect(() => playMismatch()).not.toThrow();
      expect(() => soundEffects.playMismatch(0.8)).not.toThrow();
    });

    it('plays clear rewind sound without error', () => {
      expect(() => playClear()).not.toThrow();
      expect(() => soundEffects.playClear(0.8)).not.toThrow();
    });

    it('plays next level marimba transition pop and stops active fanfare without error', () => {
      expect(() => soundEffects.playLevelComplete(3)).not.toThrow();
      expect(() => soundEffects.stopCelebration()).not.toThrow();
      expect(() => soundEffects.playNextLevel(0.9)).not.toThrow();
      expect(() => audioManager.playNextLevel()).not.toThrow();
    });

    it('manages volume and mute state correctly', () => {
      soundEffects.setVolume(0.5);
      expect(soundEffects.getVolume()).toBe(0.5);

      soundEffects.setMuted(true);
      expect(soundEffects.isMuted()).toBe(true);

      const toggled = soundEffects.toggleMute();
      expect(toggled).toBe(false);
      expect(soundEffects.isMuted()).toBe(false);
    });
  });

  describe('musicSynth', () => {
    it('starts, pauses, resumes, and stops background music', () => {
      musicSynth.start();
      expect(musicSynth.isPlaying()).toBe(true);

      musicSynth.pause();
      expect(musicSynth.isPlaying()).toBe(false);

      musicSynth.resume();
      expect(musicSynth.isPlaying()).toBe(true);

      musicSynth.stop();
      expect(musicSynth.isPlaying()).toBe(false);
    });

    it('handles volume and mute controls for music', () => {
      musicSynth.setVolume(0.4);
      expect(musicSynth.getVolume()).toBe(0.4);

      musicSynth.setMuted(true);
      expect(musicSynth.isMuted()).toBe(true);

      const toggled = musicSynth.toggleMute();
      expect(toggled).toBe(false);
      expect(musicSynth.isMuted()).toBe(false);
    });
  });

  describe('audioManager', () => {
    it('coordinates sound effects dispatching', () => {
      const tapSpy = vi.spyOn(soundEffects, 'playTap');
      const fillSpy = vi.spyOn(soundEffects, 'playFill');
      const correctSpy = vi.spyOn(soundEffects, 'playCorrect');
      const starSpy = vi.spyOn(soundEffects, 'playStar');
      const fanfareSpy = vi.spyOn(soundEffects, 'playLevelComplete');
      const mismatchSpy = vi.spyOn(soundEffects, 'playMismatch');
      const clearSpy = vi.spyOn(soundEffects, 'playClear');

      audioManager.playTap();
      expect(tapSpy).toHaveBeenCalled();

      audioManager.playFill();
      expect(fillSpy).toHaveBeenCalled();

      audioManager.playCorrect();
      expect(correctSpy).toHaveBeenCalled();

      audioManager.playStar(2);
      expect(starSpy).toHaveBeenCalledWith(2, undefined);

      audioManager.playLevelComplete(3);
      expect(fanfareSpy).toHaveBeenCalledWith(3, undefined);

      audioManager.playMismatch();
      expect(mismatchSpy).toHaveBeenCalled();

      audioManager.playClear();
      expect(clearSpy).toHaveBeenCalled();

      // Test universal playSound dispatcher
      audioManager.playSound('tap');
      expect(tapSpy).toHaveBeenCalledTimes(2);

      audioManager.playSound('fill');
      expect(fillSpy).toHaveBeenCalledTimes(2);

      audioManager.playSound('correct');
      expect(correctSpy).toHaveBeenCalledTimes(2);

      audioManager.playSound('star', 3);
      expect(starSpy).toHaveBeenCalledWith(3, undefined);

      audioManager.playSound('fanfare', 3);
      expect(fanfareSpy).toHaveBeenCalledWith(3, undefined);

      audioManager.playSound('mismatch');
      expect(mismatchSpy).toHaveBeenCalledTimes(2);

      audioManager.playSound('clear');
      expect(clearSpy).toHaveBeenCalledTimes(2);
    });

    it('coordinates background music', () => {
      const startSpy = vi.spyOn(musicSynth, 'start');
      const stopSpy = vi.spyOn(musicSynth, 'stop');
      const pauseSpy = vi.spyOn(musicSynth, 'pause');
      const resumeSpy = vi.spyOn(musicSynth, 'resume');

      audioManager.startMusic();
      expect(startSpy).toHaveBeenCalled();

      audioManager.pauseMusic();
      expect(pauseSpy).toHaveBeenCalled();

      audioManager.resumeMusic();
      expect(resumeSpy).toHaveBeenCalled();

      audioManager.stopMusic();
      expect(stopSpy).toHaveBeenCalled();
    });

    it('listens to settings:change events and updates volumes and mutes', () => {
      eventBus.emit('settings:change', {
        settings: {
          musicVolume: 0.25,
          sfxVolume: 0.85,
          musicMuted: true,
          sfxMuted: false,
        },
      });

      expect(audioManager.getMusicVolume()).toBe(0.25);
      expect(audioManager.getSfxVolume()).toBe(0.85);
      expect(audioManager.isMusicMuted()).toBe(true);
      expect(audioManager.isSfxMuted()).toBe(false);

      expect(musicSynth.getVolume()).toBe(0.25);
      expect(musicSynth.isMuted()).toBe(true);
      expect(soundEffects.getVolume()).toBe(0.85);
      expect(soundEffects.isMuted()).toBe(false);
    });

    it('toggles mute states via helper methods', () => {
      const musicMuted = audioManager.toggleMusicMute();
      expect(audioManager.isMusicMuted()).toBe(musicMuted);

      const sfxMuted = audioManager.toggleSfxMute();
      expect(audioManager.isSfxMuted()).toBe(sfxMuted);
    });
  });
});
