import { ENEMY_HEALTH, ENEMY_SPEED } from '../config';
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
