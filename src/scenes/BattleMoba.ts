import { MOBA_PLAYERS } from '../config';
import type { GameContext } from '../core/Scene';
import type { MinionRole, Team } from '../data/moba';
import type { DamageNumbers } from '../objects/DamageNumbers';
import type { BowmanHit } from '../systems/bowmanDeath';
import type { Foe } from '../systems/combatGeometry';
import { MobaEconomy, freshRecovery, noteHit, regenStep, type Recovery, type Victim } from '../systems/mobaEconomy';
import type { BattlePlayers } from './BattlePlayers';
import { playerStartX, type Player } from './PlayerControl';

export interface BattleMobaDeps {
  ctx: GameContext;
  team: BattlePlayers;
  teams: readonly Team[];
  popups(): DamageNumbers;
}

/**
 * MOBA players (`?moba`; the minions are scenes/BattleLanes.ts): gold for last hits (systems/mobaEconomy.ts, shown
 * rising over the victim to the player it is for), the team vaults, a fallen player's respawn at his keep after
 * MOBA_PLAYERS.respawnMs, and healing after a quiet spell. Runs on the host (or alone).
 */
export class BattleMoba {
  public readonly economy: MobaEconomy;
  private readonly recovery: Recovery[];
  /** Per player: the player who hit him last, and how (a burn after a fire arrow counts as the archer's kill). */
  private readonly lastHits: Array<BowmanHit | undefined>;

  public constructor(private readonly deps: BattleMobaDeps) {
    this.economy = new MobaEconomy(deps.teams);
    this.recovery = deps.teams.map(freshRecovery);
    this.lastHits = deps.teams.map(() => undefined);
  }

  /** Full health of `player` (the shop's Max HP raises it). */
  public maxHealth(_player: Player): number {
    return this.deps.ctx.session.sandbox.bowmanHealth;
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
        player.health = Math.min(this.maxHealth(player), player.health + regenStep(recovery, deltaMs));
      }
    });
  }

  /** The seconds until `player` is back (undefined while he stands). */
  public respawnIn(player: Player): number | undefined {
    const ms = this.recovery[player.index].respawnMs;
    return ms === undefined ? undefined : Math.ceil(ms / 1000);
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
  }

  /** `by` landed the last hit on `victim` at `at`: his purse changes, and he sees by how much there. */
  private reward(by: number | undefined, victim: Victim, at: { x: number; y: number }): void {
    if (by === undefined) {
      return;
    }
    const delta = this.economy.kill(by, victim);
    if (delta !== 0 && this.deps.team.list[by]?.local) {
      this.deps.popups().showGold(at, delta);
    }
  }
}
