import { SURVIVAL, WAVES } from '../config';
import { ENEMY_KINDS } from '../data/enemyKinds';
import type { DifficultyLevel, WavePacing } from '../data/difficulty';
import type { EnemyType } from '../types';
import { groupByKind } from './waveDirector';

/**
 * A survival level's enemies (pure, tested): the setup names only the kinds and the time; this decides how many come.
 * A wave every SURVIVAL.waveEveryMs (sooner when the field is cleared), each bigger (`survivalWaveSize`), drawn from the
 * kinds whose `arrival` share of the time has passed (tougher kinds later and rarer), released with the difficulty's
 * pacing and never more than SURVIVAL.maxAlive standing. Nothing new in the last SURVIVAL.quietEndMs; `finished` once
 * the time is up. GameScene calls `update` every frame (so it pauses with the game) and spawns what it returns.
 */

/** Enemies in wave `index` (from 0) of level `levelIndex` at `difficulty`. */
export const survivalWaveSize = (index: number, levelIndex: number, difficulty: DifficultyLevel): number =>
  Math.max(1, Math.round((SURVIVAL.firstSize + SURVIVAL.growth * index) * SURVIVAL.levelGrowth ** levelIndex * SURVIVAL[`${difficulty}Scale`]));

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

/** `size` enemies of the arrived kinds, drawn by weight with `random` (0..1). */
export const drawWave = (kinds: readonly EnemyType[], size: number, random: () => number): EnemyType[] => {
  const total = kinds.reduce((sum, kind) => sum + kindWeight(kind), 0);
  return Array.from({ length: kinds.length > 0 ? size : 0 }, () => {
    let pick = random() * total;
    return kinds.find((kind) => (pick -= kindWeight(kind)) < 0) ?? kinds[kinds.length - 1];
  });
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
  private sinceWaveMs = 0;
  /** Drawn but not yet on the field. */
  private queue: EnemyType[] = [];
  private spawnTimerMs = 0;
  private spawnedInGroup = 0;
  private readonly random: () => number;

  public constructor(private readonly kinds: readonly EnemyType[], public readonly durationMs: number, private readonly options: SurvivalOptions) {
    this.waveTimerMs = SURVIVAL.startDelayMs;
    this.random = options.random ?? Math.random;
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
    this.sinceWaveMs += deltaMs;
    const quiet = this.remainingMs <= SURVIVAL.quietEndMs;
    // A cleared field doesn't wait out the whole gap.
    const cleared = alive === 0 && this.queue.length === 0 && this.waveIndex > 0 && this.sinceWaveMs >= WAVES.minGapMs * 2;
    if (!quiet && (this.waveTimerMs <= 0 || cleared)) {
      this.releaseWave();
    }
    return this.spawn(deltaMs, alive);
  }

  private releaseWave(): void {
    const kinds = kindsArrived(this.kinds, this.elapsedMs / this.durationMs);
    const wave = drawWave(kinds, survivalWaveSize(this.waveIndex, this.options.levelIndex, this.options.difficulty), this.random);
    this.queue.push(...(this.options.pacing.groupSize > 1 ? groupByKind(wave) : wave));
    this.waveIndex += 1;
    this.waveTimerMs = SURVIVAL.waveEveryMs;
    this.sinceWaveMs = 0;
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
