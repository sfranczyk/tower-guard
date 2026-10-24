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
  arrowFlesh: {
    title: 'Arrow into flesh',
    description: 'An arrow sinking into a body: enemies, dragons and the bowman (enemy arrows, or his own with friendly fire). Not into ice, and not an explosive arrow (that is just the blast).',
    source: 'Pghrt.m4a',
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
  allyCurse: {
    title: 'Ally curse',
    description: 'MOBA: a soldier hit by an arrow from a player of his own team curses him (instead of the groan). Seven takes: 1–6 at 16% each, the long rant (7) at 4% (ALLY_CURSE_CHANCES, ?tune).',
    source: 'Allay hit.m4a',
  },
};

export const MUSIC_INFO = {
  title: 'Theme · Resonant Drones',
  description: 'Plays everywhere. The intro plays once, then the track loops; the seam is crossfaded inside the file.',
  source: 'resonant-drone.mp3 (Suno)',
} as const;

/**
 * What player `localIndex` hears of a sound meant for `heardBy` alone (an ally curse is for the shooter's ears; the
 * others hear the plain groan). Without `heardBy` everyone hears `id`.
 */
export const soundFor = (id: SoundId, heardBy: number | undefined, localIndex: number): SoundId =>
  heardBy === undefined || heardBy === localIndex ? id : 'groan';
