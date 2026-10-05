import type { SoundId } from './SoundManager';

/** What each sound effect is, where it comes from and when the game plays it (sound test panel). */
export interface SoundInfo {
  title: string;
  description: string;
  /** The user's recording in human/ it was cut from. */
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
    description: 'An enemy hit by an arrow (not on headshot or blast kills). One of eight takes, never the same twice in a row.',
    source: 'Aj.m4a',
  },
  explosion: {
    title: 'Explosion',
    description: 'Explosive arrows bursting on enemies, the ground or the enemy keep.',
    source: 'Bum.m4a',
  },
  thunder: {
    title: 'Thunder',
    description: 'Lightning on storm battlegrounds: loud for ground strikes, a distant rumble for sky flashes.',
    source: 'Bum.m4a, played at half speed',
  },
};

export const MUSIC_INFO = {
  title: 'Theme · Resonant Drones',
  description: 'Plays everywhere. The intro plays once, then the track loops; the seam is crossfaded inside the file.',
  source: 'resonant-drone.mp3 (Suno)',
} as const;
