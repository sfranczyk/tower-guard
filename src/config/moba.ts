import { tunable } from '../core/tuning';

/**
 * MOBA mode (`?moba`, scenes/BattleLanes.ts): both keeps send lane minions in groups from their own edge of the map,
 * each kind on its own clock (systems/minionWaves.ts): `troopCount` basic troops every `troopEveryMs`, `archerCount`
 * archers every `archerEveryMs`, `dragonCount` dragon archers every `dragonEveryMs` (from `dragonFirstMs`), `kamikazeCount`
 * kamikazes every `kamikazeEveryMs` (from `kamikazeFirstMs`), the first groups `firstGroupMs` after the start, the minions of a group
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
  kamikazeCount: 1,
  kamikazeEveryMs: 150000,
  kamikazeFirstMs: 150000,
  /** A lane kamikaze's health: it runs past everyone at the enemy keep (Enemy.siege). */
  kamikazeHealth: 200,
  /** Its size (1 = a normal stickman; 1.73 stands 1.5 times a bowman's height, hit box to hit box: it grows with it). */
  kamikazeSize: 1.73,
  /** × on its explosion: how big it looks and how far it reaches (soldiers, bowmen, the keep; not its damage). */
  kamikazeBlastSize: 3,
  /** × on the damage its bomb does to a keep (a kamikaze's own keep damage: data/enemyKinds.ts). */
  kamikazeKeepDamage: 3,
  /** × on what minions (blows and arrows, either side's) do to a lane kamikaze; players' arrows hit it in full. */
  kamikazeMinionDamage: 0.5,
  firstGroupMs: 4000,
  groupSpacingMs: 700,
  /** Blue fighters strike the red keep from this close to its centre (as the enemies do ours, EnemyAI). */
  keepReach: 40,
  /** Blue archers shoot the red keep's wall from this far (and foes within ENEMY_ATTACK.archerRange). */
  archerKeepRange: 300,
});

/**
 * MOBA players (scenes/BattleMoba.ts, systems/mobaEconomy.ts): gold for the last hit on an enemy minion or player
 * (`*Gold`; killing your own costs half of it, a room rule); `regenDelayMs` without a hit, then `regenAmount` health every `regenEveryMs`.
 */
export const MOBA_PLAYERS = tunable('MOBA_PLAYERS', 'MOBA players', {
  troopGold: 5,
  archerGold: 8,
  dragonGold: 25,
  kamikazeGold: 30,
  playerGold: 100,
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
  /** How often a standing keep gets the room's keep regeneration back (scenes/MobaMode.ts). */
  regenEveryMs: 10000,
});

/** MOBA: arrows holding fewer charges than ARROW_CHARGES (one vortex at a time). */
export const MOBA_ARROW_CHARGES = tunable('MOBA_ARROW_CHARGES', 'MOBA arrow charges', {
  vortex: 1,
});

/** The shop's vault buttons: the gold one click moves to or from the team vault. */
export const MOBA_VAULT_STEPS: readonly number[] = [10, 50, 100];

/**
 * MOBA's sky (systems/dayCycle.ts, rendering/DaySky.ts; looks only, but for the comet's gold): days of `dayMs` (a
 * `twilightMs` sunrise at the start and sunset at the end, a sunset red at `redSunsetChance`, else just darkening) and
 * nights of `nightMs`, from a sunrise with a full moon; the moon wanes to new over `moonDays` days and waxes back over as
 * many. An eclipse comes `eclipseMinMs`..`eclipseMaxMs` after the start (and after the previous one), moved to the next
 * day if it falls outside the full day; it lasts `eclipseMs`, total for `eclipseTotal` of that (the diamond ring
 * `eclipseDiamond` before and after), cut short when the sun sets. At a random moment of it a comet crosses the field
 * in `cometMs` from `cometHighY` down to `cometLowY` (world y); a player's arrow through it (within `cometRadius`)
 * pays him `cometGold`. Each sunrise the day's number ("The second day of battle"), and each eclipse's start
 * "Eclipse!", rises from behind the hills (and the clouds) and out of the top of the view in `dayTitleMs`. Sun and moon
 * rise and set 100 px inside the keeps (rendering/DaySky.ts) and stay `sinkMs` past their time on the horizon to sink
 * behind the hills; the stars come out over `starFadeMs` once the sun has sunk (and fade before it shows again), else only in an eclipse.
 */
export const MOBA_SKY = tunable('MOBA_SKY', 'MOBA sky', {
  dayMs: 150000,
  nightMs: 90000,
  twilightMs: 20000,
  redSunsetChance: 0.5,
  moonDays: 7,
  eclipseMinMs: 300000,
  eclipseMaxMs: 900000,
  eclipseMs: 90000,
  eclipseTotal: 0.08,
  eclipseDiamond: 0.025,
  cometMs: 16000,
  cometHighY: -20,
  cometLowY: 90,
  cometRadius: 26,
  cometGold: 100,
  dayTitleMs: 24000,
  sinkMs: 10000,
  starFadeMs: 10000,
}, { meta: { redSunsetChance: { max: 1, step: 0.05 }, eclipseTotal: { max: 0.5, step: 0.01 }, eclipseDiamond: { max: 0.2, step: 0.005 }, cometHighY: { min: -110, max: 300 }, cometLowY: { min: -110, max: 300 } } });
