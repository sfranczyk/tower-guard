import { EXPLOSION_DAMAGE, KNOCKBACK_PUSH_MAX, SPLASH_GIB_CHANCE } from '../config';
import type { AttackStyle } from '../rendering/attackSwing';
import type { EnemyType } from '../types';
import { ENEMY_KINDS, ENEMY_TYPES, enemyArchetype, enemyTraits, type DamageRange, type EnemyDamage, type EnemyStats } from './enemyKinds';

export type { DamageRange, EnemyDamage, EnemyStats } from './enemyKinds';

/** Damage per type (data/enemyKinds.ts). */
export const ENEMY_DAMAGE: Readonly<Record<EnemyType, EnemyDamage>> = Object.fromEntries(
  ENEMY_TYPES.map((type) => [type, ENEMY_KINDS[type].damage]),
) as Record<EnemyType, EnemyDamage>;

export type DamageTarget = 'bowman' | 'keep';

/** Damage range of one `attack` by `type` against `target` (a type without arrows uses the archer's). */
export const enemyDamage = (type: EnemyType, attack: keyof EnemyDamage, target: DamageTarget): DamageRange => {
  const range = attack === 'arrow' ? ENEMY_DAMAGE[type].arrow ?? ENEMY_DAMAGE.archer.arrow! : ENEMY_DAMAGE[type].melee;
  const factor = target === 'keep' ? ENEMY_KINDS[type].keepDamage?.[attack] ?? 1 : 1;
  return [range[0] * factor, range[1] * factor];
};

/** How long a pinning arrow holds this type in place (ms); 0 = it can't be pinned (its race's traits: ogres, dragons). */
export const pinDurationMs = (type: EnemyType): number => enemyTraits(type).pinMs;

/** A random hit within `range` (`roll` 0..1, passed in so tests can pin it). */
export const rollDamage = ([min, max]: DamageRange, roll = Math.random()): number => Math.round(min + (max - min) * roll);

/** Stats for an enemy type scaled by the level's difficulty multiplier. */
export const getEnemyStats = (type: EnemyType, difficulty: number): EnemyStats => {
  const base = ENEMY_KINDS[type].stats;
  return {
    health: Math.round(base.health * difficulty),
    speed: base.speed * difficulty,
  };
};

const smoothstep = (from: number, to: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/**
 * Chance (0..1) that a killing splash explosion blows the body apart, by distance from the blast as a
 * fraction of the radius: near the centre almost certain, at the edge only a small chance (SPLASH_GIB_CHANCE).
 */
export const splashGibChance = (distance: number): number => {
  const { near, far, max, min } = SPLASH_GIB_CHANCE;
  return min + (max - min) * (1 - smoothstep(near, far, distance));
};

/**
 * Whether a killing blow blows the body apart: always for a direct explosive hit ('blast'), by
 * splashGibChance for a splash explosion (`distance` = fraction of the radius, edge if unknown).
 * `roll` is a random 0..1, passed in so tests can pin it.
 */
export const blowsApart = (cause: string, distance = 1, roll = Math.random()): boolean =>
  cause === 'blast' || (cause === 'explosion' && roll < splashGibChance(distance));

/**
 * A mounted knight killed: thrown off his horse he fights on, unless the blow that brought him down was a headshot, a
 * direct explosive hit or shattered ice, which kills the rider too.
 */
export const unhorsedRiderDies = (cause: string): boolean => cause === 'headshot' || cause === 'blast' || cause === 'shatter';

/** Explosion damage `distance` (fraction of EXPLOSION_RADIUS, 0 = centre or a direct hit) from the blast. */
export const explosionDamage = (distance: number): number => {
  const t = Math.max(0, Math.min(1, distance));
  return Math.round(EXPLOSION_DAMAGE.centre + (EXPLOSION_DAMAGE.edge - EXPLOSION_DAMAGE.centre) * t);
};

/** Extra push (px) on top of the knockback fall for an enemy `distance` (fraction of the radius) from a blast. */
export const knockbackPush = (distance: number): number => KNOCKBACK_PUSH_MAX * Math.max(0, 1 - distance) ** 1.5;

/** How each enemy type looks, moves and swings: its build (data/enemyKinds.ts) with its archetype's swing and gait. */
export interface EnemyLook {
  /** Body size (1 = a normal stickman). */
  size: number;
  /** Its usual swing (the standing grip). */
  attackStyle: AttackStyle;
  /** The swings it picks from, one per attack (the black knight has three). */
  attackStyles: readonly AttackStyle[];
  runs: boolean;
  /**
   * How far (px) the club reaches when it lands: a bowman closer than this takes the hit, so to dodge he
   * has to get this far away during the swing (jumping on the spot doesn't help).
   */
  strikeReach: number;
  /** How close it comes to the bowman and the keep's centre to strike (default EnemyAI's): a mounted knight stops short. */
  reach?: { bowman: number; keep: number };
  /** Sway speed of standing poses (ms per phase radian, default 150): zombies sway slower. Walking and
   * running follow the actual speed (Enemy.stridePhase), so the feet never slide. */
  stepMs?: number;
}

export const ENEMY_LOOKS: Readonly<Record<EnemyType, EnemyLook>> = Object.fromEntries(ENEMY_TYPES.map((type) => {
  const { attackStyle, runs } = enemyArchetype(type);
  return [type, { ...ENEMY_KINDS[type].build, attackStyle, attackStyles: ENEMY_KINDS[type].attackStyles ?? [attackStyle], runs }];
})) as Record<EnemyType, EnemyLook>;
