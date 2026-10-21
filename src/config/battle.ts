import { tunable } from '../core/tuning';
/** The run: keep health, waves, survival, allies, banners, medic, difficulty. */
/**
 * A run is a row of levels (each its own map and enemies); a level's enemies come in waves
 * (systems/waveDirector.ts): the first after WAVES.startDelayMs, the enemies of a wave WAVES.spawnIntervalMs
 * apart. The next wave comes once at most WAVES.releaseAlive enemies are left standing and WAVES.minGapMs have
 * passed since the last spawn, or after WAVES.maxGapMs regardless. Wave sizes: the first WAVES.firstSize, each next
 * one bigger by WAVES.sizeStep, up to WAVES.maxSize.
 */
export const WAVES = tunable('WAVES', 'Waves', {
  spawnIntervalMs: 1200,
  startDelayMs: 3000,
  releaseAlive: 1,
  minGapMs: 2500,
  maxGapMs: 20000,
  firstSize: 3,
  sizeStep: 2,
  maxSize: 10,
});

/**
 * Survival mode (systems/survivalWaves.ts, systems/survivalRoles.ts): the first wave after `startDelayMs`; each next one
 * `gapTopMs` less `gapPerBudgetMs` per point of that wave's budget (a big wave gives a short wait), between `gapMinMs` and
 * `gapMaxMs`; or `clearedDelayMs` after the field is cleared, if that comes sooner. Waves are sized by a threat budget (each kind's `threat` in data/enemyKinds, a
 * raider 1): wave n (from 0) has `firstBudget + budgetGrowth × n` until the difficulty's `*PeakWave` (1-based), the
 * same as that one after it, × `levelGrowth` per level after the first, × the difficulty's `*Scale`, × (1 +
 * `coopBudgetPerPlayer` per extra bowman), each wave ± `sizeJitter`. On levels longer than `finaleMinMs` the last big
 * wave (× `finaleScale`) comes `finaleAtMs` before the end, the one just before it × `preFinaleScale`. No new wave in
 * the last `quietEndMs`. Each wave has a lead kind (`leadShare` of the budget; a kind that just arrived leads first,
 * never the same twice running). Bosses (`boss` in data/enemyKinds) come only as a lead, from wave `bossMinWave`
 * (1-based), never two boss waves running: `*BossMin`..`*BossMax` of them on top of the budget, with escorts of their
 * group worth `bossEscortShare` of it (a second escort lead with `secondLeadChance`); the next gap counts each boss as
 * its threat. Never more than `*MaxAlive` standing (easy, medium; hard 0 = no limit; + `coopAlivePerPlayer` per extra bowman; the rest wait). The night
 * cycle (systems/nightCycle.ts): dawn starts at `dawnAt` of the time, the moon has set by `moonSetAt`; on eclipse maps
 * the moon crosses the sun at an even pace from the level's start to its end, covering it all for `eclipseTotal` of the
 * time halfway (which sets how much bigger than the sun it is); the diamond ring flashes for `eclipseDiamond` of the
 * time before and after the total eclipse.
 */
export const SURVIVAL = tunable('SURVIVAL', 'Survival', {
  startDelayMs: 3000,
  gapTopMs: 60000,
  gapPerBudgetMs: 5000,
  gapMinMs: 20000,
  gapMaxMs: 50000,
  clearedDelayMs: 5000,
  firstBudget: 3,
  budgetGrowth: 1,
  easyPeakWave: 3,
  mediumPeakWave: 4,
  hardPeakWave: 5,
  sizeJitter: 0.2,
  levelGrowth: 1.15,
  easyScale: 0.8,
  mediumScale: 1,
  hardScale: 1.3,
  coopBudgetPerPlayer: 0.6,
  bossMinWave: 3,
  easyBossMin: 1,
  easyBossMax: 1,
  mediumBossMin: 1,
  mediumBossMax: 2,
  hardBossMin: 1,
  hardBossMax: 3,
  bossEscortShare: 0.5,
  secondLeadChance: 0.5,
  finaleMinMs: 240000,
  finaleAtMs: 120000,
  finaleScale: 1.5,
  preFinaleScale: 0.8,
  leadShare: 0.55,
  easyMaxAlive: 18,
  mediumMaxAlive: 36,
  hardMaxAlive: 0,
  coopAlivePerPlayer: 6,
  quietEndMs: 8000,
  dawnAt: 0.72,
  moonSetAt: 0.86,
  eclipseTotal: 0.06,
  eclipseDiamond: 0.02,
}, { meta: { secondLeadChance: { max: 1 }, bossEscortShare: { max: 1 }, leadShare: { max: 1 } } });

/**
 * The player's soldiers (scenes/BattleAllies.ts, systems/AllyAI.ts): how many of each may stand on the field at once
 * (`*Limit`, reserve and field together; a fallen one frees his place), how long training the next for the reserve takes
 * (`*TrainMs`, systems/allyRoster.ts), where they come in
 * (`spawnX`, beyond the left edge), the posts of the orders (`holdX` for "Hold the line", `retreatX` in front of the
 * keep for "Fall back") and how far from his post a soldier holding the line steps out to fight (`engageRange`).
 */
export const ALLIES = tunable('ALLIES', 'Allies', {
  squireLimit: 5,
  allyKnightLimit: 3,
  medicLimit: 2,
  squireTrainMs: 10000,
  allyKnightTrainMs: 20000,
  medicTrainMs: 25000,
  spawnX: -30,
  holdX: 420,
  retreatX: 230,
  engageRange: 160,
  /** How far apart (px) soldiers at the same post stand. */
  spacing: 16,
});

/**
 * The relief force at the end of a held survival level (scenes/BattleRelief.ts, systems/reliefFormation.ts): `knights`,
 * `squires` (in two ranks) and `medics` march in from beyond the left edge in three files, `gap` px apart, all
 * at the walking pace of the slowest of them (the knights), and form up in front of the keep, the front rank's head at `frontX`, `spacing` px between men in a rank, each
 * rank `rankDepth` px further down the screen than the one behind it. Once formed (or `waitMs` after the march should have
 * ended) the squires and medics cheer, the knights stand still. The end screen doesn't wait for them.
 */
export const RELIEF = tunable('RELIEF', 'Relief force', {
  knights: 10,
  squires: 20,
  medics: 3,
  gap: 24,
  frontX: 640,
  spacing: 28,
  rankDepth: 6,
  waitMs: 6000,
}, { meta: { knights: { max: 20 }, squires: { max: 40 }, medics: { max: 10 } } });

/**
 * Banners (the run's Banners option, systems/banners.ts): each keep's banner stands `standOffset` px in front of it;
 * a carrier-to-be takes one within `pickupRadius`, and wins (or brings his own back) within `deliverReach` of his own
 * keep. A mounted carrier rides at `riderSpeedFactor` of his pace.
 */
export const BANNERS = tunable('BANNERS', 'Banners', {
  standOffset: 34,
  pickupRadius: 26,
  deliverReach: 30,
  riderSpeedFactor: 0.6,
  /** Enemies escorting their bearer walk this far apart behind him and fight what comes within `escortRange` of their post. */
  escortSpacing: 18,
  escortRange: 140,
  /** The breeze the banners fly in (systems/bannerBreeze.ts): a new aim every min..max ms, the odds of a turn and of a lull. */
  breezeChangeMinMs: 5000,
  breezeChangeMaxMs: 11000,
  breezeFlipChance: 0.25,
  breezeLullChance: 0.2,
  /** How fast the cloth follows (lean units per second; 1 = limp to stiff in a second). */
  breezeEasePerS: 0.7,
});

/**
 * The medic's bandaging (systems/AllyAI.ts, systems/bandaging.ts): she picks one patient (the bowman first while he is
 * below `bowmanFirstBelow` of his health, else the lowest share of health; only one missing at least `minMissing`),
 * walks up beside him (`reach` px), kneels and heals `healPerSecond` for up to `bandageMs`, then rests `restMs` before
 * the next. A hit on her, or the patient walking off, breaks it off.
 */
export const MEDIC = tunable('MEDIC', 'Medic', {
  healPerSecond: 6,
  bandageMs: 4000,
  restMs: 2000,
  reach: 22,
  bowmanFirstBelow: 0.5,
  minMissing: 4,
});

/**
 * Difficulty levels (battle setup, data/difficulty.ts); the enemy counts are always as set. `*Damage`: how many times
 * harder every enemy hit lands on the bowmen and the keep than on easy; `*Spread`: enemy archers' aim error (dragon
 * riders' too) as a share of easy's ENEMY_ATTACK.archerSpread. On medium and hard a
 * wave comes in groups of `groupSize` (same kinds together), `groupSpawnIntervalMs` apart inside a group and
 * `groupGapMs` between groups; easy sends them one by one, WAVES.spawnIntervalMs apart. `*EnemyKeep`: the enemy keep's health as a share of ours. `*ChainFalloff`: in a chain of
 * kamikaze bombs each link is this much less likely to go off than the one before (a dud is only knocked down, unhurt;
 * the bomb a bowman's arrow, fire, lightning or contact sets off always counts as the first link; easy: always).
 */
export const DIFFICULTY_SCALE = tunable('DIFFICULTY_SCALE', 'Difficulty', {
  mediumDamage: 1.25,
  hardDamage: 1.5,
  mediumSpread: 0.75,
  hardSpread: 0.55,
  groupSize: 5,
  groupSpawnIntervalMs: 900,
  groupGapMs: 1800,
  // Share of the bowman's full health healed after a cleared level (easy: back to full).
  easyLevelHeal: 1,
  mediumLevelHeal: 0.5,
  hardLevelHeal: 0.1,
  mediumChainFalloff: 0.1,
  hardChainFalloff: 0.2,
  // The enemy keep's health as a share of the player's (sandbox keepHealth): weaker walls on easy, stronger on hard.
  easyEnemyKeep: 0.8,
  mediumEnemyKeep: 1,
  hardEnemyKeep: 1.1,
}, { meta: { mediumChainFalloff: { max: 1 }, hardChainFalloff: { max: 1 } } });
