import { FALL_DURATION_MS, getFallPose, type FallKind } from '../../rendering/stickmanFall';
import { deathFallFor } from '../../systems/bowmanDeath';
import { startKnockdown, stepKnockdown } from '../../systems/bowmanMotion';
import { groundAt } from '../../systems/terrain';
import type { Bowman } from './Bowman';

/**
 * A bowman going down and getting up (Bowman's `knockBack`, `die`, `revive`): thrown down by a blast, killed (falling as
 * an enemy would), and in MOBA back on his feet after the respawn wait.
 */

/**
 * Thrown onto his back away from a blast at `fromX` (he turns to face it), slides up to BOWMAN_KNOCKBACK.pushMax ×
 * `strength` (0..1) further, lies a moment and gets up. Ignored inside the keep.
 */
export const knockBack = (bowman: Bowman, fromX: number, strength: number): void => {
  if (bowman.isInTower || bowman.knockdown || bowman.isAloft) {
    return;
  }
  bowman.netHooks?.knockedBack(fromX, strength);
  // The blast breaks the ice and tears the pin out.
  bowman.afflictions.warm();
  bowman.motion.setPin(0);
  bowman.figure.facing = fromX >= bowman.x ? 1 : -1;
  bowman.aim.carry(bowman.figure.facing);
  bowman.dropDraw();
  bowman.footing.horizontalSpeed = 0;
  bowman.knockdown = startKnockdown(strength);
  bowman.figure.redraw();
};

/**
 * Plays the fall, slides away from the blast meanwhile, lies BOWMAN_KNOCKBACK.lieMs and gets up; then moves to where
 * the get-up pose ends. Killed meanwhile, he stays lying on his back.
 */
export const updateKnockdown = (bowman: Bowman, deltaMs: number): void => {
  const step = stepKnockdown(bowman.knockdown!, deltaMs, !bowman.isDead);
  bowman.knockdown = step.knockdown;
  const { facing } = bowman.figure;
  if (step.slide !== 0) {
    // Away from the blast is −facing.
    bowman.x -= facing * step.slide;
    bowman.footing.constrain(bowman);
  } else if (step.stoodUp) {
    // The get-up ends standing behind where the fall started; move there for real.
    bowman.x += getFallPose('getUp', 1).hip.x * facing * bowman.scale.x;
    bowman.footing.constrain(bowman);
    bowman.figure.stand();
  }
  bowman.figure.redraw();
};

/**
 * Killed: drops the aim and falls like an enemy would to what hit him last (deathFallFor), turned as if hit from
 * there; `kind` and `fromX` set it instead (a co-op guest plays the host's). Thrown down by a blast already, he just
 * stays down. `alreadyFallen` (fell in an earlier level) starts him lying on his back. Returns the fall.
 */
export const die = (bowman: Bowman, death: { kind?: FallKind; fromX?: number }, alreadyFallen: boolean): FallKind => {
  if (bowman.deathMs !== undefined) {
    return bowman.deathFall?.kind ?? 'knockback';
  }
  bowman.deathMs = 0;
  bowman.aim.drop();
  bowman.footing.horizontalSpeed = 0;
  bowman.motion.setPin(0);
  // Frozen solid, he topples stiffly (the scene shatters the ice).
  const frozen = bowman.isFrozen;
  bowman.afflictions.warm();
  if (bowman.afflictions.inVortex) {
    // Killed in a vortex: he drops out of it and lands lying.
    bowman.throwInAir(0, 0, 0);
  }
  if (bowman.motion.isThrown) {
    // Up in the air: he falls, lands on his back and stays there (land).
    return 'knockback';
  }
  if (alreadyFallen) {
    bowman.knockdown = undefined;
    bowman.deathFall = { kind: 'knockback', timeMs: FALL_DURATION_MS.knockback };
  } else if (bowman.knockdown?.kind === 'knockback') {
    // Thrown down by the blast that killed him: he doesn't get up (updateKnockdown).
    return 'knockback';
  } else {
    bowman.knockdown = undefined;
    const fromX = death.fromX ?? bowman.lastHit?.fromX;
    if (fromX !== undefined && fromX !== bowman.x) {
      bowman.figure.facing = fromX > bowman.x ? 1 : -1;
    }
    bowman.deathFall = { kind: death.kind ?? (frozen ? 'deathStiff' : deathFallFor(bowman.lastHit?.cause)), timeMs: 0 };
  }
  bowman.figure.redraw();
  return bowman.deathFall.kind;
};

/** MOBA: back on his feet at `x` (his keep) after the respawn wait: no fall, burn, ice, pin or aim left. */
export const revive = (bowman: Bowman, x: number): void => {
  bowman.deathMs = undefined;
  bowman.deathFall = undefined;
  bowman.knockdown = undefined;
  bowman.lastHit = undefined;
  bowman.afflictions.warm();
  bowman.afflictions.extinguish();
  bowman.motion.setPin(0);
  bowman.aim.drop();
  bowman.exitTower();
  bowman.footing.horizontalSpeed = 0;
  bowman.setHorizontalPosition(x);
  bowman.y = groundAt(x);
  bowman.figure.redraw();
};
