/** Sound effects and music. */
/** Sound effects: default effects volume (0..1) and the base volume of each sound. */
export const SOUND_DEFAULT_VOLUME = 0.7;
export const SOUND_VOLUMES = { bowShot: 0.7, arrowFlesh: 0.8, groan: 0.75, explosion: 1, thunder: 1, shrapnelBurst: 0.6 } as const;
/** Base playback rate per sound (thunder is the explosion recording slowed down). */
export const SOUND_RATES: Partial<Record<keyof typeof SOUND_VOLUMES, number>> = { thunder: 0.5, shrapnelBurst: 1.7 };
/** Theme music volume (0..1), loop range in the file (see MusicPlayer) and fade time when toggled. */
export const MUSIC_DEFAULT_VOLUME = 0.35;
export const MUSIC_LOOP_START_S = 10.5;
export const MUSIC_LOOP_END_S = 228;
export const MUSIC_FADE_S = 1.2;
/** Each play is pitched randomly by ±this fraction so repeats don't sound identical. */
export const SOUND_PITCH_VARIATION = 0.07;
/** At most this many copies of one sound play at once (piercing hits, volleys). */
export const SOUND_MAX_VOICES = 6;
/** Sounds at the screen edge pan this far; off-screen ones fade to SOUND_MIN_GAIN over one screen width. */
export const SOUND_MAX_PAN = 0.6;
export const SOUND_MIN_GAIN = 0.2;
