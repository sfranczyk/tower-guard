/**
 * 'dragon' is a dark flying dragon with an archer rider, 'fireDragon' a red one that breathes fire and whose
 * rider is unarmed (both objects/dragon/DragonEnemy.ts).
 */
export type EnemyType =
  | 'raider' | 'fast' | 'tank' | 'troll' | 'hunter' | 'dragon' | 'fireDragon' | 'kamikaze' | 'goblinKamikaze' | 'zombie' | 'knight' | 'heavyKnight' | 'horseKnight' | 'priest' | 'shaman';
/** The player's soldiers (summoned from beyond the left edge; data/enemyKinds.ts entries with `side: 'ally'`). */
export type AllyType = 'squire' | 'allyKnight' | 'medic';
/** MOBA lane minions of the player's side that no other mode has (data/enemyKinds.ts entries with `minion: true`). */
export type MinionType = 'blueArcher';
/** Any stickman kind on the field (an `Enemy` object), foe or ally. */
export type UnitType = EnemyType | AllyType | MinionType;
/** 'fragment' is one of the small arrows a shrapnel arrow bursts into (not selectable). */
export type ProjectileType = 'normal' | 'explosive' | 'piercing' | 'shrapnel' | 'pinning' | 'fire' | 'frost' | 'vortex' | 'fragment';

export interface IPushStrength {
  readonly value: number;
  readonly max: number;
  readonly distance: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Bounds extends Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
