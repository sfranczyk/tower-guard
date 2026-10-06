import { ENEMY_SPEED, SPLASH_GIB_BASE_CHANCE, SPLASH_GIB_THRESHOLD } from '../config';
import type { AttackStyle } from '../rendering/attackSwing';
import type { EnemyType } from '../types';

export interface EnemyStats {
  health: number;
  speed: number;
}

/**
 * Health per type, against a normal arrow's 20 (headshot ×1.25 = 25, explosive direct hit 34): fighters take
 * two arrows, runners and archers drop to one headshot (two body hits), brutes about six, dragons about nine.
 */
const BASE_STATS: Readonly<Record<EnemyType, EnemyStats>> = {
  basic: { health: 35, speed: ENEMY_SPEED },
  fast: { health: 22, speed: ENEMY_SPEED * 1.65 },
  tank: { health: 110, speed: ENEMY_SPEED * 0.62 },
  // Fragile, keeps its distance and shoots.
  archer: { health: 24, speed: ENEMY_SPEED * 0.9 },
  // Flying archer mount: tough, flies in steadily (speed is its horizontal flight speed).
  dragon: { health: 170, speed: ENEMY_SPEED * 1.2 },
};

/** Inclusive min..max of a random hit. */
export type DamageRange = readonly [number, number];

/** What one hit of this type deals to the bowman and to the keep (club swings, or arrows for shooters). */
export interface EnemyDamage {
  /** Club swing (archers too, when caught up close). */
  melee: { bowman: DamageRange; keep: DamageRange };
  /** Arrows of shooting types (archer on foot, dragon rider). */
  arrow?: { bowman: DamageRange; keep: DamageRange };
}

/**
 * Damage per type: runners nick, fighters hit, brutes smash; the keep (2000 by default) takes more per swing
 * than the bowman (100). The dragon rider's arrows hit hardest.
 */
export const ENEMY_DAMAGE: Readonly<Record<EnemyType, EnemyDamage>> = {
  basic: { melee: { bowman: [6, 10], keep: [18, 26] } },
  fast: { melee: { bowman: [3, 6], keep: [10, 16] } },
  tank: { melee: { bowman: [14, 22], keep: [40, 60] } },
  archer: { melee: { bowman: [3, 5], keep: [8, 12] }, arrow: { bowman: [7, 10], keep: [10, 14] } },
  dragon: { melee: { bowman: [0, 0], keep: [0, 0] }, arrow: { bowman: [12, 16], keep: [16, 22] } },
};

/** A random hit within `range` (`roll` 0..1, passed in so tests can pin it). */
export const rollDamage = ([min, max]: DamageRange, roll = Math.random()): number => Math.round(min + (max - min) * roll);

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

/** How each enemy type looks, moves and swings: body size (1 = a normal stickman), club swing, run or walk. */
export interface EnemyLook {
  size: number;
  attackStyle: AttackStyle;
  runs: boolean;
  /**
   * How far (px) the club reaches when it lands: a bowman closer than this takes the hit, so to dodge he
   * has to get this far away during the swing (jumping on the spot doesn't help).
   */
  strikeReach: number;
}

export const ENEMY_LOOKS: Readonly<Record<EnemyType, EnemyLook>> = {
  basic: { size: 1, attackStyle: 'overhead', runs: false, strikeReach: 55 },
  // Runners sprint in and swing a short club from below.
  fast: { size: 1, attackStyle: 'uppercut', runs: true, strikeReach: 45 },
  // Brutes stand half again as tall and chop with a long club in both hands: hard to step away from.
  tank: { size: 1.5, attackStyle: 'twoHanded', runs: false, strikeReach: 85 },
  archer: { size: 1, attackStyle: 'overhead', runs: false, strikeReach: 55 },
  // Never melees (it shoots from the air); see DragonEnemy.
  dragon: { size: 1, attackStyle: 'overhead', runs: false, strikeReach: 0 },
};
