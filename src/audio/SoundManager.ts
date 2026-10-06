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
import themeMusic from '../assets/sounds/theme.mp3';
import thunderSound from '../assets/sounds/thunder.mp3';
import { SOUND_MAX_VOICES, SOUND_PITCH_VARIATION, SOUND_RATES, SOUND_VOLUMES } from '../config';
import { loadAudioSettings, normalizeAudioSettings, saveAudioSettings, type AudioSettings } from './audioSettings';
import { MusicPlayer } from './MusicPlayer';
import type { SpatialMix } from './spatial';

export type SoundId = keyof typeof SOUND_VOLUMES;

/** Every sound has one or more variants; a play picks one at random (never the same twice in a row). */
const SOURCES: Record<SoundId, readonly string[]> = {
  bowShot: [bowShotSound],
  groan: [groan1, groan2, groan3, groan4, groan5, groan6, groan7, groan8],
  explosion: [explosionSound],
  thunder: [thunderSound],
  shrapnelBurst: [bowShotSound],
};

/**
 * Sound effects and the theme music through Web Audio. Effect buffers are decoded once at startup;
 * the context starts suspended (browser autoplay policy) and is resumed on the first key press or
 * click. Every effect gets a slight random pitch. Effects and music have their own volume, and the
 * settings are remembered per browser.
 */
export class SoundManager {
  private readonly context?: AudioContext;
  /** Effects bus (effects volume); music has its own gain inside MusicPlayer. */
  private readonly effects?: GainNode;
  private readonly music?: MusicPlayer;
  private readonly buffers = new Map<SoundId, AudioBuffer[]>();
  private readonly lastVariant = new Map<SoundId, number>();
  private readonly voices = new Map<SoundId, number>();
  private current: AudioSettings;

  public constructor() {
    this.current = loadAudioSettings();
    if (typeof AudioContext === 'undefined') {
      return;
    }
    this.context = new AudioContext();
    this.effects = this.context.createGain();
    this.effects.connect(this.context.destination);
    this.music = new MusicPlayer(this.context, this.context.destination);
    this.applySettings();

    const unlock = (): void => {
      void this.context?.resume();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  /** Loads the theme in the background (large file); it starts as soon as it's decoded. */
  public loadMusic(): Promise<void> {
    return this.music?.load(themeMusic) ?? Promise.resolve();
  }

  /** Fetches and decodes every effect; a failed sound just stays silent. */
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
    if (this.current.effectsEnabled) {
      this.start(id, this.pickVariant(id), mix);
    }
  }

  /**
   * Sound test panel: plays one variant (or a random one) centred, even with effects switched off.
   * Also resumes the context, since the panel's own click may be the first interaction.
   */
  public preview(id: SoundId, variant?: number): void {
    void this.context?.resume();
    const buffer = variant === undefined ? this.pickVariant(id) : this.buffers.get(id)?.[variant];
    this.start(id, buffer, { gain: 1, pan: 0 });
  }

  /** Durations (seconds) of each decoded variant of a sound. */
  public variantDurations(id: SoundId): number[] {
    return (this.buffers.get(id) ?? []).map((buffer) => buffer.duration);
  }

  public get musicState(): { playing: boolean; position: number; duration: number } {
    const music = this.music;
    return { playing: music?.isPlaying ?? false, position: music?.position ?? 0, duration: music?.duration ?? 0 };
  }

  public seekMusic(seconds: number): void {
    this.music?.seek(seconds);
  }

  private start(id: SoundId, buffer: AudioBuffer | undefined, mix: SpatialMix): void {
    const { context, effects } = this;
    const playing = this.voices.get(id) ?? 0;
    if (!context || !effects || !buffer || context.state !== 'running' || playing >= SOUND_MAX_VOICES) {
      return;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = (SOUND_RATES[id] ?? 1) * (1 + (Math.random() * 2 - 1) * SOUND_PITCH_VARIATION);
    const gain = context.createGain();
    gain.gain.value = SOUND_VOLUMES[id] * mix.gain;
    const panner = context.createStereoPanner();
    panner.pan.value = mix.pan;
    source.connect(gain).connect(panner).connect(effects);

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

  public get settings(): Readonly<AudioSettings> {
    return this.current;
  }

  /** Applies and remembers changed sound settings (from the settings drawer). */
  public updateSettings(changes: Partial<AudioSettings>): void {
    this.current = normalizeAudioSettings({ ...this.current, ...changes });
    this.applySettings();
    saveAudioSettings(this.current);
  }

  private applySettings(): void {
    if (this.effects) {
      this.effects.gain.value = this.current.effectsVolume;
    }
    this.music?.setVolume(this.current.musicVolume);
    this.music?.setPlaying(this.current.musicEnabled);
  }
}
