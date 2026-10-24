import { DEFAULT_DIFFICULTY, isDifficultyLevel, type DifficultyLevel } from './difficulty';
import { BATTLEGROUNDS, BATTLEGROUND_IDS, type BattlegroundId } from './battlegrounds';
import type { EnemyType } from '../types';
import { ENEMY_KINDS, ENEMY_TYPES } from './enemyKinds';
import { DEFAULT_LOADOUT, normalizeLoadout, type Loadout } from './loadout';
import { DEFAULT_MOBA_RULES, normalizeMobaRules, type MobaRules } from './mobaRules';

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
/** Survival runs are shorter: at most this many nights (the stored list still has MAX_LEVELS entries). */
export const MAX_SURVIVAL_LEVELS = 3;
export const MAX_ENEMIES_PER_TYPE = 50;
export const HEALTH_LIMITS = {
  bowman: { min: 100, max: 1000, step: 10 },
  keep: { min: 1000, max: 10000, step: 100 },
} as const;

export type LevelEnemyCounts = Record<EnemyType, number>;

export interface LevelSetup {
  enemies: LevelEnemyCounts;
  battleground: BattlegroundId;
}

/** A battle run clears each level's enemies; a survival run holds out each level for its time (no enemy keep). */
export type RunMode = 'battle' | 'survival';
export const RUN_MODES: readonly RunMode[] = ['battle', 'survival'];
export const RUN_MODE_LABELS: Readonly<Record<RunMode, string>> = { battle: 'Battle', survival: 'Survival' };
/** What each mode is, on the mode picker that opens the battle setup. */
export const RUN_MODE_DESCRIPTIONS: Readonly<Record<RunMode, string>> = {
  battle: 'Clear each level of the enemies you set up, wave after wave, then march on to the next. Call in squires, knights and medics to fight beside you.',
  survival: 'Hold the keep through the night until dawn while the chosen kinds keep coming, more the longer it lasts. No support: you stand alone.',
};

export const SURVIVAL_MINUTES = { min: 1, max: 20 } as const;

/** A survival level: where, which kinds come (how many is up to systems/survivalWaves.ts) and for how long. */
export interface SurvivalLevel {
  battleground: BattlegroundId;
  /** In catalogue order, at least one. */
  kinds: EnemyType[];
  minutes: number;
}

/** The survival run's own levels (its own row, apart from the battle levels). */
export interface SurvivalSetup {
  levelCount: number;
  /** Always MAX_LEVELS entries; only the first `levelCount` are played. */
  levels: SurvivalLevel[];
}

export interface SandboxSettings {
  /** Which of the two setups is played. */
  mode: RunMode;
  survival: SurvivalSetup;
  levelCount: number;
  /** Always MAX_LEVELS entries; only the first `levelCount` are played. */
  levels: LevelSetup[];
  bowmanHealth: number;
  keepHealth: number;
  /** The arrow in each weapon slot (keys 1–3); in co-op the host's (the guest picks their own, net/coopLink.ts). */
  loadout: Loadout;
  /** How many enemies each wave brings and how they come out (data/difficulty.ts); fixed for the run. */
  difficulty: DifficultyLevel;
  /** Banners (systems/banners.ts): each keep has one; bringing the enemy's home wins a level, losing ours loses it. Solo only. */
  banners: boolean;
  /** Support: the player may summon soldiers (squire, knight, medic) in battle mode; never in survival (`supportAllowed`). */
  support: boolean;
  /** Friendly fire alone (on by default): the player's arrows and their effects hit the bowman and soldiers too. */
  friendlyFire: boolean;
  /** Friendly fire with others (off by default), kept apart so each keeps its own default (`friendlyFireOn`). */
  coopFriendlyFire: boolean;
  /** The MOBA room's rules (the host's Rules tab, data/mobaRules.ts). */
  moba: MobaRules;
}

/** Default levels alternate battlegrounds; the first (a new run's only level) is a varied one of 24 in four waves. */
const DEFAULT_LEVEL_ENEMIES: readonly LevelEnemyCounts[] = [
  { raider: 7, fast: 3, tank: 1, troll: 0, hunter: 3, dragon: 1, fireDragon: 0, kamikaze: 1, goblinKamikaze: 2, zombie: 2, knight: 2, heavyKnight: 0, horseKnight: 1, priest: 1, shaman: 0 },
  { raider: 4, fast: 2, tank: 0, troll: 0, hunter: 1, dragon: 0, fireDragon: 0, kamikaze: 0, goblinKamikaze: 0, zombie: 1, knight: 0, heavyKnight: 0, horseKnight: 0, priest: 0, shaman: 0 },
  { raider: 4, fast: 3, tank: 1, troll: 0, hunter: 2, dragon: 0, fireDragon: 0, kamikaze: 0, goblinKamikaze: 1, zombie: 2, knight: 1, heavyKnight: 0, horseKnight: 0, priest: 0, shaman: 0 },
  { raider: 5, fast: 3, tank: 2, troll: 0, hunter: 2, dragon: 1, fireDragon: 0, kamikaze: 1, goblinKamikaze: 1, zombie: 2, knight: 2, heavyKnight: 0, horseKnight: 1, priest: 1, shaman: 0 },
  { raider: 6, fast: 4, tank: 3, troll: 0, hunter: 3, dragon: 1, fireDragon: 1, kamikaze: 1, goblinKamikaze: 2, zombie: 3, knight: 2, heavyKnight: 1, horseKnight: 1, priest: 1, shaman: 0 },
];

/** Default survival levels: more kinds each level, each on another survival map. */
const DEFAULT_SURVIVAL_KINDS: readonly EnemyType[][] = [
  ['raider', 'hunter'],
  ['raider', 'fast', 'hunter', 'zombie'],
  ['raider', 'fast', 'hunter', 'zombie', 'tank', 'goblinKamikaze'],
  ['raider', 'fast', 'hunter', 'zombie', 'knight', 'priest', 'dragon'],
  ['raider', 'fast', 'hunter', 'zombie', 'tank', 'troll', 'knight', 'horseKnight', 'shaman', 'fireDragon'],
];
export const DEFAULT_SURVIVAL_MINUTES = 3;
const BATTLE_BATTLEGROUNDS = BATTLEGROUND_IDS.filter((id) => !BATTLEGROUNDS[id].nightCycle);
/** The survival maps in the order of the battle maps they are the versions of. */
const SURVIVAL_BATTLEGROUNDS = BATTLEGROUND_IDS.filter((id) => BATTLEGROUNDS[id].nightCycle)
  .sort((a, b) => BATTLE_BATTLEGROUNDS.indexOf(BATTLEGROUNDS[a].nightCycle!.nightOf) - BATTLE_BATTLEGROUNDS.indexOf(BATTLEGROUNDS[b].nightCycle!.nightOf));

/** The maps a level of this mode may be fought on: survival on the night maps only, battle on the others. */
export const battlegroundsFor = (mode: RunMode): BattlegroundId[] =>
  [...(mode === 'survival' ? SURVIVAL_BATTLEGROUNDS : BATTLE_BATTLEGROUNDS)];

/** The night map of a battle map, if it has one (a stored survival level on a day map moves to its night). */
const nightVersionOf = (id: unknown): BattlegroundId | undefined =>
  BATTLEGROUND_IDS.find((night) => BATTLEGROUNDS[night].nightCycle?.nightOf === id);

export const createDefaultSandbox = (): SandboxSettings => ({
  mode: 'battle',
  survival: {
    levelCount: MIN_LEVELS,
    levels: DEFAULT_SURVIVAL_KINDS.map((kinds, index) => ({
      battleground: SURVIVAL_BATTLEGROUNDS[index % SURVIVAL_BATTLEGROUNDS.length],
      kinds: [...kinds], minutes: DEFAULT_SURVIVAL_MINUTES })),
  },
  levelCount: MIN_LEVELS,
  levels: DEFAULT_LEVEL_ENEMIES.map((enemies, index) => ({
    enemies: { ...enemies },
    battleground: battlegroundsFor('battle')[index % battlegroundsFor('battle').length],
  })),
  bowmanHealth: 300,
  keepHealth: 3300,
  loadout: [...DEFAULT_LOADOUT],
  difficulty: DEFAULT_DIFFICULTY,
  banners: false,
  support: true,
  friendlyFire: true,
  coopFriendlyFire: false,
  moba: { ...DEFAULT_MOBA_RULES },
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

/** Enemy ids renamed since settings were stored: old id → new id. */
const RENAMED_TYPES: Readonly<Record<string, EnemyType>> = { basic: 'raider', bandit: 'raider', archer: 'hunter', hammerKnight: 'heavyKnight' };

/** A stored level's counts with renamed ids moved to their new names. */
const renameTypes = (enemies: Partial<Record<string, unknown>> | undefined): Partial<Record<string, unknown>> | undefined =>
  enemies && Object.fromEntries(Object.entries(enemies).map(([type, count]) => [RENAMED_TYPES[type] ?? type, count]));

const isBattleground = (value: unknown, mode: RunMode): value is BattlegroundId =>
  battlegroundsFor(mode).includes(value as BattlegroundId);

/** Stored survival levels, clamped: known kinds only (catalogue order, renamed ids moved), at least one, 1–20 minutes. */
const normalizeSurvival = (input: Partial<SurvivalSetup> | undefined, defaults: SurvivalSetup): SurvivalSetup => ({
  levelCount: clampInt(input?.levelCount, MIN_LEVELS, MAX_SURVIVAL_LEVELS, defaults.levelCount),
  levels: defaults.levels.map((fallback, index) => {
    const level = input?.levels?.[index];
    const stored = Array.isArray(level?.kinds) ? level.kinds.map((kind) => RENAMED_TYPES[kind] ?? kind) : undefined;
    const kinds = stored ? ENEMY_TYPES.filter((type) => stored.includes(type)) : fallback.kinds;
    return {
      battleground: isBattleground(level?.battleground, 'survival')
        ? level.battleground
        : nightVersionOf(level?.battleground) ?? fallback.battleground,
      kinds: kinds.length > 0 ? kinds : fallback.kinds,
      minutes: clampInt(level?.minutes, SURVIVAL_MINUTES.min, SURVIVAL_MINUTES.max, fallback.minutes),
    };
  }),
});

/** Fills gaps and clamps every field, so stored or hand-edited settings are always playable. */
export const normalizeSandbox = (input: (Partial<SandboxSettings> & LegacySandbox) | undefined): SandboxSettings => {
  const defaults = createDefaultSandbox();
  if (!input) {
    return defaults;
  }
  const storedLevels = input.levels ?? input.waves;
  return {
    mode: RUN_MODES.includes(input.mode as RunMode) ? (input.mode as RunMode) : defaults.mode,
    survival: normalizeSurvival(input.survival, defaults.survival),
    levelCount: clampInt(input.levelCount ?? input.waveCount, MIN_LEVELS, MAX_LEVELS, defaults.levelCount),
    levels: defaults.levels.map((fallback, index) => {
      const level = storedLevels?.[index];
      const enemies = renameTypes(level?.enemies);
      return {
        // A stored level that predates a type gets none of it (rather than the default count).
        enemies: Object.fromEntries(ENEMY_TYPES.map((type) => [
          type,
          clampInt(enemies?.[type], 0, MAX_ENEMIES_PER_TYPE, enemies && !(type in enemies) ? 0 : fallback.enemies[type]),
        ])) as LevelEnemyCounts,
        battleground: isBattleground(level?.battleground, 'battle') ? level.battleground : fallback.battleground,
      };
    }),
    bowmanHealth: clampInt(input.bowmanHealth, HEALTH_LIMITS.bowman.min, HEALTH_LIMITS.bowman.max, defaults.bowmanHealth),
    keepHealth: clampInt(input.keepHealth, HEALTH_LIMITS.keep.min, HEALTH_LIMITS.keep.max, defaults.keepHealth),
    loadout: normalizeLoadout(input.loadout),
    difficulty: isDifficultyLevel(input.difficulty) ? input.difficulty : defaults.difficulty,
    banners: typeof input.banners === 'boolean' ? input.banners : defaults.banners,
    support: typeof input.support === 'boolean' ? input.support : defaults.support,
    friendlyFire: typeof input.friendlyFire === 'boolean' ? input.friendlyFire : defaults.friendlyFire,
    coopFriendlyFire: typeof input.coopFriendlyFire === 'boolean' ? input.coopFriendlyFire : defaults.coopFriendlyFire,
    moba: normalizeMobaRules(input.moba),
  };
};

export const levelEnemyTotal = (enemies: LevelEnemyCounts): number =>
  ENEMY_TYPES.reduce((sum, type) => sum + enemies[type], 0);

/** How many levels a run of this mode may have. */
export const maxLevelsFor = (mode: RunMode): number => (mode === 'survival' ? MAX_SURVIVAL_LEVELS : MAX_LEVELS);

/** How many levels the run has, in its mode. */
export const runLevelCount = (sandbox: SandboxSettings): number =>
  (sandbox.mode === 'survival' ? sandbox.survival.levelCount : sandbox.levelCount);

/** The map of the run's level `index`, in its mode. */
export const runBattleground = (sandbox: SandboxSettings, index: number): BattlegroundId =>
  (sandbox.mode === 'survival' ? sandbox.survival.levels : sandbox.levels)[index].battleground;

/** The survival level `index` of the run, if it's a survival run. */
export const survivalLevel = (sandbox: SandboxSettings, index: number): SurvivalLevel | undefined =>
  (sandbox.mode === 'survival' ? sandbox.survival.levels[index] : undefined);

/** Whether the run's player may summon soldiers: battle mode with support on (survival never). */
export const supportAllowed = (sandbox: SandboxSettings): boolean => sandbox.mode === 'battle' && sandbox.support;

/** Whether the run's arrows hit their own side: the solo setting alone, the co-op one with others (`multiplayer`). */
export const friendlyFireOn = (sandbox: SandboxSettings, multiplayer: boolean): boolean =>
  (multiplayer ? sandbox.coopFriendlyFire : sandbox.friendlyFire);

/** The setting `friendlyFireOn` reads, set to `enabled`. */
export const withFriendlyFire = (sandbox: SandboxSettings, multiplayer: boolean, enabled: boolean): SandboxSettings =>
  (multiplayer ? { ...sandbox, coopFriendlyFire: enabled } : { ...sandbox, friendlyFire: enabled });

/** Whether the run is played with banners: battle mode with banners on, solo only (online co-op never). */
export const bannersInPlay = (sandbox: SandboxSettings, online: boolean): boolean =>
  sandbox.mode === 'battle' && sandbox.banners && !online;
