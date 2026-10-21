import { SURVIVAL } from '../config';
import { ENEMY_KINDS, isBoss } from '../data/enemyKinds';
import type { DifficultyLevel, WavePacing } from '../data/difficulty';
import type { EnemyType } from '../types';
import { canLead, drawBossWave, drawByBudget, waveCost } from './survivalRoles';
import { groupByKind } from './waveDirector';

/**
 * A survival level's enemies (pure, tested): the setup names only the kinds and the time; this decides how many come.
 * Each wave has a threat budget (`survivalBudget`) growing up to the difficulty's peak wave, filled from the kinds
 * whose `arrival` share of the time has passed (tougher kinds later and rarer) around a lead kind (`pickLead`; a boss
 * leads a boss wave, systems/survivalRoles.ts). The next wave waits `survivalWaveGap` of what this one cost; clearing
 * the field brings it SURVIVAL.clearedDelayMs later. Released with the difficulty's pacing, never more than `maxAliveFor` standing.
 * Long levels end with a big finale wave SURVIVAL.finaleAtMs before the end (the wave just before it smaller). No
 * level sends anything new in the last SURVIVAL.quietEndMs (not even what is still queued). `finished` once the time is up. GameScene calls `update`
 * every frame (so it pauses with the game) and spawns what it returns.
 */

/** Extra share of the budget per bowman beyond the first (co-op). */
const coopFactor = (players: number): number => 1 + SURVIVAL.coopBudgetPerPlayer * Math.max(0, players - 1);

/** The threat budget of wave `index` (from 0) of level `levelIndex` at `difficulty` for `players`, × `factor` (jitter, finale). */
export const survivalBudget = (index: number, levelIndex: number, difficulty: DifficultyLevel, factor = 1, players = 1): number => {
  const base = Math.min(SURVIVAL[`${difficulty}MaxBudget`], SURVIVAL[`${difficulty}FirstBudget`] + SURVIVAL[`${difficulty}BudgetGrowth`] * index);
  const budget = base * SURVIVAL.levelGrowth ** levelIndex;
  return budget * coopFactor(players) * factor;
};

/** The wait after a wave that cost `budget`: gapBaseMs plus gapPerBudgetMs per point (bigger waves wait longer), within gapMinMs..gapMaxMs. */
export const survivalWaveGap = (budget: number): number =>
  Math.min(SURVIVAL.gapMaxMs, Math.max(SURVIVAL.gapMinMs, SURVIVAL.gapBaseMs + SURVIVAL.gapPerBudgetMs * budget));

/** Most enemies standing at once at `difficulty`: its `*MaxAlive` (0 = no limit), more in co-op. */
export const maxAliveFor = (difficulty: DifficultyLevel, players: number): number => {
  const cap = SURVIVAL[`${difficulty}MaxAlive`];
  return cap > 0 ? cap + SURVIVAL.coopAlivePerPlayer * Math.max(0, players - 1) : Infinity;
};

/** The kinds that may come `share` (0..1) of the way through the level: arrived ones, else the earliest. */
export const kindsArrived = (kinds: readonly EnemyType[], share: number): EnemyType[] => {
  const arrived = kinds.filter((kind) => ENEMY_KINDS[kind].arrival <= share);
  if (arrived.length > 0 || kinds.length === 0) {
    return arrived;
  }
  const first = Math.min(...kinds.map((kind) => ENEMY_KINDS[kind].arrival));
  return kinds.filter((kind) => ENEMY_KINDS[kind].arrival === first);
};

/**
 * A wave's lead kind: a kind that hasn't led yet (just arrived; the earliest first), else one drawn at random, never
 * `previous` when there is another; never a supporter (none if only supporters came), a boss only when `bossAllowed`.
 */
export const pickLead = (arrived: readonly EnemyType[], previous: EnemyType | undefined, led: ReadonlySet<EnemyType>, random: () => number, bossAllowed = true): EnemyType | undefined => {
  const all = arrived.filter(canLead);
  // Bosses only when allowed, unless nothing else came.
  const allowed = bossAllowed ? all : all.filter((kind) => !isBoss(kind));
  const kinds = allowed.length > 0 ? allowed : all;
  const fresh = kinds.filter((kind) => !led.has(kind)).sort((a, b) => ENEMY_KINDS[a].arrival - ENEMY_KINDS[b].arrival);
  if (fresh.length > 0) {
    return fresh[0];
  }
  const pool = kinds.length > 1 ? kinds.filter((kind) => kind !== previous) : kinds;
  return pool.length > 0 ? pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))] : undefined;
};

/** One by one (easy) the lead kind shouldn't all come first. */
const shuffle = (wave: EnemyType[], random: () => number): EnemyType[] => {
  for (let i = wave.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [wave[i], wave[j]] = [wave[j], wave[i]];
  }
  return wave;
};

export interface SurvivalOptions {
  levelIndex: number;
  difficulty: DifficultyLevel;
  pacing: WavePacing;
  /** Bowmen in the run (co-op: bigger waves, more on the field). */
  players?: number;
  random?: () => number;
}

export class SurvivalDirector {
  public elapsedMs = 0;
  private waveIndex = 0;
  /** Until the next wave is due. */
  private waveTimerMs: number;
  /** How long the field has stood empty since the last wave was out. */
  private clearedMs = 0;
  private lead?: EnemyType;
  private lastWasBoss = false;
  private readonly led = new Set<EnemyType>();
  /** Long levels end with a finale wave SURVIVAL.finaleAtMs before the end. */
  private readonly finaleAtMs?: number;
  private finaleSent = false;
  /** Drawn but not yet on the field. */
  private queue: EnemyType[] = [];
  private spawnTimerMs = 0;
  private spawnedInGroup = 0;
  private readonly random: () => number;
  private readonly players: number;

  public constructor(private readonly kinds: readonly EnemyType[], public readonly durationMs: number, private readonly options: SurvivalOptions) {
    this.waveTimerMs = SURVIVAL.startDelayMs;
    this.random = options.random ?? Math.random;
    this.players = Math.max(1, options.players ?? 1);
    if (durationMs > SURVIVAL.finaleMinMs) {
      this.finaleAtMs = durationMs - SURVIVAL.finaleAtMs;
    }
  }

  public get remainingMs(): number {
    return Math.max(0, this.durationMs - this.elapsedMs);
  }

  public get finished(): boolean {
    return this.elapsedMs >= this.durationMs;
  }

  /** Advances time; returns the enemies to spawn now. `alive` = enemies currently standing on the field. */
  public update(deltaMs: number, alive: number): EnemyType[] {
    if (this.finished) {
      return [];
    }
    this.elapsedMs += deltaMs;
    this.waveTimerMs -= deltaMs;
    // A cleared field doesn't wait out the whole gap.
    const empty = alive === 0 && this.queue.length === 0 && this.waveIndex > 0;
    this.clearedMs = empty ? this.clearedMs + deltaMs : 0;
    const cleared = this.clearedMs >= SURVIVAL.clearedDelayMs;
    if (this.finaleAtMs !== undefined && !this.finaleSent && this.elapsedMs >= this.finaleAtMs) {
      this.finaleSent = true;
      this.releaseWave(SURVIVAL.finaleScale);
    } else if (!this.quiet && (this.waveTimerMs <= 0 || cleared)) {
      // The wave whose wait would run past the finale is the smaller one before it.
      const preFinale = this.finaleAtMs !== undefined && !this.finaleSent && this.elapsedMs >= this.finaleAtMs - SURVIVAL.gapMaxMs;
      this.releaseWave(preFinale ? SURVIVAL.preFinaleScale : 1);
    }
    // Whatever is still queued stays out in the last quiet seconds.
    return this.quiet ? [] : this.spawn(deltaMs, alive);
  }

  /** No new waves in the last SURVIVAL.quietEndMs. */
  private get quiet(): boolean {
    return this.remainingMs <= SURVIVAL.quietEndMs;
  }

  private releaseWave(scale: number): void {
    const { levelIndex, difficulty } = this.options;
    const arrived = kindsArrived(this.kinds, this.elapsedMs / this.durationMs);
    // Supporters never come alone: while no fighter has arrived, the setup's fighters come now instead.
    const kinds = arrived.some(canLead) ? arrived : this.kinds.filter(canLead);
    const bossAllowed = this.waveIndex + 1 >= SURVIVAL.bossMinWave && !this.lastWasBoss;
    this.lead = pickLead(kinds, this.lead, this.led, this.random, bossAllowed);
    if (this.lead) {
      this.led.add(this.lead);
    }
    const jitter = 1 + (this.random() * 2 - 1) * SURVIVAL.sizeJitter;
    const budget = survivalBudget(this.waveIndex, levelIndex, difficulty, jitter * scale, this.players);
    let wave: EnemyType[];
    let gapBudget: number;
    if (this.lead && isBoss(this.lead)) {
      ({ wave, gapBudget } = drawBossWave(this.lead, kinds, budget, difficulty, this.random));
      this.lastWasBoss = true;
    } else {
      wave = drawByBudget(kinds.filter((kind) => !isBoss(kind)), budget, this.random, this.lead);
      gapBudget = waveCost(wave);
      this.lastWasBoss = false;
    }
    this.queue.push(...(this.options.pacing.groupSize > 1 ? groupByKind(wave) : shuffle(wave, this.random)));
    this.waveIndex += 1;
    this.waveTimerMs = survivalWaveGap(gapBudget);
    this.clearedMs = 0;
  }

  private spawn(deltaMs: number, alive: number): EnemyType[] {
    const spawned: EnemyType[] = [];
    this.spawnTimerMs -= deltaMs;
    const { groupSize, spawnIntervalMs, groupGapMs } = this.options.pacing;
    const maxAlive = maxAliveFor(this.options.difficulty, this.players);
    while (this.spawnTimerMs <= 0 && this.queue.length > 0 && alive + spawned.length < maxAlive) {
      spawned.push(this.queue.shift()!);
      this.spawnedInGroup = (this.spawnedInGroup + 1) % groupSize;
      this.spawnTimerMs += this.spawnedInGroup === 0 ? groupGapMs : spawnIntervalMs;
    }
    // Never banked: a released group starts with one unit, the next one a full interval later.
    this.spawnTimerMs = Math.max(this.spawnTimerMs, 0);
    return spawned;
  }
}
