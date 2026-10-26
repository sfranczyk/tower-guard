import { bodyBounds, headBounds, type BodyShape } from '../../systems/bodyHitShape';
import type { Bounds } from '../../types';
import { boundsAround } from '../../utils/math';
import type Enemy from './Enemy';

/** How it's drawn now, for its hit shape (systems/bodyHitShape.ts). */
const shapeOf = (enemy: Enemy): BodyShape => {
  const { drawn } = enemy.figure;
  return { transform: enemy.figure.transform(), size: enemy.look.size, pose: drawn?.pose, head: drawn?.head };
};

/** The body's box in world space; on horseback round the rider's and the horse's zones. */
export const enemyBodyBounds = (enemy: Enemy): Bounds => {
  const zones = enemy.rider?.hitZones();
  if (zones) {
    return boundsAround(zones.flatMap(({ bounds }) => [{ x: bounds.left, y: bounds.top }, { x: bounds.right, y: bounds.bottom }]), 0);
  }
  return bodyBounds(shapeOf(enemy));
};

/** The drawn head's box (follows bob, lean, scale and falls), in world space; a rider's head on horseback. */
export const enemyHeadBounds = (enemy: Enemy): Bounds => enemy.rider?.hitZones()?.[0].bounds ?? headBounds(shapeOf(enemy));
