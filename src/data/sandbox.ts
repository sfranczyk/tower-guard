import { BATTLEGROUND_IDS, type BattlegroundId } from './battlegrounds';
import type { EnemyType } from '../types';

/**
 * Sandbox setup chosen on the setup screen: how many waves, what each wave sends and where it's
 * fought, and the starting health of the bowman and the keep. Pure data + validation.
 */

export const ENEMY_TYPES: readonly EnemyType[] = ['basic', 'fast', 'tank', 'archer', 'dragon', 'kamikaze', 'zombie'];
export const ENEMY_TYPE_LABELS: Readonly<Record<EnemyType, string>> = {
  basic: 'Fighter',
  fast: 'Runner',
  tank: 'Brute',
  archer: 'Archer',
  dragon: 'Dragon',
  kamikaze: 'Kamikaze',
  zombie: 'Zombie',
};

export const MIN_WAVES = 1;
export const MAX_WAVES = 5;
export const MAX_ENEMIES_PER_TYPE = 20;
export const HEALTH_LIMITS = {
  bowman: { min: 20, max: 500, step: 10 },
  keep: { min: 100, max: 5000, step: 100 },
} as const;

export type WaveEnemyCounts = Record<EnemyType, number>;

export interface WaveSetup {
  enemies: WaveEnemyCounts;
  battleground: BattlegroundId;
}

export interface SandboxSettings {
  waveCount: number;
  /** Always MAX_WAVES entries; only the first `waveCount` are played. */
  waves: WaveSetup[];
  bowmanHealth: number;
  keepHealth: number;
}

/** Default waves get a little harder each time and alternate battlegrounds. */
const DEFAULT_WAVE_ENEMIES: readonly WaveEnemyCounts[] = [
  { basic: 4, fast: 0, tank: 0, archer: 1, dragon: 0, kamikaze: 0, zombie: 0 },
  { basic: 4, fast: 2, tank: 0, archer: 1, dragon: 0, kamikaze: 0, zombie: 1 },
  { basic: 4, fast: 3, tank: 1, archer: 2, dragon: 0, kamikaze: 1, zombie: 2 },
  { basic: 5, fast: 3, tank: 2, archer: 2, dragon: 1, kamikaze: 2, zombie: 2 },
  { basic: 6, fast: 4, tank: 3, archer: 3, dragon: 1, kamikaze: 2, zombie: 3 },
];

export const createDefaultSandbox = (): SandboxSettings => ({
  waveCount: MIN_WAVES,
  waves: DEFAULT_WAVE_ENEMIES.map((enemies, index) => ({
    enemies: { ...enemies },
    battleground: BATTLEGROUND_IDS[index % BATTLEGROUND_IDS.length],
  })),
  bowmanHealth: 100,
  keepHealth: 2000,
});

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};

/** Fills gaps and clamps every field, so stored or hand-edited settings are always playable. */
export const normalizeSandbox = (input: Partial<SandboxSettings> | undefined): SandboxSettings => {
  const defaults = createDefaultSandbox();
  if (!input) {
    return defaults;
  }
  return {
    waveCount: clampInt(input.waveCount, MIN_WAVES, MAX_WAVES, defaults.waveCount),
    waves: defaults.waves.map((fallback, index) => {
      const wave = input.waves?.[index];
      return {
        // A stored wave that predates a type gets none of it (rather than the default count).
        enemies: Object.fromEntries(ENEMY_TYPES.map((type) => [
          type,
          clampInt(wave?.enemies?.[type], 0, MAX_ENEMIES_PER_TYPE, wave?.enemies && !(type in wave.enemies) ? 0 : fallback.enemies[type]),
        ])) as WaveEnemyCounts,
        battleground: BATTLEGROUND_IDS.includes(wave?.battleground as BattlegroundId)
          ? (wave?.battleground as BattlegroundId)
          : fallback.battleground,
      };
    }),
    bowmanHealth: clampInt(input.bowmanHealth, HEALTH_LIMITS.bowman.min, HEALTH_LIMITS.bowman.max, defaults.bowmanHealth),
    keepHealth: clampInt(input.keepHealth, HEALTH_LIMITS.keep.min, HEALTH_LIMITS.keep.max, defaults.keepHealth),
  };
};

export const waveEnemyTotal = (enemies: WaveEnemyCounts): number =>
  ENEMY_TYPES.reduce((sum, type) => sum + enemies[type], 0);
