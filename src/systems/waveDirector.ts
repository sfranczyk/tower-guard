import {
  FIRST_WAVE_SIZE,
  LEVEL_START_DELAY_MS,
  MAX_WAVE_SIZE,
  WAVE_MAX_GAP_MS,
  WAVE_MIN_GAP_MS,
  WAVE_RELEASE_ALIVE,
  WAVE_SIZE_STEP,
  WAVE_SPAWN_INTERVAL_MS,
} from '../config';
import { ENEMY_KINDS, ENEMY_TYPES } from '../data/enemyKinds';
import type { LevelEnemyCounts } from '../data/sandbox';
import type { EnemyType } from '../types';

/**
 * Splits a level's enemies into waves and releases them at sensible moments (pure; GameScene calls `update`
 * every frame and spawns what it returns). Waves grow from FIRST_WAVE_SIZE by WAVE_SIZE_STEP up to MAX_WAVE_SIZE; each
 * type is spread through the level, tougher types starting later, so early waves are light.
 */

/** Where in the level (0..1) each type starts to appear (its `arrival`): fighters first, brutes and dragons later. */
const TYPE_START = (type: EnemyType): number => ENEMY_KINDS[type].arrival;
/** In order of arrival (ties in a wave go to the earlier one). */
const TYPES = [...ENEMY_TYPES].sort((a, b) => TYPE_START(a) - TYPE_START(b));

/** Every enemy of the level in spawn order, cut into waves. */
export const planWaves = (enemies: LevelEnemyCounts): EnemyType[][] => {
  const order = TYPES.flatMap((type) => Array.from({ length: Math.max(0, enemies[type]) }, (_, index) => {
    const start = TYPE_START(type);
    return { type, at: start + (1 - start) * ((index + 0.5) / enemies[type]) };
  }))
    .sort((a, b) => a.at - b.at || TYPES.indexOf(a.type) - TYPES.indexOf(b.type))
    .map(({ type }) => type);
  const waves: EnemyType[][] = [];
  for (let start = 0, size = FIRST_WAVE_SIZE; start < order.length; start += size, size = Math.min(MAX_WAVE_SIZE, size + WAVE_SIZE_STEP)) {
    waves.push(order.slice(start, start + size));
  }
  // A lone straggler at the end joins the wave before it.
  if (waves.length > 1 && waves[waves.length - 1].length === 1) {
    waves[waves.length - 2].push(...waves.pop()!);
  }
  return waves;
};

export class WaveDirector {
  private readonly waves: EnemyType[][];
  private waveIndex = 0;
  /** Next enemy to spawn in the current wave. */
  private spawnIndex = 0;
  /** Time until the next spawn inside a wave, or since the last spawn while waiting for the next wave. */
  private timerMs: number;
  private waitingForWave = false;

  public constructor(enemies: LevelEnemyCounts) {
    this.waves = planWaves(enemies);
    this.timerMs = LEVEL_START_DELAY_MS;
  }

  public get finished(): boolean {
    return this.waveIndex >= this.waves.length;
  }

  /** Advances time; returns the enemies to spawn now. `alive` = enemies currently standing on the field. */
  public update(deltaMs: number, alive: number): EnemyType[] {
    const spawned: EnemyType[] = [];
    if (this.finished) {
      return spawned;
    }
    if (this.waitingForWave) {
      this.timerMs += deltaMs;
      const cleared = alive <= WAVE_RELEASE_ALIVE && this.timerMs >= WAVE_MIN_GAP_MS;
      if (!cleared && this.timerMs < WAVE_MAX_GAP_MS) {
        return spawned;
      }
      this.waitingForWave = false;
      this.timerMs = 0;
    } else {
      this.timerMs -= deltaMs;
    }
    const wave = this.waves[this.waveIndex];
    while (this.timerMs <= 0 && this.spawnIndex < wave.length) {
      spawned.push(wave[this.spawnIndex]);
      this.spawnIndex += 1;
      this.timerMs += WAVE_SPAWN_INTERVAL_MS;
    }
    if (this.spawnIndex >= wave.length) {
      this.waveIndex += 1;
      this.spawnIndex = 0;
      this.waitingForWave = true;
      this.timerMs = 0;
    }
    return spawned;
  }
}
