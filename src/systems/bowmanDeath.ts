import type { FallKind } from '../rendering/stickmanFall';

/**
 * How the bowman dies (pure, tested): the same falls as the enemies (rendering/stickmanFall.ts), picked by what
 * killed him, like Enemy.takeDamage picks theirs.
 */

/**
 * What hurt the bowman last: a club, an arrow (an enemy archer's, a dragon rider's or, with friendly fire, a
 * player's), fire, lightning, a blast or a fall (thrown by a vortex).
 */
export type BowmanHitCause = 'melee' | 'arrow' | 'burn' | 'lightning' | 'blast' | 'fall';

export interface BowmanHit {
  cause: BowmanHitCause;
  /** World x the hit came from (he falls as if hit from there). */
  fromX: number;
}

/**
 * The fall a killing hit plays (`roll` 0..1 picks between two): clubbed down he collapses face down or crumples,
 * shot he topples stiffly or crumples, a burn crumples him, lightning drops him stiff, a blast throws him on his
 * back (the knockback).
 */
export const deathFallFor = (cause: BowmanHitCause | undefined, roll = Math.random()): FallKind => {
  switch (cause) {
    case 'melee':
      return roll < 0.5 ? 'death' : 'deathCrumple';
    case 'arrow':
      return roll < 0.5 ? 'deathStiff' : 'deathCrumple';
    case 'lightning':
      return 'deathStiff';
    case 'blast':
    case 'fall':
      return 'knockback';
    default:
      return 'deathCrumple';
  }
};
