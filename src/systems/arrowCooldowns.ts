import { ARROW_CHARGES, ARROW_COOLDOWN } from '../config';
import type { ArrowType } from '../data/loadout';

/**
 * One player's arrow charges: each type holds up to ARROW_CHARGES[type] shots, a shot spends one, and the missing
 * ones come back one at a time, ARROW_COOLDOWN[type] seconds each (both read live, so `?tune` changes apply).
 * Ticks with the battle (stops while paused).
 */
export class ArrowCooldowns {
  /** Types short of shots: how many are spent and how long until the next one is back. */
  private readonly spent = new Map<ArrowType, { count: number; ms: number }>();
  /** × on a type's reload (MOBA: a bought quick draw). */
  public pace: Partial<Record<ArrowType, number>> = {};

  private reloadMs(type: ArrowType): number {
    return ARROW_COOLDOWN[type] * 1000 * (this.pace[type] ?? 1);
  }

  public tick(deltaMs: number): void {
    this.spent.forEach((entry, type) => {
      entry.ms -= deltaMs;
      while (entry.ms <= 0 && entry.count > 0) {
        entry.count -= 1;
        entry.ms += this.reloadMs(type);
      }
      if (entry.count <= 0) {
        this.spent.delete(type);
      }
    });
  }

  public max(type: ArrowType): number {
    return Math.max(1, Math.round(ARROW_CHARGES[type]));
  }

  /** Shots ready now. */
  public charges(type: ArrowType): number {
    return Math.max(0, this.max(type) - (this.spent.get(type)?.count ?? 0));
  }

  /** A shot ready, or the next one at most `slackMs` away. */
  public ready(type: ArrowType, slackMs = 0): boolean {
    return this.charges(type) > 0 || (this.spent.get(type)?.ms ?? 0) <= slackMs;
  }

  /** Spends a shot (a shot let through on slack spends the one coming back). */
  public spend(type: ArrowType): void {
    const total = this.reloadMs(type);
    if (total <= 0) {
      return;
    }
    const entry = this.spent.get(type);
    if (!entry) {
      this.spent.set(type, { count: 1, ms: total });
    } else if (entry.count < this.max(type)) {
      entry.count += 1;
    } else {
      // On slack: the shot coming back is used up at once, the next one starts.
      entry.ms += total;
    }
  }

  /** Share of the wait for the next shot still to go (1 just after it was spent, 0 when all are back). */
  public remaining(type: ArrowType): number {
    const entry = this.spent.get(type);
    return entry ? Math.min(1, entry.ms / this.reloadMs(type)) : 0;
  }
}
