import { BATTLEGROUND_IDS, type BattlegroundId } from './battlegrounds';
import type { EnemyType } from '../types';
import { ENEMY_KINDS, ENEMY_TYPES } from './enemyKinds';
import { DEFAULT_LOADOUT, normalizeLoadout, type Loadout } from './loadout';

/**
 * Sandbox setup chosen on the setup screen: how many levels, what each level sends and where it's
 * fought, the starting health of the bowman and the keep, and the arrows in the quiver. Pure data + validation.
 */

export { ENEMY_TYPES } from './enemyKinds';
/** Each enemy's name in the setup (data/enemyKinds.ts). */
export const ENEMY_TYPE_LABELS: Readonly<Record<EnemyType, string>> = Object.fromEntries(
  ENEMY_TYPES.map((type) => [type, ENEMY_KINDS[type].label]),
) as Record<EnemyType, string>;

export const MIN_LEVELS = 1;
export const MAX_LEVELS = 5;
export const MAX_ENEMIES_PER_TYPE = 20;
export const HEALTH_LIMITS = {
  bowman: { min: 20, max: 500, step: 10 },
  keep: { min: 100, max: 5000, step: 100 },
} as const;

export type LevelEnemyCounts = Record<EnemyType, number>;

export interface LevelSetup {
  enemies: LevelEnemyCounts;
  battleground: BattlegroundId;
}

export interface SandboxSettings {
  levelCount: number;
  /** Always MAX_LEVELS entries; only the first `levelCount` are played. */
  levels: LevelSetup[];
  bowmanHealth: number;
  keepHealth: number;
  /** The arrow in each weapon slot (keys 1–5); in co-op the host's (the guest picks their own, net/coopLink.ts). */
  loadout: Loadout;
}

/** Default levels get a little harder each time and alternate battlegrounds. */
const DEFAULT_LEVEL_ENEMIES: readonly LevelEnemyCounts[] = [
  { basic: 4, fast: 0, tank: 0, archer: 1, dragon: 0, fireDragon: 0, kamikaze: 0, zombie: 0 },
  { basic: 4, fast: 2, tank: 0, archer: 1, dragon: 0, fireDragon: 0, kamikaze: 0, zombie: 1 },
  { basic: 4, fast: 3, tank: 1, archer: 2, dragon: 0, fireDragon: 0, kamikaze: 1, zombie: 2 },
  { basic: 5, fast: 3, tank: 2, archer: 2, dragon: 1, fireDragon: 0, kamikaze: 2, zombie: 2 },
  { basic: 6, fast: 4, tank: 3, archer: 3, dragon: 1, fireDragon: 1, kamikaze: 2, zombie: 3 },
];

export const createDefaultSandbox = (): SandboxSettings => ({
  levelCount: MIN_LEVELS,
  levels: DEFAULT_LEVEL_ENEMIES.map((enemies, index) => ({
    enemies: { ...enemies },
    battleground: BATTLEGROUND_IDS[index % BATTLEGROUND_IDS.length],
  })),
  bowmanHealth: 100,
  keepHealth: 2000,
  loadout: [...DEFAULT_LOADOUT],
});

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};

/** Settings stored before levels were called levels: `waves` and `waveCount` (read, never written). */
interface LegacySandbox {
  waves?: Partial<LevelSetup>[];
  waveCount?: number;
}

/** Fills gaps and clamps every field, so stored or hand-edited settings are always playable. */
export const normalizeSandbox = (input: (Partial<SandboxSettings> & LegacySandbox) | undefined): SandboxSettings => {
  const defaults = createDefaultSandbox();
  if (!input) {
    return defaults;
  }
  const storedLevels = input.levels ?? input.waves;
  return {
    levelCount: clampInt(input.levelCount ?? input.waveCount, MIN_LEVELS, MAX_LEVELS, defaults.levelCount),
    levels: defaults.levels.map((fallback, index) => {
      const level = storedLevels?.[index];
      return {
        // A stored level that predates a type gets none of it (rather than the default count).
        enemies: Object.fromEntries(ENEMY_TYPES.map((type) => [
          type,
          clampInt(level?.enemies?.[type], 0, MAX_ENEMIES_PER_TYPE, level?.enemies && !(type in level.enemies) ? 0 : fallback.enemies[type]),
        ])) as LevelEnemyCounts,
        battleground: BATTLEGROUND_IDS.includes(level?.battleground as BattlegroundId)
          ? (level?.battleground as BattlegroundId)
          : fallback.battleground,
      };
    }),
    bowmanHealth: clampInt(input.bowmanHealth, HEALTH_LIMITS.bowman.min, HEALTH_LIMITS.bowman.max, defaults.bowmanHealth),
    keepHealth: clampInt(input.keepHealth, HEALTH_LIMITS.keep.min, HEALTH_LIMITS.keep.max, defaults.keepHealth),
    loadout: normalizeLoadout(input.loadout),
  };
};

export const levelEnemyTotal = (enemies: LevelEnemyCounts): number =>
  ENEMY_TYPES.reduce((sum, type) => sum + enemies[type], 0);
