import type { Team } from '../data/moba';
import type { HitInfo } from '../objects/enemy/enemyTypes';

export type KillCause = HitInfo['cause'];

/** One player's level, as the end screen's report shows it. */
export interface PlayerStats {
  /** Arrows loosed (shrapnel fragments not counted). */
  shots: number;
  /** Arrows that hit someone or the enemy keep (each arrow once, however many it went through). */
  hits: number;
  headshots: number;
  /** Enemies (MOBA: the other team's minions) whose last hit was this player's. */
  kills: number;
  /** Damage this player's arrows, blasts and burns did to the other side. */
  damage: number;
  /** The longest kill: world px between the bowman and the one he killed. */
  longestKill: number;
  damageTaken: number;
  deaths: number;
  /** MOBA: the other team's players whose last hit was this player's. */
  playerKills: number;
  /** MOBA: gold earned (last hits, the comet) and spent in the shop. */
  goldEarned: number;
  goldSpent: number;
}

/** What a level's report holds (host or solo; the co-op guest gets it in the `end` message). */
export interface LevelStats {
  durationMs: number;
  players: PlayerStats[];
  /** Damage the (blue) keep took. */
  keepDamage: number;
  /** Every enemy down (MOBA: only players' kills), by its kind and by what killed it. */
  killsByType: Record<string, number>;
  killsByCause: Partial<Record<KillCause, number>>;
}

/** The report with each player's name (the end card shows it as it comes). */
export interface LevelReport extends LevelStats {
  names: string[];
  /** Which of the players this browser is (their column is marked). */
  local?: number;
  /** MOBA: each player's team. */
  teams?: Team[];
}

const freshPlayer = (): PlayerStats => ({
  shots: 0, hits: 0, headshots: 0, kills: 0, damage: 0, longestKill: 0, damageTaken: 0, deaths: 0, playerKills: 0, goldEarned: 0, goldSpent: 0,
});

/** Share of shots that hit, in whole percent (0 with no shots). */
export const accuracy = (player: Pick<PlayerStats, 'shots' | 'hits'>): number => (player.shots > 0 ? Math.round((100 * player.hits) / player.shots) : 0);

/** The whole team's numbers (one player alone: his own). */
export const teamTotals = (players: readonly PlayerStats[]): PlayerStats => players.reduce((sum, player) => ({
  shots: sum.shots + player.shots,
  hits: sum.hits + player.hits,
  headshots: sum.headshots + player.headshots,
  kills: sum.kills + player.kills,
  damage: sum.damage + player.damage,
  longestKill: Math.max(sum.longestKill, player.longestKill),
  damageTaken: sum.damageTaken + player.damageTaken,
  deaths: sum.deaths + player.deaths,
  playerKills: sum.playerKills + player.playerKills,
  goldEarned: sum.goldEarned + player.goldEarned,
  goldSpent: sum.goldSpent + player.goldSpent,
}), freshPlayer());

/**
 * Counts a level as it is played (pure, tested): each player's shots, hits, kills and damage, what the keep took, and
 * every kill by kind and cause. The scene feeds it (scenes/BattleStatsWatch.ts); `stop` freezes it when the level is
 * decided, so what happens behind the end screen doesn't count.
 */
export class BattleStats {
  private readonly players: PlayerStats[];
  private durationMs = 0;
  private keepDamage = 0;
  private readonly killsByType: Record<string, number> = {};
  private readonly killsByCause: Partial<Record<KillCause, number>> = {};
  private stopped = false;

  public constructor(playerCount: number) {
    this.players = Array.from({ length: playerCount }, freshPlayer);
  }

  public tick(deltaMs: number): void {
    if (!this.stopped) {
      this.durationMs += deltaMs;
    }
  }

  public stop(): void {
    this.stopped = true;
  }

  public shot(player: number): void {
    this.add(player, 'shots', 1);
  }

  /** One of `player`'s arrows hit its first target. */
  public hit(player: number): void {
    this.add(player, 'hits', 1);
  }

  public damage(player: number, amount: number, headshot = false): void {
    this.add(player, 'damage', amount);
    if (headshot) {
      this.add(player, 'headshots', 1);
    }
  }

  /** An enemy of `kind` went down to `cause`; `player` landed the last hit from `distance` px (none: a soldier, the weather…). */
  public kill(kind: string, cause: KillCause, player?: number, distance = 0): void {
    if (this.stopped) {
      return;
    }
    this.killsByType[kind] = (this.killsByType[kind] ?? 0) + 1;
    this.killsByCause[cause] = (this.killsByCause[cause] ?? 0) + 1;
    if (player !== undefined && this.players[player]) {
      this.players[player].kills += 1;
      this.players[player].longestKill = Math.max(this.players[player].longestKill, distance);
    }
  }

  public hurt(player: number, amount: number): void {
    this.add(player, 'damageTaken', amount);
  }

  /** `player` fell; `killer`: the other team's player whose hit it was (MOBA). */
  public fell(player: number, killer?: number): void {
    this.add(player, 'deaths', 1);
    if (killer !== undefined) {
      this.add(killer, 'playerKills', 1);
    }
  }

  public keepHurt(amount: number): void {
    if (!this.stopped) {
      this.keepDamage += amount;
    }
  }

  /** MOBA: what each player earned and spent (kept by the economy, read once at the end). */
  public gold(earned: readonly number[], spent: readonly number[]): void {
    this.players.forEach((player, index) => {
      player.goldEarned = earned[index] ?? 0;
      player.goldSpent = spent[index] ?? 0;
    });
  }

  /** A copy of what was counted (safe to send). */
  public snapshot(): LevelStats {
    return {
      durationMs: Math.round(this.durationMs),
      players: this.players.map((player) => ({ ...player, damage: Math.round(player.damage), damageTaken: Math.round(player.damageTaken), longestKill: Math.round(player.longestKill) })),
      keepDamage: Math.round(this.keepDamage),
      killsByType: { ...this.killsByType },
      killsByCause: { ...this.killsByCause },
    };
  }

  private add(player: number, key: keyof PlayerStats, amount: number): void {
    if (!this.stopped && this.players[player] && amount > 0) {
      this.players[player][key] += amount;
    }
  }
}
