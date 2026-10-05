import { ENEMY_HEALTH, ENEMY_SPEED, SPLASH_GIB_CHANCE, SPLASH_GIB_THRESHOLD } from '../config';
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
 * Whether a killing blow blows the body apart: always for a direct explosive hit ('blast'); for a
 * splash explosion that dealt more than SPLASH_GIB_THRESHOLD of the max health, with
 * SPLASH_GIB_CHANCE (`roll` is a random 0..1, passed in so tests can pin it).
 */
export const blowsApart = (cause: string, damage: number, maxHealth: number, roll = Math.random()): boolean =>
  cause === 'blast'
  || (cause === 'explosion' && damage > maxHealth * SPLASH_GIB_THRESHOLD && roll < SPLASH_GIB_CHANCE);
