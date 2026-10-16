import { ALLIES } from '../config';
import type { AllyType } from '../types';

/**
 * Who may be summoned now (pure, tested): at most `ALLIES.<type>Limit` of each kind standing at once (a fallen one
 * frees his place) and, after each summons, `ALLIES.<type>CooldownMs` before the next of that kind. The cooldowns run
 * with the game (`tick` from the scene's update), so they wait while it is paused. Limits and pauses are read when used,
 * so the tuning panel changes them live.
 */

export const allyLimit = (type: AllyType): number => ALLIES[`${type}Limit`];
export const allyCooldownMs = (type: AllyType): number => ALLIES[`${type}CooldownMs`];

/** One slot of the HUD: how many stand of how many allowed, and the share of its pause still to run (0 = ready). */
export interface AllySlotState {
  type: AllyType;
  alive: number;
  limit: number;
  cooldown: number;
}

export class AllyRoster {
  private readonly waitMs = new Map<AllyType, number>();

  /** Runs the pauses down. */
  public tick(deltaMs: number): void {
    this.waitMs.forEach((left, type) => this.waitMs.set(type, Math.max(0, left - deltaMs)));
  }

  /** Room for one more `type` (with `alive` of them standing) and its pause over. */
  public canSummon(type: AllyType, alive: number): boolean {
    return alive < allyLimit(type) && (this.waitMs.get(type) ?? 0) <= 0;
  }

  /** One `type` was just summoned: its pause starts. */
  public summoned(type: AllyType): void {
    this.waitMs.set(type, allyCooldownMs(type));
  }

  public slot(type: AllyType, alive: number): AllySlotState {
    const full = allyCooldownMs(type);
    return { type, alive, limit: allyLimit(type), cooldown: full > 0 ? Math.min(1, (this.waitMs.get(type) ?? 0) / full) : 0 };
  }
}
