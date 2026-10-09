import type { MountPart } from '../../data/enemies';
import type { Bounds, Vec2 } from '../../types';
import type { AfflictionNet } from '../AfflictionLayer';
import type { ThrowNet } from '../../systems/bodyMotion';

/** The types an Enemy's callers and parts share (re-exported from Enemy.ts). */

/** One hit zone of an enemy or dragon (world space). */
export interface HitBox {
  bounds: Bounds;
  headshot: boolean;
  /** A mounted knight's horse's leg (less damage, may lame it: ArrowHits). */
  leg?: boolean;
  /** A mounted knight: whether it's the rider or the horse that's hit. */
  part?: MountPart;
}

/** Where an enemy heads for. */
export type EnemyTarget = 'bowman' | 'tower';

/** What dealt the damage, and from which side, so the right reaction plays. */
export interface HitInfo {
  /**
   * 'blast' = hit directly by an explosive arrow (a kill blows the body apart); 'burn' = a fire arrow's burn;
   * 'shatter' = killed while frozen (it bursts into pieces of ice); 'fall' = landing after a vortex threw it.
   */
  cause: 'arrow' | 'headshot' | 'explosion' | 'blast' | 'lightning' | 'burn' | 'shatter' | 'fall';
  /** World x the hit came from; the enemy turns to face it before falling. */
  fromX: number;
  /** World point of impact (used for 'blast' to throw the pieces away from it). */
  point?: Vec2;
  /** Splash explosions: distance from the blast as a fraction of its radius (0 centre .. 1 edge). */
  blastDistance?: number;
  /** A mounted knight: whether the arrow hit the rider or the horse (mountedDamage; none = by the cause). */
  part?: MountPart;
}

/**
 * How a mounted knight's rider leaves the saddle (the host puts him on the ground as an enemy of his own): with the health
 * he has left (0: dead), thrown away from `thrownFrom` `force` times as hard as THROWN_RIDER, or (`lift`) pulled up
 * out of it by a vortex.
 */
export interface RiderOff {
  health: number;
  thrownFrom: number;
  force?: number;
  lift?: boolean;
}

/** What a co-op guest needs of a ground enemy besides its position (Enemy.getNetState). */
export interface EnemyNet {
  vx: number;
  aim?: number;
  tension?: number;
  ready?: number;
  pinned?: number;
  af?: AfflictionNet;
  th?: ThrowNet;
  /** The priest's mana. */
  mana?: number;
  /** A mounted knight's lame horse: time left (ms). */
  lame?: number;
}
