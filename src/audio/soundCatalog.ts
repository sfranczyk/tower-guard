import type { SoundId } from './SoundManager';

/** What each sound effect is, where it comes from and when the game plays it (sound test panel). */
export interface SoundInfo {
  title: string;
  description: string;
  /** The user's recording in human/ it was cut from (or how it was made). */
  source: string;
}

export const SOUND_INFO: Readonly<Record<SoundId, SoundInfo>> = {
  bowShot: {
    title: 'Bow shot',
    description: 'Every arrow loosed, by the bowman and by enemy archers.',
    source: 'Pciu.m4a',
  },
  groan: {
    title: 'Enemy groan',
    description: 'An enemy hit by an arrow, kills and headshots included (not when an explosive arrow kills). One of eight takes, never the same twice in a row.',
    source: 'Aj.m4a',
  },
  explosion: {
    title: 'Explosion',
    description: 'Explosive arrows bursting on enemies, the ground or the enemy keep. A long, rumbling boom.',
    source: 'Synthesized with ffmpeg (low thump, brown-noise blast, crackle, long rumble)',
  },
  shrapnelBurst: {
    title: 'Shrapnel burst',
    description: 'A shrapnel arrow bursting into three small arrows (Space in flight).',
    source: 'Pciu.m4a, played faster',
  },
  thunder: {
    title: 'Thunder',
    description: 'Lightning on storm battlegrounds: loud for ground strikes, a distant rumble for sky flashes.',
    source: 'Bum.m4a (thunder.mp3), played at half speed',
  },
};

export const MUSIC_INFO = {
  title: 'Theme · Resonant Drones',
  description: 'Plays everywhere. The intro plays once, then the track loops; the seam is crossfaded inside the file.',
  source: 'resonant-drone.mp3 (Suno)',
} as const;
