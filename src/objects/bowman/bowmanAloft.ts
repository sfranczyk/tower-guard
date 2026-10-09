import { landedKnockdown } from '../../systems/bowmanMotion';
import { groundAt } from '../../systems/terrain';
import { FALL_DURATION_MS } from '../../rendering/stickmanFall';
import type { Vec2 } from '../../types';
import type { Bowman } from './Bowman';

/** Thrown by a vortex he lands into the knockback this far into it (lying on his back). */
const LANDING_PROGRESS = 0.72;
/** The pinned foot is this far behind him (px). */
const PINNED_FOOT_BACK = 4;

/**
 * The bowman held by a vortex, thrown through the air by one, landing, and pinned by the foot (Bowman delegates here;
 * with friendly fire these come from the players' own arrows).
 */

/** Pinned by the foot for `durationMs` (a fresh pin restarts the time); not while up in the air or knocked down. */
export const pin = (bowman: Bowman, durationMs: number): void => {
  if (!bowman.isDead && !bowman.isAloft && !bowman.knockdown && !bowman.isInTower) {
    bowman.motion.pin(durationMs);
    bowman.footing.horizontalSpeed = 0;
  }
};

/** Where his pinned foot is (world): just behind him, on the ground. */
export const pinnedFootPoint = (bowman: Bowman): Vec2 => {
  const x = bowman.x - bowman.figure.facing * PINNED_FOOT_BACK;
  return { x, y: groundAt(x) };
};

/**
 * Held by a vortex this frame at `x`, lifted `lift` px (he flails once off his feet) and turned `lean`;
 * `levitating` when the vortex arrow hit him (he glows). Meanwhile he can't move, aim or shoot.
 */
export const holdInVortex = (bowman: Bowman, x: number, lift: number, lean: number, levitating: boolean): void => {
  if (bowman.isDead || bowman.knockdown || bowman.motion.isThrown || bowman.isInTower) {
    return;
  }
  bowman.x = x;
  bowman.footing.constrain(bowman);
  bowman.y = groundAt(bowman.x) - lift;
  bowman.afflictions.holdInVortex(lift, lean, levitating);
  bowman.dropDraw();
  bowman.footing.stop();
  bowman.motion.setPin(0);
};

/** Thrown through the air at (`vx`, `vy`) px/s, tumbling at `spin` radians/s: he flails and lands on his back. */
export const throwInAir = (bowman: Bowman, vx: number, vy: number, spin: number): void => {
  const { motion, afflictions } = bowman;
  if (bowman.knockdown || motion.isThrown) {
    return;
  }
  const rotation = afflictions.inVortex ? afflictions.lean : 0;
  afflictions.releaseVortex();
  motion.throw(bowman.x, bowman.y, vx, vy, spin, rotation);
  bowman.dropDraw();
  bowman.footing.stop();
  motion.setPin(0);
  // Faces against the way he flies, so he falls backwards along it.
  bowman.figure.facing = vx > 0 ? -1 : 1;
};

/** Thrown by a vortex: falls, tumbles and flails (frozen, as a block of ice) and lands on his back. */
export const updateFlight = (bowman: Bowman, deltaMs: number): void => {
  const { motion } = bowman;
  const { vx } = motion.flight!;
  const { min, max } = bowman.footing.edges;
  // Co-op guest: the host moves him and says when he's down (applyNetState); only the tumble is played here.
  const driven = motion.fromNet;
  const step = motion.step(deltaMs, min, max, driven);
  if (step.landed && !driven) {
    bowman.position.set(step.flight.x, step.flight.y);
    land(bowman, vx, step.impactSpeed);
    return;
  }
  if (!driven) {
    bowman.position.set(step.flight.x, step.flight.y);
  }
  bowman.figure.redraw();
};

/** Hits the ground on his back (into the knockback's lying pose); alive, he gets up after a while. Then onLanded. */
export const land = (bowman: Bowman, vx: number, impactSpeed: number): void => {
  const landed = bowman.motion.endFlight();
  bowman.y = groundAt(bowman.x);
  bowman.footing.verticalVelocity = 0;
  bowman.figure.facing = vx > 0 ? -1 : 1;
  if (bowman.isDead) {
    bowman.deathFall = { kind: 'knockback', timeMs: FALL_DURATION_MS.knockback * LANDING_PROGRESS };
  } else {
    bowman.knockdown = landedKnockdown(LANDING_PROGRESS);
  }
  bowman.figure.redraw();
  landed?.(impactSpeed);
};
