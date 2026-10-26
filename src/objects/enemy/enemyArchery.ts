import { getArcherRig, toArcherLocalAngle } from '../../rendering/archer';
import { spriteToWorld } from '../../systems/bodyAnchor';
import type { Vec2 } from '../../types';
import type Enemy from './Enemy';

/**
 * An archer (EnemyRanged, AllyRanged): face `angle`, raise the bow, draw, and true on the frame the arrow is released.
 * Called every frame while standing in range; `relaxBow` otherwise.
 */
export const aimBow = (archer: Enemy, angle: number, realDeltaMs: number): boolean => {
  // Chilled archers draw slower; frozen or caught in a vortex, not at all.
  const deltaMs = archer.afflictions.inVortex ? 0 : realDeltaMs * archer.afflictions.timeScale;
  if (deltaMs === 0) {
    return false;
  }
  archer.halt();
  archer.figure.face(Math.cos(angle) < 0 ? -1 : 1);
  return archer.bow.draw(angle, deltaMs, archer.buff.drawPace);
};

/** Lowers the bow (walking, knocked down, no target). */
export const relaxBow = (archer: Enemy, realDeltaMs: number): void => {
  archer.bow.relax(realDeltaMs * archer.afflictions.timeScale);
};

/** Where the arrow is nocked, in world space (matches the drawn bow). */
export const bowReleasePoint = (archer: Enemy): Vec2 => {
  const { bow, figure } = archer;
  const localAngle = toArcherLocalAngle(bow.aimAngle, figure.body.rotation, figure.facing);
  return spriteToWorld(getArcherRig(localAngle, bow.tension, bow.ready).stringNock, figure.transform());
};
