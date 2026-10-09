import { PINNED_FOOT } from '../../rendering/stickmanPinned';
import { groundAt } from '../../systems/terrain';
import type { Vec2 } from '../../types';
import type Enemy from './Enemy';
import { BODY_SCALE, FIELD } from './EnemyFigure';

/** A rider leaving the saddle tumbles off it, not far (px up, px/s, radians/s); he lands on his back and gets up. */
const THROWN_RIDER = { saddle: 22, vx: 28, vy: -70, spin: 1.6 } as const;

/**
 * How an enemy moves (Enemy delegates here): walking towards its target, held by a vortex, thrown through the air,
 * pinned by the foot, and a mounted knight's rider leaving the saddle.
 */

/** One frame of walking towards `target` (or left), unless something holds it: frozen, in a vortex, pinned, swinging. */
export const walk = (enemy: Enemy, realDeltaMs: number, target: Vec2 | undefined, stopDistance: number): void => {
  const { motion, afflictions, actions, velocity } = enemy;
  // A pin holds for its full time; everything else runs at the afflictions' pace (slowed, or held when frozen).
  motion.tickPin(realDeltaMs);
  enemy.rider?.mount.tick(realDeltaMs);
  const deltaMs = realDeltaMs * afflictions.timeScale;
  // The pause between swings runs down all the time, also while the bowman is out of reach.
  actions.tickCooldown(deltaMs);
  if (!enemy.isAlive() || enemy.figure.fall) {
    return;
  }
  // Frozen solid, held by a vortex (which also sets its position) or flying: no walking of its own.
  if (afflictions.isFrozen || afflictions.inVortex || motion.isThrown) {
    enemy.halt();
    return;
  }
  // Pinned: struggles on the spot; planted while swinging (the club is moving, the feet aren't), casting or staggered.
  if (motion.isPinned || actions.swinging || actions.casting || actions.tickStagger(deltaMs)) {
    enemy.halt();
    enemy.y = groundAt(enemy.x);
    return;
  }

  // A lame horse goes at HORSE_LEG.lameSpeed.
  const speed = enemy.speed * (enemy.rider?.mount.speedFactor ?? 1);
  if (!target) {
    velocity.x = -speed;
    velocity.y = 0;
  } else if (Math.abs(target.x - enemy.x) <= stopDistance) {
    enemy.halt();
  } else {
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const length = Math.hypot(dx, dy) || 1;
    velocity.x = (dx / length) * speed;
    velocity.y = (dy / length) * speed;
  }

  // A brute in a vortex's reach struggles on against the wind.
  const deltaSeconds = (deltaMs * afflictions.headwind) / 1000;
  enemy.x += velocity.x * deltaSeconds;
  enemy.y = groundAt(enemy.x);
};

/**
 * Held by a vortex this frame at `x`, lifted `lift` px off the ground (it flails once off its feet) and turned
 * `lean`; `levitating` when the vortex arrow hit it (it glows). Meanwhile it can't walk or swing.
 */
export const holdInVortex = (enemy: Enemy, x: number, lift: number, lean: number, levitating: boolean): void => {
  if (!enemy.isAlive() || enemy.figure.fall || enemy.motion.isThrown) {
    return;
  }
  enemy.x = Math.max(FIELD.min, Math.min(FIELD.max, x));
  enemy.y = groundAt(enemy.x) - lift;
  enemy.afflictions.holdInVortex(lift, lean, levitating);
  enemy.halt();
  enemy.actions.interrupt();
};

/**
 * Thrown through the air at (`vx`, `vy`) px/s, tumbling at `spin` radians/s: it flails (or flies as a block of ice)
 * and lands on its back into the knockback (EnemyFigure); then `onLanded`.
 */
export const throwInAir = (enemy: Enemy, vx: number, vy: number, spin: number): void => {
  const { figure, afflictions, rides } = enemy;
  if (figure.gibs || figure.fall) {
    return;
  }
  // A horse doesn't tumble: dropped by a vortex it comes down on its hooves.
  const rotation = afflictions.inVortex && !rides ? afflictions.lean : 0;
  afflictions.releaseVortex();
  enemy.motion.throw(enemy.x, enemy.y, rides ? vx * 0.3 : vx, vy, rides ? 0 : spin, rotation);
  enemy.halt();
  enemy.actions.stop();
  // Faces against the way it flies, so it falls backwards along it.
  if (!rides) {
    figure.face(vx > 0 ? -1 : 1);
  }
};

/** Pinned to the ground for `durationMs` (a fresh pin restarts the time); not while it's up in the air. */
export const pin = (enemy: Enemy, durationMs: number): void => {
  if (enemy.isAlive() && !enemy.motion.isThrown && !enemy.afflictions.inVortex && enemy.motion.pin(durationMs)) {
    enemy.figure.startStruggle();
  }
};

/** Where the stuck foot of a pinned enemy is (world): its rear foot, behind it (it faces the way it walked). */
export const pinnedFootPoint = (enemy: Enemy): Vec2 => {
  const x = enemy.x + PINNED_FOOT.x * BODY_SCALE.x * enemy.figure.facing * enemy.scale.x;
  return { x, y: groundAt(x) };
};

/** A rider pulled out of the saddle by a vortex: he starts at saddle height (the vortex lifts him from there). */
export const liftFromSaddle = (enemy: Enemy): void => {
  enemy.y = groundAt(enemy.x) - THROWN_RIDER.saddle;
};

/**
 * Thrown off its horse (a mounted knight's rider, just put where the horse stood): flies off backwards from the
 * saddle, away from `fromX`, lands on its back and gets up later; `fromNet` on a co-op guest (the host flies it).
 */
export const throwOff = (enemy: Enemy, fromX: number, fromNet: boolean, force: number): void => {
  const away = enemy.x >= fromX ? 1 : -1;
  enemy.y -= THROWN_RIDER.saddle;
  enemy.throwInAir(away * THROWN_RIDER.vx * force, THROWN_RIDER.vy * Math.sqrt(force), away * THROWN_RIDER.spin);
  enemy.motion.fromNet = fromNet;
};
