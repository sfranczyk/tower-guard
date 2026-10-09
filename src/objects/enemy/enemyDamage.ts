import { horseDeathKind, mountedDamage } from '../../data/enemies';
import { groundAt } from '../../systems/terrain';
import type Enemy from './Enemy';
import { KNOCKDOWN_LIE_MS, blastPush, damageReaction, deathKind } from './enemyFall';
import type { HitInfo } from './enemyTypes';
import type { Mount } from './Mount';

/** A blast that doesn't kill a mounted knight makes the horse shy (it stands a moment) instead of knocking it down. */
const HORSE_SHY_MS = 450;

/** An enemy's health (pure, tested): full health, what is left, and whether it is still in the fight. */
export class Vitals {
  public readonly max: number;
  private current: number;
  private inFight = true;

  public constructor(health: number) {
    this.current = Math.max(0, health);
    this.max = Math.max(1, health);
  }

  public get health(): number {
    return this.current;
  }

  public get alive(): boolean {
    return this.inFight && this.current > 0;
  }

  public get ratio(): number {
    return this.current / this.max;
  }

  public get missing(): number {
    return this.max - this.current;
  }

  public hurt(amount: number): void {
    this.current = Math.max(0, this.current - Math.max(0, amount));
  }

  /** Gets up to `amount` back (never over full health); returns how much it took. */
  public restore(amount: number): number {
    const taken = Math.min(amount, this.max - this.current);
    this.current += taken;
    return taken;
  }

  public set(health: number): void {
    this.current = Math.max(0, Math.min(this.max, health));
  }

  /** Out of the fight (dead, or a mounted knight unhorsed), whatever its health. */
  public end(): void {
    this.inFight = false;
  }
}

/**
 * Applies damage and plays the reaction (damageReaction): a death animation when killed (headshot → stiff fall,
 * explosion → knockback, otherwise a random collapse), or a knockdown when an explosion doesn't kill.
 */
export const applyDamage = (enemy: Enemy, amount: number, hit: HitInfo): void => {
  const { vitals, figure, afflictions, motion } = enemy;
  if (enemy.rider) {
    applyMountedDamage(enemy, enemy.rider.mount, amount, hit);
    return;
  }
  vitals.hurt(amount);
  enemy.drawHealthBar();
  // Explosions throw the closer ones further (a direct hit counts as the centre).
  const { distance, push } = blastPush(hit);
  // Up in the air (lifted or flying) it falls back down first and lands lying.
  const aloft = motion.isThrown || afflictions.inVortex;
  const killed = vitals.health === 0;
  if (killed) {
    vitals.end();
    enemy.halt();
    enemy.bars.health.visible = false;
  }
  const reaction = damageReaction(hit.cause, killed, aloft, distance);
  if (reaction === 'none') {
    return;
  }
  if (reaction === 'stayDown') {
    // Already lying from the landing: it just doesn't get up.
    if (figure.fall) {
      figure.fall.getUpAfterMs = undefined;
    }
    return;
  }
  afflictions.thaw();
  if (reaction === 'shatter' || reaction === 'blowApart') {
    afflictions.extinguish();
    figure.blowApart(hit.fromX, hit.point ?? { x: enemy.x, y: enemy.y - 20 }, reaction === 'shatter');
  } else if (reaction === 'dropFromAir') {
    if (!motion.isThrown) {
      enemy.throwInAir(0, 0, 0);
    }
  } else if (reaction === 'deathFall') {
    figure.startFall(deathKind(hit.cause), hit.fromX, undefined, push);
  } else {
    figure.startFall('knockback', hit.fromX, KNOCKDOWN_LIE_MS, push);
  }
};

/**
 * On horseback: the hit is shared between rider and horse (mountedDamage). While both live, a blast only makes the
 * horse shy (it is never knocked down). The rider killed, the horse bolts; the horse killed, it falls (lying down, or
 * dropping when killed outright) and throws its rider off part of the way through (MountedRider).
 */
const applyMountedDamage = (enemy: Enemy, mount: Mount, amount: number, hit: HitInfo): void => {
  const share = mountedDamage(Math.max(0, amount), hit.cause, hit.part);
  enemy.vitals.hurt(share.rider);
  mount.hurt(share.horse);
  enemy.drawHealthBar();
  if (enemy.vitals.health > 0 && mount.isAlive) {
    if (hit.cause === 'explosion' || hit.cause === 'blast' || hit.cause === 'lightning') {
      enemy.actions.stagger(HORSE_SHY_MS);
    }
    return;
  }
  leaveFight(enemy);
  if (mount.isAlive) {
    mount.bolt();
    enemy.onUnhorsed?.(enemy.x, hit, { health: 0, thrownFrom: hit.fromX });
  } else {
    mount.die(horseDeathKind(hit.cause, hit.part), hit);
  }
};

/**
 * A vortex arrow hit the rider: he's pulled up out of the saddle (the host returns him, to lift him in its vortex) and
 * the riderless horse bolts.
 */
export const unseatRider = (enemy: Enemy): Enemy | undefined => {
  if (!enemy.rider || !enemy.isAlive()) {
    return undefined;
  }
  enemy.netHooks?.unseated?.();
  leaveFight(enemy);
  enemy.rider.mount.bolt();
  return enemy.onUnhorsed?.(enemy.x, { cause: 'arrow', fromX: enemy.x }, { health: enemy.vitals.health, thrownFrom: enemy.x, lift: true });
};

/** The mounted knight is out of the fight (its rider off or dead): whatever held it lets go, it stands on the ground. */
const leaveFight = (enemy: Enemy): void => {
  const { afflictions } = enemy;
  enemy.vitals.end();
  enemy.halt();
  enemy.bars.health.visible = false;
  afflictions.thaw();
  afflictions.warm();
  afflictions.extinguish();
  enemy.motion.endFlight();
  enemy.y = groundAt(enemy.x);
  enemy.actions.interrupt();
};

/** Healed by a priest: `amount` health back (up to full); on horseback the more wounded of the two (by share) first. */
export const applyHeal = (enemy: Enemy, amount: number): void => {
  let left = amount;
  const mount = enemy.rider?.mount;
  if (mount && mount.ratio < enemy.vitals.ratio) {
    const toHorse = Math.min(left, mount.missingHealth);
    mount.heal(toHorse);
    left -= toHorse;
  }
  const toRider = enemy.vitals.restore(left);
  mount?.heal(left - toRider);
  enemy.drawHealthBar();
};
