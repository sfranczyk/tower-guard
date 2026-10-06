import { mixColor } from './clouds';

/**
 * Pure helpers for the flat keep (rendering/keep.ts): its damage stage and stone colours.
 */

/** 0 intact · 1 cracked · 2 broken merlons, torn banners, rubble · 3 burning. */
export type KeepDamage = 0 | 1 | 2 | 3;

/** Damage stage for a health ratio: above 60% intact, then cracks, then broken (30%), burning (10%). */
export const keepDamageStage = (healthRatio: number): KeepDamage => {
  if (healthRatio > 0.6) {
    return 0;
  }
  if (healthRatio > 0.3) {
    return 1;
  }
  return healthRatio > 0.1 ? 2 : 3;
};

export interface KeepTones {
  base: number;
  /** Lit left edges and soft stone blocks. */
  light: number;
  /** Right-hand shadow side. */
  shade: number;
  /** Slots, cracks, poles. */
  deep: number;
  /** Merlons, cornices and the plinth top. */
  cap: number;
}

const STONE = 0xa79f92;
const DARK = 0x1d2228;

/** Stone tones: the base grey mixed 14% towards the battleground's far hills, so the keep sits in its light. */
export const keepTones = (hillColor: number): KeepTones => {
  const base = mixColor(STONE, hillColor, 0.14);
  return {
    base,
    light: mixColor(base, 0xffffff, 0.28),
    shade: mixColor(base, DARK, 0.22),
    deep: mixColor(base, DARK, 0.6),
    cap: mixColor(base, 0xffffff, 0.12),
  };
};
