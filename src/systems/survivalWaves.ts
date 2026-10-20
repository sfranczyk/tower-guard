import { SURVIVAL } from '../config';
import { ENEMY_KINDS, enemyArchetype } from '../data/enemyKinds';
import type { DifficultyLevel, WavePacing } from '../data/difficulty';
import type { EnemyType } from '../types';
import { groupByKind } from './waveDirector';

/**
 * A survival level's enemies (pure, tested): the setup names only the kinds and the time; this decides how many come.
 * A wave every SURVIVAL.waveEveryMs (or SURVIVAL.clearedDelayMs after the field is cleared), growing up to the
 * difficulty's peak wave and then about that size (`survivalWaveSize`, ± SURVIVAL.sizeJitter), drawn from the kinds
 * whose `arrival` share of the time has passed (tougher kinds later and rarer) around a lead kind (`pickLead`), released
 * with the difficulty's pacing and never more than SURVIVAL.maxAlive standing. Long levels end with a big finale wave
 * SURVIVAL.finaleAtMs before the end (the waves just before it smaller) and nothing after it; short ones send nothing
 * new in the last SURVIVAL.quietEndMs. `finished` once the time is up. GameScene calls `update` every frame (so it pauses with the game) and spawns what it returns.
 */

/** Enemies in wave `index` (from 0) of level `levelIndex` at `difficulty`, × `factor` (jitter, finale). */
export const survivalWaveSize = (index: number, levelIndex: number, difficulty: DifficultyLevel, factor = 1): number => {
  const grown = Math.min(index, SURVIVAL[`${difficulty}PeakWave`] - 1);
  const size = (SURVIVAL.firstSize + SURVIVAL.growth * grown) * SURVIVAL.levelGrowth ** levelIndex * SURVIVAL[`${difficulty}Scale`];
  return Math.max(1, Math.round(size * factor));
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

/** A kind's share of a wave: tougher (later-arriving) kinds come less often. */
const kindWeight = (kind: EnemyType): number => 1 - 0.6 * ENEMY_KINDS[kind].arrival;

/**
 * `size` enemies of the arrived kinds, drawn by weight with `random` (0..1); with a `lead` kind, SURVIVAL.leadShare
 * of them are that kind.
 */
export const drawWave = (kinds: readonly EnemyType[], size: number, random: () => number, lead?: EnemyType): EnemyType[] => {
  if (kinds.length === 0) {
    return [];
  }
  const leading = lead ? Math.min(size, Math.round(size * SURVIVAL.leadShare)) : 0;
  const total = kinds.reduce((sum, kind) => sum + kindWeight(kind), 0);
  const rest = Array.from({ length: size - leading }, () => {
    let pick = random() * total;
    return kinds.find((kind) => (pick -= kindWeight(kind)) < 0) ?? kinds[kinds.length - 1];
  });
  return [...Array<EnemyType>(leading).fill(lead!), ...rest];
};

/** Supporters (healers, shamans) only back the others up: a wave of them alone makes no sense. */
const canLead = (kind: EnemyType): boolean => !enemyArchetype(kind).heals && !enemyArchetype(kind).buffs;

/**
 * A wave's lead kind: a kind that hasn't led yet (just arrived; the earliest first), else one drawn by weight, never
 * `previous` when there is another; never a supporter (none if only supporters came).
 */
export const pickLead = (arrived: readonly EnemyType[], previous: EnemyType | undefined, led: ReadonlySet<EnemyType>, random: () => number): EnemyType | undefined => {
  const kinds = arrived.filter(canLead);
  const fresh = kinds.filter((kind) => !led.has(kind)).sort((a, b) => ENEMY_KINDS[a].arrival - ENEMY_KINDS[b].arrival);
  if (fresh.length > 0) {
    return fresh[0];
  }
  const pool = kinds.length > 1 ? kinds.filter((kind) => kind !== previous) : kinds;
  return drawWave(pool, 1, random)[0];
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
  private readonly led = new Set<EnemyType>();
  /** Long levels end with a finale wave SURVIVAL.finaleAtMs before the end. */
  private readonly finaleAtMs?: number;
  private finaleSent = false;
  /** Drawn but not yet on the field. */
  private queue: EnemyType[] = [];
  private spawnTimerMs = 0;
  private spawnedInGroup = 0;
  private readonly random: () => number;

  public constructor(private readonly kinds: readonly EnemyType[], public readonly durationMs: number, private readonly options: SurvivalOptions) {
    this.waveTimerMs = SURVIVAL.startDelayMs;
    this.random = options.random ?? Math.random;
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
    if (this.finaleAtMs !== undefined && !this.finaleSent && this.elapsedMs >= this.finaleAtMs) {
      this.finaleSent = true;
      this.releaseWave(SURVIVAL.finaleScale);
    } else if (!this.quiet && (this.waveTimerMs <= 0 || this.clearedMs >= SURVIVAL.clearedDelayMs)) {
      const preFinale = this.finaleAtMs !== undefined && this.elapsedMs >= this.finaleAtMs - SURVIVAL.waveEveryMs;
      this.releaseWave(preFinale ? SURVIVAL.preFinaleScale : 1);
    }
    return this.spawn(deltaMs, alive);
  }

  /** No new waves: after the finale, or (short levels) in the last SURVIVAL.quietEndMs. */
  private get quiet(): boolean {
    return this.finaleAtMs !== undefined ? this.finaleSent : this.remainingMs <= SURVIVAL.quietEndMs;
  }

  private releaseWave(scale: number): void {
    const kinds = kindsArrived(this.kinds, this.elapsedMs / this.durationMs);
    this.lead = pickLead(kinds, this.lead, this.led, this.random);
    if (this.lead) {
      this.led.add(this.lead);
    }
    const jitter = 1 + (this.random() * 2 - 1) * SURVIVAL.sizeJitter;
    const size = survivalWaveSize(this.waveIndex, this.options.levelIndex, this.options.difficulty, jitter * scale);
    const wave = drawWave(kinds, size, this.random, this.lead);
    this.queue.push(...(this.options.pacing.groupSize > 1 ? groupByKind(wave) : shuffle(wave, this.random)));
    this.waveIndex += 1;
    this.waveTimerMs = SURVIVAL.waveEveryMs;
    this.clearedMs = 0;
  }

  private spawn(deltaMs: number, alive: number): EnemyType[] {
    const spawned: EnemyType[] = [];
    this.spawnTimerMs -= deltaMs;
    const { groupSize, spawnIntervalMs, groupGapMs } = this.options.pacing;
    while (this.spawnTimerMs <= 0 && this.queue.length > 0 && alive + spawned.length < SURVIVAL.maxAlive) {
      spawned.push(this.queue.shift()!);
      this.spawnedInGroup = (this.spawnedInGroup + 1) % groupSize;
      this.spawnTimerMs += this.spawnedInGroup === 0 ? groupGapMs : spawnIntervalMs;
    }
    this.spawnTimerMs = Math.max(this.spawnTimerMs, -spawnIntervalMs);
    return spawned;
  }
}
