import { SURVIVAL } from '../config';

/**
 * The night of a survival level on a `nightCycle` map (pure, tested): where the moon and the sun are and how far dawn
 * has come at `progress` (0 = the level starts, 1 = its time is up). The moon is up at nightfall and crosses the sky,
 * setting at SURVIVAL.moonSetAt; dawn starts at SURVIVAL.dawnAt (stars fade, the sky warms, then turns to day) and the
 * sun's disc clears the horizon exactly at 1. rendering/NightSky.ts draws it.
 */
export interface NightSkyState {
  /** Across the view (0 left .. 1 right) and above the horizon (0 on it .. 1 at the top); hidden once set. */
  moon: { x: number; height: number; visible: boolean };
  stars: number;
  /** Weights of the dawn and day skies laid over the night sky (0..1). */
  dawn: number;
  day: number;
  /** Strength of the night shade over the hills (1 = full night). */
  shade: number;
  /** How far the hills have turned to their day colours (0 night .. 1 day). */
  hillsLight: number;
  /** -1: a radius below the horizon (hidden), 0: centred on it, 1: the whole disc above it. */
  sunRise: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const smoothstep = (from: number, to: number, value: number): number => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

/** Where the sun rises across the view (east, over the enemy's side). */
export const SUN_X = 0.72;

export const nightSky = (progress: number): NightSkyState => {
  const p = clamp01(progress);
  const moonT = p / SURVIVAL.moonSetAt;
  // Already up at nightfall (a quarter of its arc), highest a third of the way, on the horizon when it sets.
  const moonHeight = Math.sin(Math.PI * (0.25 + 0.75 * Math.min(1, moonT)));
  const dawnAt = Math.min(0.99, SURVIVAL.dawnAt);
  const dawn = clamp01((p - dawnAt) / (1 - dawnAt));
  return {
    moon: { x: 0.08 + 0.86 * Math.min(1, moonT), height: Math.max(0, moonHeight), visible: moonT < 1 },
    stars: 1 - smoothstep(0, 0.6, dawn),
    dawn: smoothstep(0, 0.55, dawn),
    day: smoothstep(0.45, 1, dawn),
    shade: 1 - smoothstep(0.15, 1, dawn),
    hillsLight: smoothstep(0.15, 1, dawn),
    sunRise: -1 + 2 * smoothstep(0.55, 1, dawn) ** 0.8,
  };
};
