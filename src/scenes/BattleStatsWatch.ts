import type { GameSession } from '../core/Scene';
import type { Team } from '../data/moba';
import { nameOf } from '../net/coopLink';
import { killerOf, type HitInfo } from '../objects/enemy/enemyTypes';
import type Tower from '../objects/Tower';
import { BattleStats, type KillCause, type LevelReport } from '../systems/battleStats';
import type { BowmanHit } from '../systems/bowmanDeath';
import type { Foe } from '../systems/combatGeometry';
import type { MobaEconomy } from '../systems/mobaEconomy';
import type { Player } from './PlayerControl';

export interface BattleStatsWatchDeps {
  session: GameSession;
  players: readonly Player[];
  /** Each side's units whose deaths count as kills: `red` the enemies (MOBA: red minions), `blue` the soldiers and blue dragons. */
  sides: Record<Team, () => readonly Foe[]>;
  playerTower: Tower;
  moba: boolean;
  economy?: () => MobaEconomy | undefined;
}

/**
 * Feeds the level's report (systems/battleStats.ts) on the host or alone: the scene hands it shots, hits and damage as they
 * happen, and each frame it looks for new deaths (killer: `lastHitBy`, cause: the last hit seen) and what the keep and the
 * bowmen lost. Only hits on the other side count (a player's arrow in a soldier is no kill).
 */
export class BattleStatsWatch {
  private readonly stats: BattleStats;
  /** Each unit's last hit, for what killed it. */
  private readonly lastCause = new WeakMap<Foe, KillCause>();
  private readonly counted = new WeakSet<Foe>();
  private readonly lastBowmanHit: Array<number | undefined>;
  private readonly health: number[];
  private keepHealth: number;

  public constructor(private readonly deps: BattleStatsWatchDeps) {
    this.stats = new BattleStats(deps.players.length);
    this.lastBowmanHit = deps.players.map(() => undefined);
    this.health = deps.players.map((player) => player.health);
    this.keepHealth = deps.playerTower.getHealth();
  }

  public shot(owner: number): void {
    this.stats.shot(owner);
  }

  public landed(owner: number): void {
    this.stats.hit(owner);
  }

  /** A unit of `side` is about to take `amount`. */
  public foeHurt(foe: Foe, side: Team, amount: number, hit?: HitInfo): void {
    if (!hit) {
      return;
    }
    this.lastCause.set(foe, hit.cause);
    const by = killerOf(hit, foe.lastHitBy);
    if (this.opposes(by, side)) {
      // Called before the hit lands: what it takes is no more than the health left (no overkill).
      this.stats.damage(by!, Math.min(amount, foe.currentHealth), hit.cause === 'headshot');
    }
  }

  /** A bowman lost `amount` to `hit` (MOBA: another player's damage, and whose kill he'd be). */
  public bowmanHit(player: Player, hit: BowmanHit, amount: number): void {
    const by = hit.by ?? (hit.cause === 'burn' || hit.cause === 'fall' ? this.lastBowmanHit[player.index] : undefined);
    this.lastBowmanHit[player.index] = by;
    if (this.opposes(by, player.team)) {
      this.stats.damage(by!, amount);
    }
  }

  public update(deltaMs: number): void {
    this.stats.tick(deltaMs);
    (['red', 'blue'] as const).forEach((side) => this.deps.sides[side]().forEach((foe) => this.sweep(foe, side)));
    this.deps.players.forEach((player, index) => {
      const lost = this.health[index] - player.health;
      if (lost > 0) {
        this.stats.hurt(index, lost);
        if (player.health <= 0 && this.health[index] > 0) {
          const killer = this.lastBowmanHit[index];
          this.stats.fell(index, this.opposes(killer, player.team) ? killer : undefined);
          this.lastBowmanHit[index] = undefined;
        }
      }
      this.health[index] = player.health;
    });
    const keep = this.deps.playerTower.getHealth();
    this.stats.keepHurt(this.keepHealth - keep);
    this.keepHealth = keep;
  }

  /** The level is decided: nothing more counts. */
  public stop(): void {
    this.stats.stop();
  }

  public report(local: number): LevelReport {
    const economy = this.deps.economy?.();
    if (economy) {
      this.stats.gold(economy.earned, economy.spent);
    }
    return {
      ...this.stats.snapshot(),
      names: this.deps.players.map((player) => nameOf(this.deps.session, player.index)),
      local,
      ...(this.deps.moba ? { teams: this.deps.players.map((player) => player.team) } : {}),
    };
  }

  /** A unit that just died: a kill for whoever hit it last (MOBA: only players' kills of the other team count). */
  private sweep(foe: Foe, side: Team): void {
    if (foe.isAlive() || this.counted.has(foe)) {
      return;
    }
    this.counted.add(foe);
    const cause = this.lastCause.get(foe);
    // Never hurt (a priest that slipped away): no kill.
    if (!cause) {
      return;
    }
    const by = foe.lastHitBy;
    const credited = this.opposes(by, side) ? by : undefined;
    if (side === 'blue' && credited === undefined) {
      return;
    }
    if (this.deps.moba && credited === undefined) {
      return;
    }
    const bowman = credited === undefined ? undefined : this.deps.players[credited]?.bowman;
    this.stats.kill(foe.kind, cause, credited, bowman ? Math.abs(bowman.x - foe.x) : 0);
  }

  /** Whether player `by` is on the other side from `side` (none: no). */
  private opposes(by: number | undefined, side: Team): boolean {
    const player = by === undefined ? undefined : this.deps.players[by];
    return player !== undefined && player.team !== side;
  }
}
