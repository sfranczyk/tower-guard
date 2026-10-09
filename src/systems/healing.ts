import {
  PRIEST_FOLLOW_GAP,
  PRIEST_HEAL_INTERVAL_MS,
  PRIEST_HEAL_PER_TARGET,
  PRIEST_HEAL_RADIUS,
  PRIEST_MANA_MAX,
  PRIEST_MANA_RECOVER_SHARE,
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
 * Where the priest heads (x): PRIEST_FOLLOW_GAP behind the front soldier on its side of `targetX` (`soldiers`: their x;
 * the front one is the nearest the target, the bowman it goes for or the keep), but never nearer the target than
 * PRIEST_STANDOFF. So it stays with the fighting and only backs off as the target comes on. With soldiers left only
 * beyond the target it dashes past it (no standoff) to hide behind the nearest of them; with none it heads for
 * `retreatX`.
 */
export const priestPost = (priestX: number, soldiers: readonly number[], targetX: number, retreatX: number): number => {
  const side = Math.sign(priestX - targetX) || 1;
  const ours = soldiers.filter((x) => (Math.sign(x - targetX) || side) === side);
  const shelter = ours.length > 0 ? ours : soldiers;
  if (shelter.length === 0) {
    return retreatX;
  }
  const front = shelter.reduce((best, x) => (Math.abs(x - targetX) < Math.abs(best - targetX) ? x : best));
  const away = Math.sign(front - targetX) || side;
  const post = front + away * PRIEST_FOLLOW_GAP;
  return ours.length > 0 && Math.abs(post - targetX) < PRIEST_STANDOFF ? targetX + away * PRIEST_STANDOFF : post;
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

/**
 * The priest's mana and the pause between casts: it casts with at least PRIEST_MIN_CAST_MANA; dropping below that it is
 * drained and casts no more until the mana is back to PRIEST_MANA_RECOVER_SHARE of full.
 */
export class ManaPool {
  private manaLeft = PRIEST_MANA_MAX;
  private cooldownMs = 0;
  private drained = false;

  public get mana(): number {
    return this.manaLeft;
  }

  public get ratio(): number {
    return this.manaLeft / PRIEST_MANA_MAX;
  }

  /** Ran dry: no casting until the mana is back to PRIEST_MANA_RECOVER_SHARE (its bar dims meanwhile). */
  public get exhausted(): boolean {
    return this.drained;
  }

  /** Refills and runs the pause down. */
  public update(deltaMs: number): void {
    this.manaLeft = Math.min(PRIEST_MANA_MAX, this.manaLeft + (PRIEST_MANA_REGEN_PER_S * deltaMs) / 1000);
    this.cooldownMs = Math.max(0, this.cooldownMs - deltaMs);
    if (this.drained && this.manaLeft >= PRIEST_MANA_MAX * PRIEST_MANA_RECOVER_SHARE) {
      this.drained = false;
    }
  }

  /** The pause is over, not drained, and there's enough mana to be worth a cast. */
  public get canCast(): boolean {
    return this.cooldownMs === 0 && !this.drained && this.manaLeft >= PRIEST_MIN_CAST_MANA;
  }

  /** A cast spending `amount` mana; the next one waits PRIEST_HEAL_INTERVAL_MS. */
  public spend(amount: number): void {
    this.manaLeft = Math.max(0, this.manaLeft - amount);
    this.cooldownMs = PRIEST_HEAL_INTERVAL_MS;
    if (this.manaLeft < PRIEST_MIN_CAST_MANA) {
      this.drained = true;
    }
  }

  /** Co-op guest: the host's mana, and whether it is drained. */
  public set(mana: number, drained = false): void {
    this.manaLeft = Math.max(0, Math.min(PRIEST_MANA_MAX, mana));
    this.drained = drained;
  }
}
