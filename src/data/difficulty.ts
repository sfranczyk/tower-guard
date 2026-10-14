import { DIFFICULTY_SCALE, WAVES } from '../config';
import type { LevelEnemyCounts } from './sandbox';

/**
 * The run's difficulty level (settings drawer; in co-op the host's). It scales how many enemies each wave brings:
 * the level's enemy counts and the wave sizes grow by the same factor, so a level keeps its number of waves.
 */
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = ['easy', 'medium', 'hard'];
export const DEFAULT_DIFFICULTY: DifficultyLevel = 'easy';

export const isDifficultyLevel = (value: unknown): value is DifficultyLevel =>
  DIFFICULTY_LEVELS.includes(value as DifficultyLevel);

/** How much bigger every wave is (easy = 1, the sandbox's counts as set). */
export const waveScale = (level: DifficultyLevel): number => (level === 'easy' ? 1 : DIFFICULTY_SCALE[level]);

/** How a wave's enemies come out: `groupSize` at a time, `spawnIntervalMs` apart in a group, `groupGapMs` between. */
export interface WavePacing {
  groupSize: number;
  spawnIntervalMs: number;
  groupGapMs: number;
}

/** Easy: one by one; medium and hard: in groups. */
export const wavePacing = (level: DifficultyLevel): WavePacing => (level === 'easy'
  ? { groupSize: 1, spawnIntervalMs: WAVES.spawnIntervalMs, groupGapMs: WAVES.spawnIntervalMs }
  : {
    groupSize: Math.max(1, Math.round(DIFFICULTY_SCALE.groupSize)),
    spawnIntervalMs: DIFFICULTY_SCALE.groupSpawnIntervalMs,
    groupGapMs: DIFFICULTY_SCALE.groupGapMs,
  });

/** The level's enemies at this scale; a type present stays present. */
export const scaleEnemyCounts = (enemies: LevelEnemyCounts, scale: number): LevelEnemyCounts =>
  Object.fromEntries(Object.entries(enemies).map(([type, count]) =>
    [type, count > 0 ? Math.max(1, Math.round(count * scale)) : 0])) as LevelEnemyCounts;
