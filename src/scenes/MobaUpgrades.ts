import { BOWMAN_WALK_SPEED } from '../config';
import type { GameContext } from '../core/Scene';
import type { MinionRole, Team } from '../data/moba';
import {
  blockedBy, minionLevel, minionPower, playerStats, upgradeById, upgradeCost, levelOf,
  type PlayerStats, type UpgradeDef, type UpgradeLevels,
} from '../data/upgrades';
import type { MobaEconomy } from '../systems/mobaEconomy';
import type { BattlePlayers } from './BattlePlayers';
import type { Player } from './PlayerControl';

export interface MobaUpgradesDeps {
  ctx: GameContext;
  team: BattlePlayers;
  economy: MobaEconomy;
  /** Something was bought: the HUD, the quiver and the shop redraw. */
  changed?(player: Player, def: UpgradeDef): void;
}

/**
 * MOBA's shop on the host (or alone): the levels each player and each team bought (data/upgrades.ts), paid from the
 * player's purse or the team vault, and what they do to the bowman (quiver, reloads, health, walking speed) and to the
 * minions sent from now on (`minionPower`, stars).
 */
export class MobaUpgrades {
  public readonly playerLevels: Array<Record<string, number>>;
  public readonly teamLevels: Record<Team, Record<string, number>> = { blue: {}, red: {} };

  public constructor(private readonly deps: MobaUpgradesDeps) {
    this.playerLevels = deps.team.list.map(() => ({}));
    deps.ctx.session.mobaLoadouts = deps.team.list.map((player) => [...this.stats(player).quiver]);
  }

  public stats(player: Player): PlayerStats {
    return playerStats(this.playerLevels[player.index]);
  }

  /** The levels `def` counts against for `player`: his own, or his team's. */
  public levelsFor(player: Player, def: UpgradeDef): UpgradeLevels {
    return def.scope === 'team' ? this.teamLevels[player.team] : this.playerLevels[player.index];
  }

  /** The gold that pays for `def`: his purse, or his team's vault. */
  public fundsFor(player: Player, def: UpgradeDef): number {
    const { economy } = this.deps;
    return def.scope === 'team' ? economy.vault[player.team] : economy.gold[player.index];
  }

  /** Why `player` can't buy `def`'s next level now (undefined: he can). */
  public blocked(player: Player, def: UpgradeDef): string | undefined {
    return blockedBy(def, this.levelsFor(player, def), this.fundsFor(player, def));
  }

  /** `player` buys the next level of `id`; the reason it failed, or undefined. */
  public buy(player: Player, id: string): string | undefined {
    const def = upgradeById(id);
    if (!def) {
      return 'Unknown';
    }
    const reason = this.blocked(player, def);
    if (reason) {
      return reason;
    }
    const levels = def.scope === 'team' ? this.teamLevels[player.team] : this.playerLevels[player.index];
    const cost = upgradeCost(def, levelOf(levels, id) + 1);
    const paid = def.scope === 'team' ? this.deps.economy.spendVault(player.team, cost) : this.deps.economy.spend(player.index, cost);
    if (!paid) {
      return 'Not enough gold';
    }
    const healthBefore = this.maxHealth(player);
    levels[id] = levelOf(levels, id) + 1;
    if (def.scope === 'player') {
      this.apply(player);
      // More health to have: he gets the difference at once.
      if (!player.bowman.isDead) {
        player.health += this.maxHealth(player) - healthBefore;
      }
    }
    this.deps.changed?.(player, def);
    return undefined;
  }

  /** Full health of `player`. */
  public maxHealth(player: Player): number {
    return Math.round(this.deps.ctx.session.sandbox.bowmanHealth * this.stats(player).maxHealth);
  }

  /** Extra health a healing tick gives `player`. */
  public regenBonus(player: Player): number {
    return this.stats(player).regenBonus;
  }

  /** × on the damage of `owner`'s arrows of `type` (undefined: as normal). */
  public arrowPower(owner: number, type: string): number | undefined {
    const levels = this.playerLevels[owner];
    return levels && type === 'normal' ? playerStats(levels).basicDamage : undefined;
  }

  /** The level of `team`'s `role` minions (1 = none bought). */
  public minionLevel(team: Team, role: MinionRole): number {
    return minionLevel(this.teamLevels[team], role);
  }

  public minionPower(team: Team, role: MinionRole): number {
    return minionPower(this.minionLevel(team, role));
  }

  /** The bowman as his levels make him: quiver, reloads, walking speed. */
  private apply(player: Player): void {
    const stats = this.stats(player);
    const loadouts = this.deps.ctx.session.mobaLoadouts;
    if (loadouts) {
      loadouts[player.index] = [...stats.quiver];
    }
    player.cooldowns.pace = stats.cooldown;
    player.bowman.movementSpeed = BOWMAN_WALK_SPEED * stats.speed;
  }
}
