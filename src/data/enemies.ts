import { ENEMY_HEALTH, ENEMY_SPEED, SPLASH_GIB_BASE_CHANCE, SPLASH_GIB_THRESHOLD } from '../config';
import type { EnemyType } from '../types';

export interface EnemyStats {
  health: number;
  speed: number;
}

const BASE_STATS: Readonly<Record<EnemyType, EnemyStats>> = {
  basic: { health: ENEMY_HEALTH, speed: ENEMY_SPEED },
  fast: { health: Math.round(ENEMY_HEALTH * 0.7), speed: ENEMY_SPEED * 1.65 },
  tank: { health: Math.round(ENEMY_HEALTH * 2.6), speed: ENEMY_SPEED * 0.62 },
  // Fragile, keeps its distance and shoots.
  archer: { health: Math.round(ENEMY_HEALTH * 0.8), speed: ENEMY_SPEED * 0.9 },
};

/** Stats for an enemy type scaled by the level's difficulty multiplier. */
export const getEnemyStats = (type: EnemyType, difficulty: number): EnemyStats => {
  const base = BASE_STATS[type];
  return {
    health: Math.round(base.health * difficulty),
    speed: base.speed * difficulty,
  };
};

/**
 * Chance (0..1) that a killing splash explosion blows the body apart: none up to SPLASH_GIB_THRESHOLD
 * of max health, then SPLASH_GIB_BASE_CHANCE plus a point per damage-% above it (76% → 51%,
 * 100% → 75%, 125%+ → certain).
 */
export const splashGibChance = (damage: number, maxHealth: number): number => {
  const share = damage / maxHealth;
  if (share <= SPLASH_GIB_THRESHOLD) {
    return 0;
  }
  return Math.min(1, SPLASH_GIB_BASE_CHANCE + (share - SPLASH_GIB_THRESHOLD));
};

/**
 * Whether a killing blow blows the body apart: always for a direct explosive hit ('blast'), by
 * splashGibChance for a splash explosion. `roll` is a random 0..1, passed in so tests can pin it.
 */
export const blowsApart = (cause: string, damage: number, maxHealth: number, roll = Math.random()): boolean =>
  cause === 'blast' || (cause === 'explosion' && roll < splashGibChance(damage, maxHealth));
