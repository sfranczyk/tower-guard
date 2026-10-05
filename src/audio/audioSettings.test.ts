import { describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS, normalizeAudioSettings } from './audioSettings';

describe('normalizeAudioSettings', () => {
  it('uses defaults for missing or invalid values and clamps volumes', () => {
    expect(normalizeAudioSettings(undefined)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(normalizeAudioSettings({ musicEnabled: 'yes', musicVolume: 3, effectsVolume: -1 })).toEqual({
      ...DEFAULT_AUDIO_SETTINGS,
      musicVolume: 1,
      effectsVolume: 0,
    });
  });

  it('reads the older effects-only shape', () => {
    expect(normalizeAudioSettings({ enabled: false, volume: 0.4 })).toEqual({
      ...DEFAULT_AUDIO_SETTINGS,
      effectsEnabled: false,
      effectsVolume: 0.4,
    });
  });
});
