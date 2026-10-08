import {
  BOWMAN_KNOCKBACK,
  SPRINT_ACCELERATION,
  SPRINT_DECELERATION,
  SPRINT_MAX_MULTIPLIER,
  WALK_ACCELERATION,
  WALK_DECELERATION,
} from '../config';
import { FALL_DURATION_MS } from '../rendering/stickmanFall';
import { approach, clamp } from '../utils/math';

/**
 * The bowman's own moves (pure, tested): how his walking speed follows the controls, and a knockdown by a blast:
 * thrown onto his back (stickmanFall's knockback, played BOWMAN_KNOCKBACK.animationSpeed times faster), sliding away
 * from the blast, lying BOWMAN_KNOCKBACK.lieMs and getting up.
 */

/**
 * His horizontal speed (px/s, signed) after `deltaSeconds` of pushing `direction` (−1..1, 0 = let go): he speeds up
 * to his pace (`movementSpeed`, × SPRINT_MAX_MULTIPLIER sprinting, × `pace` chilled), turns round at the walking
 * deceleration and slows down to a stop when let go.
 */
export const walkSpeed = (
  speed: number, direction: number, sprinting: boolean, deltaSeconds: number, movementSpeed: number, pace = 1,
): number => {
  if (deltaSeconds <= 0) {
    return speed;
  }
  const push = clamp(direction, -1, 1);
  if (push !== 0) {
    const targetSpeed = push * movementSpeed * (sprinting ? SPRINT_MAX_MULTIPLIER : 1) * pace;
    const acceleration = sprinting ? SPRINT_ACCELERATION : WALK_ACCELERATION;
    const isReversing = Math.sign(targetSpeed) !== Math.sign(speed) && Math.abs(speed) > 0;
    return approach(speed, targetSpeed, (isReversing ? WALK_DECELERATION : acceleration) * deltaSeconds);
  }
  const deceleration = Math.abs(speed) > movementSpeed ? SPRINT_DECELERATION : WALK_DECELERATION;
  return approach(speed, 0, deceleration * deltaSeconds);
};

/** Knocked down by a blast: thrown onto his back (the knockback), lies a moment, gets up. */
export interface Knockdown {
  kind: 'knockback' | 'getUp';
  timeMs: number;
  /** Extra slide away from the blast (px) over the fall, on top of the pose's own throw. */
  push: number;
  pushed: number;
}

/** A fresh knockdown, sliding up to BOWMAN_KNOCKBACK.pushMax × `strength` (0..1) away from the blast. */
export const startKnockdown = (strength: number): Knockdown =>
  ({ kind: 'knockback', timeMs: 0, push: BOWMAN_KNOCKBACK.pushMax * clamp(strength, 0, 1), pushed: 0 });

/** Thrown by a vortex, he lands on his back this far through the knockback, then lies and gets up as after a blast. */
export const landedKnockdown = (landingProgress: number): Knockdown =>
  ({ kind: 'knockback', timeMs: (FALL_DURATION_MS.knockback * landingProgress) / BOWMAN_KNOCKBACK.animationSpeed, push: 0, pushed: 0 });

/** How far through its pose (0..1) the knockdown is. */
export const knockdownProgress = (knockdown: Readonly<Knockdown>): number =>
  Math.min(1, (knockdown.timeMs * BOWMAN_KNOCKBACK.animationSpeed) / FALL_DURATION_MS[knockdown.kind]);

/**
 * One step: the knockdown after it (undefined once he stands: `stoodUp`), and how far (px) he slides away from the
 * blast this step (most of it while flying, easing out on landing). `alive` false: he stays lying.
 */
export const stepKnockdown = (
  knockdown: Readonly<Knockdown>, deltaMs: number, alive: boolean,
): { knockdown?: Knockdown; slide: number; stoodUp: boolean } => {
  const next = { ...knockdown, timeMs: knockdown.timeMs + deltaMs };
  const progress = knockdownProgress(next);
  if (next.kind === 'knockback') {
    const target = next.push * progress * progress * (3 - 2 * progress);
    const slide = target - next.pushed;
    next.pushed = target;
    const lyingMs = next.timeMs - FALL_DURATION_MS.knockback / BOWMAN_KNOCKBACK.animationSpeed;
    if (lyingMs >= BOWMAN_KNOCKBACK.lieMs && alive) {
      return { knockdown: { ...next, kind: 'getUp', timeMs: 0 }, slide, stoodUp: false };
    }
    return { knockdown: next, slide, stoodUp: false };
  }
  return progress >= 1 ? { knockdown: undefined, slide: 0, stoodUp: true } : { knockdown: next, slide: 0, stoodUp: false };
};
