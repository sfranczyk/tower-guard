import { DIFFICULTY_SCALE, WAVES } from '../config';

/**
 * The run's difficulty level (battle setup, `SandboxSettings.difficulty`; in co-op the host's). It never changes how many
 * enemies come (always the sandbox's counts): it makes their hits hurt more, their archers aim better and the waves
 * come in groups.
 */
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = ['easy', 'medium', 'hard'];
export const DEFAULT_DIFFICULTY: DifficultyLevel = 'medium';

export const DIFFICULTY_LABELS: Readonly<Record<DifficultyLevel, string>> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export const isDifficultyLevel = (value: unknown): value is DifficultyLevel =>
  DIFFICULTY_LEVELS.includes(value as DifficultyLevel);

/** How hard the enemies are: `damage` multiplies every hit on the bowmen and the keep, `aimSpread` the archers' aim error. */
export interface EnemyEdge {
  damage: number;
  aimSpread: number;
}

/** Easy: as tuned; medium and hard: DIFFICULTY_SCALE. */
export const enemyEdge = (level: DifficultyLevel): EnemyEdge => (level === 'easy'
  ? { damage: 1, aimSpread: 1 }
  : { damage: DIFFICULTY_SCALE[`${level}Damage`], aimSpread: DIFFICULTY_SCALE[`${level}Spread`] });

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

/**
 * A bowman's health at the start of the next level: heals the difficulty's share of `max` (easy: all, medium: half,
 * hard: a tenth; DIFFICULTY_SCALE.*LevelHeal), capped at `max`. A fallen bowman (0) stays fallen.
 */
export const healAfterLevel = (level: DifficultyLevel, health: number, max: number): number => (health <= 0
  ? 0
  : Math.min(max, health + max * DIFFICULTY_SCALE[`${level}LevelHeal`]));
