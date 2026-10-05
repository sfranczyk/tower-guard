import { MUSIC_DEFAULT_VOLUME, SOUND_DEFAULT_VOLUME } from '../config';

/** Sound effect and music preferences from the settings drawer (volumes 0..1). */
export interface AudioSettings {
  effectsEnabled: boolean;
  effectsVolume: number;
  musicEnabled: boolean;
  musicVolume: number;
}

const STORAGE_KEY = 'tower-guard.audio';

export const DEFAULT_AUDIO_SETTINGS: Readonly<AudioSettings> = {
  effectsEnabled: true,
  effectsVolume: SOUND_DEFAULT_VOLUME,
  musicEnabled: true,
  musicVolume: MUSIC_DEFAULT_VOLUME,
};

const clampVolume = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

/** Fills gaps and clamps volumes (also reads the older { enabled, volume } shape). */
export const normalizeAudioSettings = (input: Record<string, unknown> | undefined): AudioSettings => {
  const stored = input ?? {};
  const flag = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);
  return {
    effectsEnabled: flag(stored.effectsEnabled ?? stored.enabled, DEFAULT_AUDIO_SETTINGS.effectsEnabled),
    effectsVolume: clampVolume(stored.effectsVolume ?? stored.volume, DEFAULT_AUDIO_SETTINGS.effectsVolume),
    musicEnabled: flag(stored.musicEnabled, DEFAULT_AUDIO_SETTINGS.musicEnabled),
    musicVolume: clampVolume(stored.musicVolume, DEFAULT_AUDIO_SETTINGS.musicVolume),
  };
};

export const loadAudioSettings = (): AudioSettings => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeAudioSettings(raw ? (JSON.parse(raw) as Record<string, unknown>) : undefined);
  } catch {
    return normalizeAudioSettings(undefined);
  }
};

export const saveAudioSettings = (settings: AudioSettings): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Not critical: the settings just won't be remembered.
  }
};
