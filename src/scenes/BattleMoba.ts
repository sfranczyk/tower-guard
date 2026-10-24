import { MOBA_PLAYERS, MOBA_VAULT_STEPS } from '../config';
import type { GameContext } from '../core/Scene';
import type { MinionRole, Team } from '../data/moba';
import type { ShopFunds } from '../data/shopView';
import type { DamageNumbers } from '../objects/DamageNumbers';
import type { BowmanHit } from '../systems/bowmanDeath';
import type { Foe } from '../systems/combatGeometry';
import { MobaEconomy, freshRecovery, isRegenerating, noteHit, regenStep, type Recovery, type Victim } from '../systems/mobaEconomy';
import type { BattlePlayers } from './BattlePlayers';
import { MobaUpgrades } from './MobaUpgrades';
import { playerStartX, type Player } from './PlayerControl';

export interface BattleMobaDeps {
  ctx: GameContext;
  team: BattlePlayers;
  teams: readonly Team[];
  popups(): DamageNumbers;
  /** `player` bought something or moved vault gold: his HUD, quiver and shop redraw. */
  changed?(player: Player): void;
  /** Co-op host: a guest's gold popup (`by` is not this browser's player). */
  goldShown?(by: number, at: { x: number; y: number }, delta: number): void;
  /** Co-op host: `player` is back at his keep. */
  revived?(player: Player): void;
}

/**
 * MOBA players (`?moba`; the minions are scenes/BattleLanes.ts): gold for last hits (systems/mobaEconomy.ts, shown
 * rising over the victim to the player it is for), the team vaults, a fallen player's respawn at his keep after
 * MOBA_PLAYERS.respawnMs, and healing after a quiet spell. Runs on the host (or alone).
 */
export class BattleMoba {
  public readonly economy: MobaEconomy;
  public readonly upgrades: MobaUpgrades;
  private readonly recovery: Recovery[];
  /** Per player: the player who hit him last, and how (a burn after a fire arrow counts as the archer's kill). */
  private readonly lastHits: Array<BowmanHit | undefined>;

  public constructor(private readonly deps: BattleMobaDeps) {
    this.economy = new MobaEconomy(deps.teams);
    this.upgrades = new MobaUpgrades({ ctx: deps.ctx, team: deps.team, economy: this.economy, changed: (player) => deps.changed?.(player) });
    this.recovery = deps.teams.map(freshRecovery);
    this.lastHits = deps.teams.map(() => undefined);
  }

  /** Full health of `player` (the shop's Max HP raises it). */
  public maxHealth(player: Player): number {
    return this.upgrades.maxHealth(player);
  }

  /** A lane minion of `team` just came: its last hit pays the player who lands it. */
  public watch(unit: Foe, team: Team, minion: MinionRole): void {
    unit.onKilled = (by) => this.reward(by, { team, minion }, { x: unit.x, y: unit.y - (unit.isFlying ? 0 : 50 * unit.size) });
  }

  /** `player` was hit: his healing waits again, and the hit is his last (whose kill it is if it kills him). */
  public bowmanHit(player: Player, hit: BowmanHit): void {
    noteHit(this.recovery[player.index]);
    const last = this.lastHits[player.index];
    this.lastHits[player.index] = { ...hit, by: hit.by ?? (hit.cause === 'burn' || hit.cause === 'fall' ? last?.by : undefined) };
  }

  /** The players at 0 fall, their killer is paid, and their respawn wait starts. */
  public handleFallen(): void {
    const { team } = this.deps;
    team.list.filter((player) => player.health <= 0 && !player.bowman.isDead).forEach((fallen) => {
      team.fall(fallen);
      const killer = this.lastHits[fallen.index]?.by;
      this.reward(killer, { team: fallen.team, player: fallen.index }, { x: fallen.bowman.x, y: fallen.bowman.y - 70 });
      this.recovery[fallen.index].respawnMs = MOBA_PLAYERS.respawnMs;
      this.lastHits[fallen.index] = undefined;
      team.list.filter((player) => player !== fallen).forEach((player) => {
        team.status(player, `${fallen.team === player.team ? 'Your teammate' : 'An enemy'} has fallen`);
      });
    });
  }

  /** Respawn waits and healing. */
  public update(deltaMs: number): void {
    this.deps.team.list.forEach((player) => {
      const recovery = this.recovery[player.index];
      if (recovery.respawnMs !== undefined) {
        const before = Math.ceil(recovery.respawnMs / 1000);
        recovery.respawnMs -= deltaMs;
        const left = Math.ceil(recovery.respawnMs / 1000);
        if (recovery.respawnMs <= 0) {
          this.respawn(player);
        } else if (left !== before) {
          this.deps.team.status(player, `You have fallen · back at your keep in ${left} s`);
        }
        return;
      }
      if (!player.bowman.isDead) {
        player.health = Math.min(this.maxHealth(player), player.health + regenStep(recovery, deltaMs, MOBA_PLAYERS.regenAmount + this.upgrades.regenBonus(player)));
      }
    });
  }

  /** `player` is healing now (out of combat and hurt). */
  public regenerating(player: Player): boolean {
    return !player.bowman.isDead && isRegenerating(this.recovery[player.index], player.health, this.maxHealth(player));
  }

  /** The seconds until `player` is back (undefined while he stands). */
  public respawnIn(player: Player): number | undefined {
    const ms = this.recovery[player.index].respawnMs;
    return ms === undefined ? undefined : Math.ceil(ms / 1000);
  }

  /** What `player` has for the shop: his levels and purse, his team's levels and vault. */
  public shopFunds(player: Player): ShopFunds {
    return {
      player: { levels: this.upgrades.playerLevels[player.index], gold: this.economy.gold[player.index] },
      team: { levels: this.upgrades.teamLevels[player.team], gold: this.economy.vault[player.team] },
    };
  }

  /** `player` buys the next level of upgrade `id`: why not, or undefined when bought. */
  public buy(player: Player, id: string): string | undefined {
    return this.upgrades.buy(player, id);
  }

  /** `player` puts `step` of his gold in his team's vault, or takes it out (only the shop's MOBA_VAULT_STEPS). */
  public moveVault(player: Player, deposit: boolean, step: number): void {
    if (!MOBA_VAULT_STEPS.includes(step)) {
      return;
    }
    this.economy.moveVault(player.index, deposit, step);
    this.deps.changed?.(player);
  }

  /** The HUD's purse line for this browser's player. */
  public purse(player: Player): { team: Team; gold: number; vault: number } {
    return { team: player.team, gold: this.economy.gold[player.index], vault: this.economy.vault[player.team] };
  }

  private respawn(player: Player): void {
    const recovery = this.recovery[player.index];
    recovery.respawnMs = undefined;
    noteHit(recovery);
    player.health = this.maxHealth(player);
    player.bowman.revive(playerStartX(player.slot, player.team));
    player.bowman.figure.facing = player.team === 'red' ? -1 : 1;
    this.deps.team.status(player, 'Back in the fight');
    this.deps.revived?.(player);
  }

  /** `by` landed the last hit on `victim` at `at`: his purse changes, and he sees by how much there. */
  private reward(by: number | undefined, victim: Victim, at: { x: number; y: number }): void {
    if (by === undefined) {
      return;
    }
    const delta = this.economy.kill(by, victim);
    if (delta === 0) {
      return;
    }
    if (this.deps.team.list[by]?.local) {
      this.deps.popups().showGold(at, delta);
    } else {
      this.deps.goldShown?.(by, at, delta);
    }
  }
}
