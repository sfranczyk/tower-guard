import { HORSE_LEG } from '../config';
import { HORSE_DEATH_MS, getHorseDeath, horseDeathThrow, type HorseDeath, type HorseDeathKind } from '../rendering/horseDeath';
import type { HitInfo } from './Enemy';

/** Its rider gone, the horse stands this long, then bolts off the far edge this much faster than it came. */
export const HORSE_BOLT = { delayMs: 350, speedFactor: 1.5, beyondEdge: 160 } as const;

/**
 * A mounted knight's horse (Enemy draws it, with or without its rider): its own health, a lame leg, and what becomes of
 * it once the fight is over for it: bolting riderless off the far edge (its rider killed or pulled out of the saddle),
 * or dying (rendering/horseDeath: lying down or dropping) and throwing its rider off part of the way through.
 */
export class Mount {
  public readonly maxHealth: number;
  private health: number;
  /** Hit in the leg, it goes lame for this long (ms): it walks, slowly (HORSE_LEG). */
  private lameMs = 0;
  /** Riderless: it stands a moment, then bolts off the far edge (`gone` once past it). */
  public bolting?: { delayMs: number; gone: boolean };
  /** Killed: how it falls, how far into it (ms), the blow, and whether its rider has left the saddle yet. */
  public death?: { kind: HorseDeathKind; timeMs: number; hit: HitInfo; riderOff: boolean };

  public constructor(health: number) {
    this.maxHealth = Math.max(1, health);
    this.health = this.maxHealth;
  }

  public get isAlive(): boolean {
    return this.health > 0;
  }

  public get ratio(): number {
    return this.health / this.maxHealth;
  }

  public get missingHealth(): number {
    return this.maxHealth - this.health;
  }

  /** Takes `amount` of damage; returns the health left. */
  public hurt(amount: number): number {
    this.health = Math.max(0, this.health - Math.max(0, amount));
    return this.health;
  }

  public heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + Math.max(0, amount));
  }

  public get isLame(): boolean {
    return this.lameMs > 0;
  }

  /** Lame for `durationMs` (a fresh one restarts the time). */
  public lame(durationMs: number): void {
    this.lameMs = Math.max(this.lameMs, durationMs);
  }

  /** Time left lame (co-op: sent to the guest). */
  public get lameLeftMs(): number {
    return this.lameMs;
  }

  public setLame(ms: number): void {
    this.lameMs = Math.max(0, ms);
  }

  /** Its pace: a lame horse goes at HORSE_LEG.lameSpeed. */
  public get speedFactor(): number {
    return this.lameMs > 0 ? HORSE_LEG.lameSpeed : 1;
  }

  public tick(realDeltaMs: number): void {
    this.lameMs = Math.max(0, this.lameMs - realDeltaMs);
  }

  /** Its rider gone, it bolts. */
  public bolt(): void {
    this.bolting = { delayMs: HORSE_BOLT.delayMs, gone: false };
  }

  /** Killed by `hit`: it falls the `kind` way. */
  public die(kind: HorseDeathKind, hit: HitInfo): void {
    this.death = { kind, timeMs: 0, hit, riderOff: false };
  }

  /** Runs its death on; true on the frame its rider leaves the saddle (the host puts him on the ground then). */
  public advanceDeath(deltaMs: number): boolean {
    const death = this.death;
    if (!death) {
      return false;
    }
    death.timeMs += deltaMs;
    if (!death.riderOff && death.timeMs >= horseDeathThrow(death.kind).atMs) {
      death.riderOff = true;
      return true;
    }
    return false;
  }

  /** The horse (and its rider until he leaves the saddle) as it falls now. */
  public get deathPose(): HorseDeath | undefined {
    return this.death ? getHorseDeath(this.death.kind, this.death.timeMs) : undefined;
  }

  /** Its rider off and the fall over: it lies still. */
  public get deathSettled(): boolean {
    return this.death !== undefined && this.death.riderOff && this.death.timeMs >= HORSE_DEATH_MS[this.death.kind];
  }

  /** Dead, its rider still in the saddle (he comes off soon: the level isn't over yet). */
  public get riderPending(): boolean {
    return this.death !== undefined && !this.death.riderOff;
  }
}
