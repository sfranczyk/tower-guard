import type Bowman from '../objects/Bowman';
import type DragonEnemy from '../objects/DragonEnemy';
import type { HitBox } from '../objects/DragonEnemy';
import type Enemy from '../objects/Enemy';
import type { Vec2 } from '../types';

/** Shapes the combat code shares (CombatSystem, EnemyAI, ArrowHits): the bowman's box, the enemies' hit zones. */

/** A ground enemy (stickman) or a flying dragon archer. */
export type Foe = Enemy | DragonEnemy;

/** Bowman hit box (feet at bowman.y) and where enemy archers aim on him. */
const BOWMAN_HALF_WIDTH = 7;
const BOWMAN_HEIGHT = 40;
export const BOWMAN_CHEST = 22;
/** Half the width of the keeps' walls (melee and blasts reach the wall here). */
export const TOWER_HALF_WIDTH = 48;

/** A bowman's hit box (feet at his y). */
export const bowmanBox = (bowman: Bowman): { left: number; right: number; top: number; bottom: number } => ({
  left: bowman.x - BOWMAN_HALF_WIDTH, right: bowman.x + BOWMAN_HALF_WIDTH, top: bowman.y - BOWMAN_HEIGHT, bottom: bowman.y,
});

/**
 * Stickmen: head and body; a mounted knight: the rider's head (a headshot) and torso, the horse's body, neck and head.
 * Dragons: rider and dragon head (headshots), body and tail.
 */
export const foeHitBoxes = (enemy: Foe): HitBox[] => enemy.getHitBoxes();

export const pointAlong = (start: Vec2, travel: Vec2, time: number): Vec2 => ({
  x: start.x + travel.x * time,
  y: start.y + travel.y * time,
});
