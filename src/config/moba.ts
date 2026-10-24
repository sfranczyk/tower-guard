import { tunable } from '../core/tuning';

/**
 * MOBA mode (`?moba`, scenes/BattleLanes.ts): both keeps send lane minions in groups from their own edge of the map,
 * each kind on its own clock (systems/minionWaves.ts): `troopCount` basic troops every `troopEveryMs`, `archerCount`
 * archers every `archerEveryMs`, `dragonCount` dragon archers every `dragonEveryMs` (from `dragonFirstMs`), the first groups `firstGroupMs` after the start, the minions of a group
 * `groupSpacingMs` apart. Blue minions fight on the player's side (systems/AllyAI.ts), red ones are the enemies.
 */
export const MOBA_LANES = tunable('MOBA_LANES', 'MOBA lanes', {
  troopCount: 5,
  troopEveryMs: 40000,
  archerCount: 3,
  archerEveryMs: 30000,
  dragonCount: 1,
  dragonEveryMs: 120000,
  /** The first dragons come this long after the start (the other groups at `firstGroupMs`). */
  dragonFirstMs: 120000,
  firstGroupMs: 4000,
  groupSpacingMs: 700,
  /** Blue fighters strike the red keep from this close to its centre (as the enemies do ours, EnemyAI). */
  keepReach: 40,
  /** Blue archers shoot the red keep's wall from this far (and foes within ENEMY_ATTACK.archerRange). */
  archerKeepRange: 300,
});

/**
 * MOBA players (scenes/BattleMoba.ts, systems/mobaEconomy.ts): gold for the last hit on an enemy minion or player
 * (`*Gold`), the killer of a teammate pays `teamKillPenalty` (as much as he has); `regenDelayMs` without a hit, then `regenAmount` health every `regenEveryMs`.
 */
export const MOBA_PLAYERS = tunable('MOBA_PLAYERS', 'MOBA players', {
  troopGold: 5,
  archerGold: 8,
  dragonGold: 25,
  playerGold: 100,
  teamKillPenalty: 200,
  regenDelayMs: 5000,
  regenAmount: 5,
  regenEveryMs: 4000,
  /** How close (px) to his keep's centre a player must be for the shop (I). */
  shopRange: 160,
});

/**
 * MOBA keeps: how far in from each end of the field they stand (a battle's: KEEP_INSET). The start purse, keep and
 * bowman health and the respawn wait are the room's rules (data/mobaRules.ts).
 */
export const MOBA_KEEPS = tunable('MOBA_KEEPS', 'MOBA keeps', {
  inset: 210,
});

/** MOBA: arrows holding fewer charges than ARROW_CHARGES (one vortex at a time). */
export const MOBA_ARROW_CHARGES = tunable('MOBA_ARROW_CHARGES', 'MOBA arrow charges', {
  vortex: 1,
});

/** The shop's vault buttons: the gold one click moves to or from the team vault. */
export const MOBA_VAULT_STEPS: readonly number[] = [10, 50, 100];
