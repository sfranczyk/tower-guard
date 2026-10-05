import bowShotSound from '../assets/sounds/bow-shot.mp3';
import explosionSound from '../assets/sounds/explosion.mp3';
import groan1 from '../assets/sounds/groan-1.mp3';
import groan2 from '../assets/sounds/groan-2.mp3';
import groan3 from '../assets/sounds/groan-3.mp3';
import groan4 from '../assets/sounds/groan-4.mp3';
import groan5 from '../assets/sounds/groan-5.mp3';
import groan6 from '../assets/sounds/groan-6.mp3';
import groan7 from '../assets/sounds/groan-7.mp3';
import groan8 from '../assets/sounds/groan-8.mp3';
import { SOUND_DEFAULT_VOLUME, SOUND_MAX_VOICES, SOUND_PITCH_VARIATION, SOUND_VOLUMES } from '../config';
import type { SpatialMix } from './spatial';

export type SoundId = keyof typeof SOUND_VOLUMES;

/** Every sound has one or more variants; a play picks one at random (never the same twice in a row). */
const SOURCES: Record<SoundId, readonly string[]> = {
  bowShot: [bowShotSound],
  groan: [groan1, groan2, groan3, groan4, groan5, groan6, groan7, groan8],
  explosion: [explosionSound],
};

const STORAGE_KEY = 'tower-guard.audio';

interface AudioSettings {
  enabled: boolean;
  volume: number;
}

/**
 * Sound effects through Web Audio. Buffers are decoded once at startup; the context starts
 * suspended (browser autoplay policy) and is resumed on the first key press or click. Every play
 * gets a slight random pitch, and the enabled/volume settings are remembered per browser.
 */
export class SoundManager {
  private readonly context?: AudioContext;
  private readonly master?: GainNode;
  private readonly buffers = new Map<SoundId, AudioBuffer[]>();
  private readonly lastVariant = new Map<SoundId, number>();
  private readonly voices = new Map<SoundId, number>();
  private settings: AudioSettings;

  public constructor() {
    this.settings = SoundManager.loadSettings();
    if (typeof AudioContext === 'undefined') {
      return;
    }
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.connect(this.context.destination);
    this.applyVolume();

    const unlock = (): void => {
      void this.context?.resume();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  /** Fetches and decodes every sound; a failed sound just stays silent. */
  public async load(): Promise<void> {
    const context = this.context;
    if (!context) {
      return;
    }
    await Promise.all((Object.keys(SOURCES) as SoundId[]).map(async (id) => {
      const decoded = await Promise.all(SOURCES[id].map(async (url) => {
        try {
          return await context.decodeAudioData(await (await fetch(url)).arrayBuffer());
        } catch {
          return undefined; // Missing or undecodable file: the game plays on without it.
        }
      }));
      this.buffers.set(id, decoded.filter((buffer): buffer is AudioBuffer => buffer !== undefined));
    }));
  }

  public play(id: SoundId, mix: SpatialMix = { gain: 1, pan: 0 }): void {
    const { context, master } = this;
    const buffer = this.pickVariant(id);
    const playing = this.voices.get(id) ?? 0;
    if (!context || !master || !buffer || !this.settings.enabled || context.state !== 'running'
      || playing >= SOUND_MAX_VOICES) {
      return;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 1 + (Math.random() * 2 - 1) * SOUND_PITCH_VARIATION;
    const gain = context.createGain();
    gain.gain.value = SOUND_VOLUMES[id] * mix.gain;
    const panner = context.createStereoPanner();
    panner.pan.value = mix.pan;
    source.connect(gain).connect(panner).connect(master);

    this.voices.set(id, playing + 1);
    source.addEventListener('ended', () => this.voices.set(id, (this.voices.get(id) ?? 1) - 1));
    source.start();
  }

  private pickVariant(id: SoundId): AudioBuffer | undefined {
    const variants = this.buffers.get(id) ?? [];
    if (variants.length <= 1) {
      return variants[0];
    }
    const last = this.lastVariant.get(id);
    let index = Math.floor(Math.random() * (variants.length - 1));
    if (last !== undefined && index >= last) {
      index += 1;
    }
    this.lastVariant.set(id, index);
    return variants[index];
  }

  public get enabled(): boolean {
    return this.settings.enabled;
  }

  public get volume(): number {
    return this.settings.volume;
  }

  public setEnabled(enabled: boolean): void {
    this.settings = { ...this.settings, enabled };
    this.saveSettings();
  }

  /** Master volume 0..1. */
  public setVolume(volume: number): void {
    this.settings = { ...this.settings, volume: Math.max(0, Math.min(1, volume)) };
    this.applyVolume();
    this.saveSettings();
  }

  private applyVolume(): void {
    if (this.master) {
      this.master.gain.value = this.settings.volume;
    }
  }

  private static loadSettings(): AudioSettings {
    const defaults = { enabled: true, volume: SOUND_DEFAULT_VOLUME };
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<AudioSettings>;
      return {
        enabled: typeof stored.enabled === 'boolean' ? stored.enabled : defaults.enabled,
        volume: typeof stored.volume === 'number' ? Math.max(0, Math.min(1, stored.volume)) : defaults.volume,
      };
    } catch {
      return defaults;
    }
  }

  private saveSettings(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Not critical: the setting just won't be remembered.
    }
  }
}
