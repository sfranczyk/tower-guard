import { ENEMY_TOWER_X, GROUND_Y, PLAYER_TOWER_X, TERRAIN_AMPLITUDE } from '../config';

/**
 * The ground's surface: gentle waves around GROUND_Y, flattened at both keeps so they stand level.
 * Pure apart from the current wave height (`useTerrain`); the ground is drawn along it and everyone
 * walks, lands and gets hit on it.
 */

/** Keeps sit on flat ground out to FLAT_RADIUS, blending into the waves by BLEND_RADIUS. */
const FLAT_RADIUS = 110;
const BLEND_RADIUS = 230;

/** Sum of three sines, scaled into −1..1. */
const wave = (x: number): number =>
  Math.sin(x / 150 + 0.8) * 0.6 + Math.sin(x / 63 + 2.1) * 0.28 + Math.sin(x / 37 + 0.4) * 0.12;

const smoothstep = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** 0 on the flat ground at a keep, 1 out in the field. */
const flatness = (x: number): number => {
  const nearestKeep = Math.min(Math.abs(x - PLAYER_TOWER_X), Math.abs(x - ENEMY_TOWER_X));
  return smoothstep((nearestKeep - FLAT_RADIUS) / (BLEND_RADIUS - FLAT_RADIUS));
};

/** Wave height and how close together the waves come (1 = normal) of the current battleground (set when its Background is built). */
let amplitude = TERRAIN_AMPLITUDE;
let waviness = 1;

/**
 * Selects the current battleground's terrain (Background calls this; scenes share one terrain): its wave height, and
 * its `wavesPer` (more than 1: more, shorter waves on the same stretch).
 */
export const useTerrain = (waveHeight: number = TERRAIN_AMPLITUDE, wavesPer = 1): void => {
  amplitude = waveHeight;
  waviness = wavesPer;
};

/** Ground surface height (y) at world x. */
export const groundAt = (x: number): number => GROUND_Y + amplitude * wave(x * waviness) * flatness(x);
