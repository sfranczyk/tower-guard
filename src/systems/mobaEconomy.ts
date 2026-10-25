import { MOBA_PLAYERS } from '../config';
import type { MinionRole, Team } from '../data/moba';

/** What fell: one of a team's lane minions, or a player. */
export type Victim = { team: Team; minion: MinionRole } | { team: Team; player: number };

/**
 * MOBA gold (pure, tested): each player's purse and each team's vault. The last hit on an enemy minion or player pays
 * its reward (MOBA_PLAYERS `*Gold`); one on your own minion or a teammate costs half that reward (no more than you have),
 * or nothing with the room's ally penalty off. Players move gold to and from their team's vault in MOBA_VAULT_STEPS.
 */
export class MobaEconomy {
  public readonly gold: number[];
  public readonly vault: Record<Team, number> = { blue: 0, red: 0 };

  public constructor(private readonly teams: readonly Team[], startGold = 0) {
    this.gold = teams.map(() => startGold);
  }

  /** Player `killer` landed the last hit on `victim`: the change to his purse (0 for none), already applied. */
  public kill(killer: number, victim: Victim, allyPenalty = true): number {
    const team = this.teams[killer];
    if (team === undefined || ('player' in victim && victim.player === killer)) {
      return 0;
    }
    const reward = 'player' in victim ? MOBA_PLAYERS.playerGold : MOBA_PLAYERS[`${victim.minion}Gold`];
    const delta = victim.team !== team ? reward : allyPenalty ? -Math.min(this.gold[killer], Math.round(reward / 2)) : 0;
    this.gold[killer] += delta;
    return delta;
  }

  /** Player `index` earns `amount` outside a last hit (an eclipse's comet): the change to his purse. */
  public earn(index: number, amount: number): number {
    if (this.teams[index] === undefined || amount <= 0) {
      return 0;
    }
    this.gold[index] += amount;
    return amount;
  }

  /** Spends `cost` from player `index`'s purse if he has it. */
  public spend(index: number, cost: number): boolean {
    if (this.gold[index] < cost) {
      return false;
    }
    this.gold[index] -= cost;
    return true;
  }

  /** Spends `cost` from `team`'s vault if it holds it. */
  public spendVault(team: Team, cost: number): boolean {
    if (this.vault[team] < cost) {
      return false;
    }
    this.vault[team] -= cost;
    return true;
  }

  /** `step` gold (or what is left) from player `index`'s purse into his team's vault (`deposit`) or back. */
  public moveVault(index: number, deposit: boolean, step: number): void {
    const team = this.teams[index];
    const amount = Math.min(step, deposit ? this.gold[index] : this.vault[team]);
    this.gold[index] += deposit ? -amount : amount;
    this.vault[team] += deposit ? amount : -amount;
  }
}

/** A fallen player's wait and the out-of-combat healing (pure, tested). */
export interface Recovery {
  /** Until he is back (ms); undefined while he stands. */
  respawnMs?: number;
  /** Since his last hit (ms). */
  quietMs: number;
  /** Towards the next heal tick (ms). */
  tickMs: number;
}

export const freshRecovery = (): Recovery => ({ quietMs: 0, tickMs: 0 });

/**
 * One frame of a standing player's healing: after `regenDelayMs` without a hit, `amount` every `regenEveryMs`.
 * Returns the health to add this frame (0 most frames).
 */
export const regenStep = (recovery: Recovery, deltaMs: number, amount = MOBA_PLAYERS.regenAmount): number => {
  recovery.quietMs += deltaMs;
  if (recovery.quietMs < MOBA_PLAYERS.regenDelayMs) {
    recovery.tickMs = 0;
    return 0;
  }
  recovery.tickMs += deltaMs;
  if (recovery.tickMs < MOBA_PLAYERS.regenEveryMs) {
    return 0;
  }
  recovery.tickMs -= MOBA_PLAYERS.regenEveryMs;
  return amount;
};

/** Healing now: standing, hurt, and no hit for `regenDelayMs` (the HUD shows the regeneration icon). */
export const isRegenerating = (recovery: Recovery, health: number, maxHealth: number): boolean =>
  recovery.respawnMs === undefined && health > 0 && health < maxHealth && recovery.quietMs >= MOBA_PLAYERS.regenDelayMs;

/** He was hit: the healing waits again. */
export const noteHit = (recovery: Recovery): void => {
  recovery.quietMs = 0;
  recovery.tickMs = 0;
};
