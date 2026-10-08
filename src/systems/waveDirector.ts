import {
  FIRST_GROUP_SIZE,
  GROUP_MAX_GAP_MS,
  GROUP_MIN_GAP_MS,
  GROUP_RELEASE_ALIVE,
  MAX_GROUP_SIZE,
  WAVE_SPAWN_INTERVAL_MS,
  WAVE_START_DELAY_MS,
} from '../config';
import { ENEMY_KINDS, ENEMY_TYPES } from '../data/enemyKinds';
import type { WaveEnemyCounts } from '../data/sandbox';
import type { EnemyType } from '../types';

/**
 * Splits a wave into groups and releases them at sensible moments (pure; GameScene calls `update` every
 * frame and spawns what it returns). Groups grow from FIRST_GROUP_SIZE by one up to MAX_GROUP_SIZE; each
 * type is spread through the wave, tougher types starting later, so early groups are light.
 */

/** Where in the wave (0..1) each type starts to appear (its `arrival`): fighters first, brutes and dragons later. */
const TYPE_START = (type: EnemyType): number => ENEMY_KINDS[type].arrival;
/** In order of arrival (ties in a group go to the earlier one). */
const TYPES = [...ENEMY_TYPES].sort((a, b) => TYPE_START(a) - TYPE_START(b));

/** Every enemy of the wave in spawn order, cut into groups. */
export const planWaveGroups = (enemies: WaveEnemyCounts): EnemyType[][] => {
  const order = TYPES.flatMap((type) => Array.from({ length: Math.max(0, enemies[type]) }, (_, index) => {
    const start = TYPE_START(type);
    return { type, at: start + (1 - start) * ((index + 0.5) / enemies[type]) };
  }))
    .sort((a, b) => a.at - b.at || TYPES.indexOf(a.type) - TYPES.indexOf(b.type))
    .map(({ type }) => type);
  const groups: EnemyType[][] = [];
  for (let start = 0, size = FIRST_GROUP_SIZE; start < order.length; start += size, size = Math.min(MAX_GROUP_SIZE, size + 1)) {
    groups.push(order.slice(start, start + size));
  }
  // A lone straggler at the end joins the group before it.
  if (groups.length > 1 && groups[groups.length - 1].length === 1) {
    groups[groups.length - 2].push(...groups.pop()!);
  }
  return groups;
};

export class WaveDirector {
  private readonly groups: EnemyType[][];
  private groupIndex = 0;
  /** Next enemy to spawn in the current group. */
  private spawnIndex = 0;
  /** Time until the next spawn inside a group, or since the last spawn while waiting for the next group. */
  private timerMs: number;
  private waitingForGroup = false;

  public constructor(enemies: WaveEnemyCounts) {
    this.groups = planWaveGroups(enemies);
    this.timerMs = WAVE_START_DELAY_MS;
  }

  public get finished(): boolean {
    return this.groupIndex >= this.groups.length;
  }

  /** Advances time; returns the enemies to spawn now. `alive` = enemies currently standing on the field. */
  public update(deltaMs: number, alive: number): EnemyType[] {
    const spawned: EnemyType[] = [];
    if (this.finished) {
      return spawned;
    }
    if (this.waitingForGroup) {
      this.timerMs += deltaMs;
      const cleared = alive <= GROUP_RELEASE_ALIVE && this.timerMs >= GROUP_MIN_GAP_MS;
      if (!cleared && this.timerMs < GROUP_MAX_GAP_MS) {
        return spawned;
      }
      this.waitingForGroup = false;
      this.timerMs = 0;
    } else {
      this.timerMs -= deltaMs;
    }
    const group = this.groups[this.groupIndex];
    while (this.timerMs <= 0 && this.spawnIndex < group.length) {
      spawned.push(group[this.spawnIndex]);
      this.spawnIndex += 1;
      this.timerMs += WAVE_SPAWN_INTERVAL_MS;
    }
    if (this.spawnIndex >= group.length) {
      this.groupIndex += 1;
      this.spawnIndex = 0;
      this.waitingForGroup = true;
      this.timerMs = 0;
    }
    return spawned;
  }
}
