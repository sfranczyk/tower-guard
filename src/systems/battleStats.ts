import { REPORT } from '../config';
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

/** One point of the level's timeline (every REPORT.sampleMs, thinned out on long levels). */
export interface StatsSample {
  /** Seconds into the level. */
  t: number;
  /** Enemies standing (MOBA: the red minions). */
  alive: number;
  /** Our (blue) keep's health, 0–100. */
  keep: number;
  /** The enemy (red) keep's, 0–100 (none in survival). */
  enemyKeep?: number;
  /** MOBA: gold earned so far by the blue team and the red one. */
  gold?: [number, number];
}

/** Each arrow type's shots and hits, all players together. */
export type ArrowTally = Record<string, { shots: number; hits: number }>;

/** What a level's report holds (host or solo; the co-op guest gets it in the `end` message). */
export interface LevelStats {
  durationMs: number;
  timeline: StatsSample[];
  /** Seconds into the level when each wave began coming. */
  waves: number[];
  arrows: ArrowTally;
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
  /** Survival: the level's full length (s), where dawn comes. */
  levelSeconds?: number;
  /** The last level of a run of several: each level's line (the Run tab). */
  run?: RunLevel[];
}

/** One level of the run, as the Run tab lists it. */
export interface RunLevel {
  place: string;
  won: boolean;
  durationMs: number;
  kills: number;
  shots: number;
  hits: number;
  keepDamage: number;
}

/** A level's line in the Run tab. */
export const runLevel = (stats: LevelStats, place: string, won: boolean): RunLevel => {
  const total = teamTotals(stats.players);
  return { place, won, durationMs: stats.durationMs, kills: total.kills, shots: total.shots, hits: total.hits, keepDamage: stats.keepDamage };
};

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
  private readonly arrows: ArrowTally = {};
  private readonly waves: number[] = [];
  private timeline: StatsSample[] = [];
  private sampleMs: number = REPORT.sampleMs;
  private nextSampleMs = 0;
  private stopped = false;

  public constructor(playerCount: number) {
    this.players = Array.from({ length: playerCount }, freshPlayer);
  }

  /** Time goes on; `sample` reads the battle when a timeline point is due. */
  public tick(deltaMs: number, sample?: () => Omit<StatsSample, 't'>): void {
    if (this.stopped) {
      return;
    }
    if (sample && this.durationMs >= this.nextSampleMs) {
      this.record(sample());
      this.nextSampleMs += this.sampleMs;
    }
    this.durationMs += deltaMs;
  }

  /** The level is decided: `final` is the timeline's last point; nothing counts after it. */
  public stop(final?: Omit<StatsSample, 't'>): void {
    if (!this.stopped && final) {
      this.record(final);
    }
    this.stopped = true;
  }

  /** A wave began coming. */
  public wave(): void {
    if (!this.stopped) {
      this.waves.push(Math.round(this.durationMs / 1000));
    }
  }

  public shot(player: number, type = 'normal'): void {
    if (!this.stopped && this.players[player]) {
      this.add(player, 'shots', 1);
      this.arrowTally(type).shots += 1;
    }
  }

  /** One of `player`'s arrows (of `type`) hit its first target. */
  public hit(player: number, type = 'normal'): void {
    if (!this.stopped && this.players[player]) {
      this.add(player, 'hits', 1);
      this.arrowTally(type).hits += 1;
    }
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
      timeline: this.timeline.map((sample) => ({ ...sample })),
      waves: [...this.waves],
      arrows: Object.fromEntries(Object.entries(this.arrows).map(([type, tally]) => [type, { ...tally }])),
      players: this.players.map((player) => ({ ...player, damage: Math.round(player.damage), damageTaken: Math.round(player.damageTaken), longestKill: Math.round(player.longestKill) })),
      keepDamage: Math.round(this.keepDamage),
      killsByType: { ...this.killsByType },
      killsByCause: { ...this.killsByCause },
    };
  }

  private arrowTally(type: string): { shots: number; hits: number } {
    this.arrows[type] ??= { shots: 0, hits: 0 };
    return this.arrows[type];
  }

  /** A timeline point (rounded, to keep the `end` message small); past REPORT.maxSamples every other one goes. */
  private record(sample: Omit<StatsSample, 't'>): void {
    this.timeline.push({
      t: Math.round(this.durationMs / 1000),
      alive: sample.alive,
      keep: Math.round(sample.keep),
      ...(sample.enemyKeep === undefined ? {} : { enemyKeep: Math.round(sample.enemyKeep) }),
      ...(sample.gold ? { gold: [Math.round(sample.gold[0]), Math.round(sample.gold[1])] as [number, number] } : {}),
    });
    if (this.timeline.length > REPORT.maxSamples) {
      this.timeline = this.timeline.filter((_, index) => index % 2 === 0 || index === this.timeline.length - 1);
      this.sampleMs *= 2;
    }
  }

  private add(player: number, key: keyof PlayerStats, amount: number): void {
    if (!this.stopped && this.players[player] && amount > 0) {
      this.players[player][key] += amount;
    }
  }
}
