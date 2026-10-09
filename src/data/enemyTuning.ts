import { tunable } from '../core/tuning';
import type { EnemyType } from '../types';
import { ENEMY_KINDS, ENEMY_TYPES } from './enemyKinds';

const perType = (read: (type: EnemyType) => number): Record<EnemyType, number> =>
  Object.fromEntries(ENEMY_TYPES.map((type) => [type, Number(read(type).toPrecision(10))])) as Record<EnemyType, number>;

/**
 * Enemy health and speed per type, tunable (`?tune`), defaults from ENEMY_KINDS (`stats`; the mounted knight's horse
 * from `mount.health`). Read at spawn (`getEnemyStats`, `mountHealth`), so a change applies to the next enemies.
 */
export const ENEMY_HEALTH = tunable('ENEMY_HEALTH', 'Enemy health', {
  ...perType((type) => ENEMY_KINDS[type].stats.health),
  horseKnightMount: ENEMY_KINDS.horseKnight.mount?.health ?? 0,
}, { file: 'src/data/enemyTuning.ts', derivedFrom: 'ENEMY_KINDS (data/enemyKinds.ts), stats.health / mount.health' });

export const ENEMY_SPEED_BY_TYPE = tunable('ENEMY_SPEED_BY_TYPE', 'Enemy speed', perType((type) => ENEMY_KINDS[type].stats.speed),
  { file: 'src/data/enemyTuning.ts', derivedFrom: 'ENEMY_KINDS (data/enemyKinds.ts), stats.speed (px/s; ENEMY_SPEED × factor)' });

/** A rider's horse's health at spawn (its own health if it has none). */
export const mountHealth = (type: EnemyType, fallback: number): number =>
  type === 'horseKnight' ? ENEMY_HEALTH.horseKnightMount : ENEMY_KINDS[type].mount?.health ?? fallback;
