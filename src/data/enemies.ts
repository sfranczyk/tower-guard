import { ENEMY_SPEED, EXPLOSION_DAMAGE, KNOCKBACK_PUSH_MAX, PIN_DURATION_MS, PIN_DURATION_ZOMBIE_MS, SPLASH_GIB_CHANCE } from '../config';
import type { AttackStyle } from '../rendering/attackSwing';
import type { EnemyType } from '../types';

export interface EnemyStats {
  health: number;
  speed: number;
}

/**
 * Health per type, against a normal arrow's 20 (headshot ×1.25 = 25, explosive arrow only its blast, 35 at the centre down to 10 at the edge): fighters take
 * two arrows, runners and archers drop to one headshot (two body hits), brutes about six, dragons about nine.
 * Kamikazes die to any normal arrow (they must be stopped before they reach you); zombies shamble but take three.
 */
const BASE_STATS: Readonly<Record<EnemyType, EnemyStats>> = {
  basic: { health: 35, speed: ENEMY_SPEED },
  fast: { health: 22, speed: ENEMY_SPEED * 2.1 },
  tank: { health: 110, speed: ENEMY_SPEED * 0.6 },
  // Fragile, keeps its distance and shoots.
  archer: { health: 24, speed: ENEMY_SPEED * 0.9 },
  // Flying archer mount: tough, flies in steadily (speed is its horizontal flight speed).
  dragon: { health: 170, speed: ENEMY_SPEED * 1.2 },
  // Flies in lower and closer to breathe fire.
  fireDragon: { health: 170, speed: ENEMY_SPEED * 1.2 },
  // Sprints at the bowman with a bomb and blows up on contact.
  kamikaze: { health: 18, speed: ENEMY_SPEED * 2 },
  // Slow, arms out, hard to put down.
  zombie: { health: 60, speed: ENEMY_SPEED * 0.45 },
};

/** Inclusive min..max of a random hit. */
export type DamageRange = readonly [number, number];

/** What one hit of this type deals to the bowman (the keep takes it × KEEP_DAMAGE_MULTIPLIER). */
export interface EnemyDamage {
  /** Club swing (archers too, when caught up close; the zombie's grab; the kamikaze's own explosion). */
  melee: DamageRange;
  /** Arrows of shooting types (archer on foot, dragon rider). */
  arrow?: DamageRange;
}

/** Damage per type: runners nick, fighters hit, brutes smash. The dragon rider's arrows hit hardest. */
export const ENEMY_DAMAGE: Readonly<Record<EnemyType, EnemyDamage>> = {
  basic: { melee: [6, 10] },
  fast: { melee: [3, 6] },
  tank: { melee: [14, 22] },
  archer: { melee: [3, 5], arrow: [7, 10] },
  dragon: { melee: [0, 0], arrow: [12, 16] },
  // No hits of its own: its fire sets the bowman alight (BURN_* in config.ts, systems/burning.ts).
  fireDragon: { melee: [0, 0] },
  kamikaze: { melee: [24, 32] },
  zombie: { melee: [8, 12] },
};

/**
 * How much harder an attack hits the keep than the bowman (1 unless listed): archers' arrows barely scratch
 * the stone (their club hits both alike), brutes smash it and a kamikaze's bomb is made for walls.
 */
export const KEEP_DAMAGE_MULTIPLIER: Readonly<Partial<Record<EnemyType, Partial<Record<keyof EnemyDamage, number>>>>> = {
  archer: { arrow: 0.5 },
  tank: { melee: 2 },
  kamikaze: { melee: 8 },
};

export type DamageTarget = 'bowman' | 'keep';

/** Damage range of one `attack` by `type` against `target` (a type without arrows uses the archer's). */
export const enemyDamage = (type: EnemyType, attack: keyof EnemyDamage, target: DamageTarget): DamageRange => {
  const range = attack === 'arrow' ? ENEMY_DAMAGE[type].arrow ?? ENEMY_DAMAGE.archer.arrow! : ENEMY_DAMAGE[type].melee;
  const factor = target === 'keep' ? KEEP_DAMAGE_MULTIPLIER[type]?.[attack] ?? 1 : 1;
  return [range[0] * factor, range[1] * factor];
};

/** How long a pinning arrow holds this type in place (ms); 0 = it can't be pinned (brutes, dragons). */
export const pinDurationMs = (type: EnemyType): number => {
  if (type === 'tank' || type === 'dragon' || type === 'fireDragon') {
    return 0;
  }
  return type === 'zombie' ? PIN_DURATION_ZOMBIE_MS : PIN_DURATION_MS;
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

/** Explosion damage `distance` (fraction of EXPLOSION_RADIUS, 0 = centre or a direct hit) from the blast. */
export const explosionDamage = (distance: number): number => {
  const t = Math.max(0, Math.min(1, distance));
  return Math.round(EXPLOSION_DAMAGE.centre + (EXPLOSION_DAMAGE.edge - EXPLOSION_DAMAGE.centre) * t);
};

/** Extra push (px) on top of the knockback fall for an enemy `distance` (fraction of the radius) from a blast. */
export const knockbackPush = (distance: number): number => KNOCKBACK_PUSH_MAX * Math.max(0, 1 - distance) ** 1.5;

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
  /** Sway speed of standing poses (ms per phase radian, default 150): zombies sway slower. Walking and
   * running follow the actual speed (Enemy.stridePhase), so the feet never slide. */
  stepMs?: number;
}

export const ENEMY_LOOKS: Readonly<Record<EnemyType, EnemyLook>> = {
  basic: { size: 1, attackStyle: 'overhead', runs: false, strikeReach: 55 },
  // Runners (goblins, three quarters of a man's height) sprint in and stab up from below.
  fast: { size: 0.75, attackStyle: 'uppercut', runs: true, strikeReach: 45 },
  // Brutes stand half again as tall and chop with a long club in both hands: hard to step away from.
  tank: { size: 1.5, attackStyle: 'twoHanded', runs: false, strikeReach: 85 },
  archer: { size: 1, attackStyle: 'overhead', runs: false, strikeReach: 55 },
  // Never melees (it shoots from the air); see DragonEnemy.
  dragon: { size: 1, attackStyle: 'overhead', runs: false, strikeReach: 0 },
  fireDragon: { size: 1, attackStyle: 'overhead', runs: false, strikeReach: 0 },
  // Runs in unarmed with a bomb on its chest and detonates on contact (CombatSystem.detonate).
  kamikaze: { size: 1, attackStyle: 'overhead', runs: true, strikeReach: 0 },
  // Shuffles with its arms out; grabs and yanks its hands back (hits within arm's reach).
  zombie: { size: 1, attackStyle: 'grab', runs: false, strikeReach: 50, stepMs: 240 },
};
