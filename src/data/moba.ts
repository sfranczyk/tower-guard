import { MOBA_LANES } from '../config';
import type { MinionGroup } from '../systems/minionWaves';
import type { EnemyType, UnitType } from '../types';

/**
 * MOBA mode (`?moba`, dev only for now): two teams, each with its keep and lane minions. Blue holds the left keep (the
 * player's side: its minions are soldiers, systems/AllyAI.ts), red the right one (its minions are enemies, EnemyAI).
 */
export type Team = 'blue' | 'red';

/** What a keep sends down the lane. */
export type MinionRole = 'troop' | 'archer' | 'dragon';

/**
 * Each team's minion of each role: blue in the bowman's blue (its dragon is a dragon archer in BLUE_DRAGON_LOOK), red
 * the raiders, hunters and dark dragon archers.
 */
export const MINION_KINDS: { readonly blue: Readonly<Record<MinionRole, UnitType>>; readonly red: Readonly<Record<MinionRole, EnemyType>> } = {
  blue: { troop: 'squire', archer: 'blueArcher', dragon: 'dragon' },
  red: { troop: 'raider', archer: 'hunter', dragon: 'dragon' },
};

/** The groups each keep sends now (config MOBA_LANES, tunable). */
export const minionGroups = (): readonly MinionGroup<MinionRole>[] => [
  { role: 'troop', count: MOBA_LANES.troopCount, everyMs: MOBA_LANES.troopEveryMs },
  { role: 'archer', count: MOBA_LANES.archerCount, everyMs: MOBA_LANES.archerEveryMs },
  { role: 'dragon', count: MOBA_LANES.dragonCount, everyMs: MOBA_LANES.dragonEveryMs, firstMs: MOBA_LANES.dragonFirstMs },
];
