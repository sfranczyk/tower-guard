import {
  PRIEST_FOLLOW_GAP,
  PRIEST_HEAL_INTERVAL_MS,
  PRIEST_HEAL_PER_TARGET,
  PRIEST_HEAL_RADIUS,
  PRIEST_MANA_MAX,
  PRIEST_MANA_REGEN_PER_S,
  PRIEST_MIN_CAST_MANA,
  PRIEST_STANDOFF,
} from '../config';
import type { Vec2 } from '../types';

/**
 * The dark priest (pure, tested): where it walks (behind the soldiers), a mana pool that refills fast, and which
 * wounded enemies around it one cast heals by how much. EnemyAI runs it on the host; the guest only sees the heals and
 * the mana.
 */

/**
 * Where the priest heads (x): PRIEST_FOLLOW_GAP behind the soldier nearest to it (`soldiers`: their x), on the side
 * away from `targetX` (the bowman it goes for, or the keep), but never nearer the target than PRIEST_STANDOFF. When the
 * soldiers around it die, the nearest one left is further back, so it falls back behind them; with none left on the
 * field it retreats to `retreatX`.
 */
export const priestPost = (priestX: number, soldiers: readonly number[], targetX: number, retreatX: number): number => {
  if (soldiers.length === 0) {
    return retreatX;
  }
  const anchor = soldiers.reduce((best, x) => (Math.abs(x - priestX) < Math.abs(best - priestX) ? x : best));
  const away = Math.sign(anchor - targetX) || Math.sign(priestX - targetX) || 1;
  const post = anchor + away * PRIEST_FOLLOW_GAP;
  return Math.abs(post - targetX) < PRIEST_STANDOFF ? targetX + away * PRIEST_STANDOFF : post;
};

/** A wounded enemy the priest could heal: where it stands and how much health it is missing. */
export interface HealCandidate {
  at: Vec2;
  missing: number;
}

/** One heal of a cast: the candidate's index and the health it gets back. */
export interface Heal {
  index: number;
  amount: number;
}

/**
 * Who a cast from `from` heals, with `mana` to spend (one mana a point): the wounded within PRIEST_HEAL_RADIUS, nearest
 * first, each by up to PRIEST_HEAL_PER_TARGET (never more than it is missing), until the mana runs out.
 */
export const planHeals = (from: Vec2, candidates: readonly HealCandidate[], mana: number): Heal[] => {
  let left = mana;
  return candidates
    .map((candidate, index) => ({ index, missing: candidate.missing, distance: Math.hypot(candidate.at.x - from.x, candidate.at.y - from.y) }))
    .filter(({ missing, distance }) => missing > 0 && distance <= PRIEST_HEAL_RADIUS)
    .sort((a, b) => a.distance - b.distance)
    .flatMap(({ index, missing }) => {
      const amount = Math.min(PRIEST_HEAL_PER_TARGET, missing, Math.floor(left));
      left -= amount;
      return amount > 0 ? [{ index, amount }] : [];
    });
};

/** The priest's mana and the pause between casts. */
export class ManaPool {
  private manaLeft = PRIEST_MANA_MAX;
  private cooldownMs = 0;

  public get mana(): number {
    return this.manaLeft;
  }

  public get ratio(): number {
    return this.manaLeft / PRIEST_MANA_MAX;
  }

  /** Refills and runs the pause down. */
  public update(deltaMs: number): void {
    this.manaLeft = Math.min(PRIEST_MANA_MAX, this.manaLeft + (PRIEST_MANA_REGEN_PER_S * deltaMs) / 1000);
    this.cooldownMs = Math.max(0, this.cooldownMs - deltaMs);
  }

  /** The pause is over and there's enough mana to be worth a cast. */
  public get canCast(): boolean {
    return this.cooldownMs === 0 && this.manaLeft >= PRIEST_MIN_CAST_MANA;
  }

  /** A cast spending `amount` mana; the next one waits PRIEST_HEAL_INTERVAL_MS. */
  public spend(amount: number): void {
    this.manaLeft = Math.max(0, this.manaLeft - amount);
    this.cooldownMs = PRIEST_HEAL_INTERVAL_MS;
  }

  /** Co-op guest: the host's mana. */
  public set(mana: number): void {
    this.manaLeft = Math.max(0, Math.min(PRIEST_MANA_MAX, mana));
  }
}
