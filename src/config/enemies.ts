import { tunable } from '../core/tuning';
import type { ProjectileType } from '../types';
/** Enemies: speed, kamikazes, knights, priests, trolls, shamans, attacks, dragons. */
export const ENEMY_SPEED = 30;
/**
 * A kamikaze's bomb (systems/kamikazeBomb.ts): killed by a blast it goes off `chainDelayMs` later (so a group blows up
 * one after another, each bomb as strong as the first); struck by a fire arrow it goes off with `fireChance` (else
 * just the hit: it doesn't burn), by lightning with `lightningChance`. Its damage to the bowmen and the keep falls off
 * with distance, to `edgeShare` of it at the edge of its reach. A kamikaze blown apart throws its pieces
 * KAMIKAZE_GIB_FORCE times harder.
 */
export const KAMIKAZE_BOMB = tunable('KAMIKAZE_BOMB', 'Kamikaze bomb', {
  chainDelayMs: 60,
  fireChance: 0.5,
  lightningChance: 0.8,
  edgeShare: 0.3,
}, { meta: { chainDelayMs: { min: 10, max: 500, step: 10 }, fireChance: { max: 1 }, lightningChance: { max: 1 }, edgeShare: { max: 1 } } });
export const KAMIKAZE_GIB_FORCE = 1.8;
/**
 * Soldiers keeping clear of kamikazes (systems/blastAwareness.ts): a kamikaze coming within `noticeRange` px is
 * noticed or missed once (miss chance: 1 − the race's `blastAwareness`, plus `lowHealthMiss` scaled below
 * `lowHealthBelow` of its health, `buffMiss` under a shaman's spell, `busyMiss` mid-swing). A noticed one sends it
 * `margin` px beyond the ground its bomb would blast (with every bomb that one sets off in turn), shouting "!"; it
 * stays out while within `margin + hold` px of it and, once it's gone, waits `hesitateMinMs`..`hesitateMaxMs`.
 */
export const KAMIKAZE_AWARENESS = tunable('KAMIKAZE_AWARENESS', 'Kamikaze awareness', {
  noticeRange: 320,
  margin: 24,
  hold: 40,
  lowHealthBelow: 0.4,
  lowHealthMiss: 0.6,
  buffMiss: 0.3,
  busyMiss: 0.25,
  hesitateMinMs: 500,
  hesitateMaxMs: 1500,
}, {
  meta: {
    noticeRange: { min: 50, max: 800, step: 10 }, lowHealthBelow: { max: 1 }, lowHealthMiss: { max: 1 }, buffMiss: { max: 1 }, busyMiss: { max: 1 },
    hesitateMinMs: { max: 5000, step: 50 }, hesitateMaxMs: { max: 5000, step: 50 },
  },
});
/**
 * Knights' black plate: the share of an arrow's body hit that gets through (headshots through the visor, piercing
 * arrows and blasts deal their full damage).
 */
export const KNIGHT_ARMOR = 0.35;
/**
 * A mounted knight's horse hit in the leg: the arrow deals `damage` × its hit and doesn't stick; with a chance (by arrow,
 * HORSE_LEG_LAME_CHANCE, else `lameChance`) the horse stumbles and goes lame for `lameMs`, walking at `lameSpeed`
 * × its speed (a fresh one restarts the time).
 */
export const HORSE_LEG = { damage: 0.5, lameChance: 0.35, lameMs: 4000, lameSpeed: 0.4, stumbleMs: 350 } as const;
export const HORSE_LEG_LAME_CHANCE: Partial<Record<ProjectileType, number>> = { pinning: 0.9, piercing: 0.5, fragment: 0.15, explosive: 0, vortex: 0 };
/**
 * The dark priest (systems/healing.ts) never attacks: it walks PRIEST_FOLLOW_GAP behind the front soldier on its side of
 * its target (the one nearest the target; never nearer the target than PRIEST_STANDOFF, within PRIEST_POST_SLACK). With
 * soldiers left only beyond the target it dashes past it to hide behind them; with none it retreats to the enemy keep,
 * and once only priests are left (no more to come) it walks off the field: PRIEST_ESCAPE_BEYOND past its right edge it
 * has escaped and counts as defeated. Every PRIEST_HEAL_INTERVAL_MS it
 * heals each wounded enemy within PRIEST_HEAL_RADIUS by up to PRIEST_HEAL_PER_TARGET (nearest first, never itself, not the undead),
 * one mana a point. Mana refills slowly (PRIEST_MANA_REGEN_PER_S up to PRIEST_MANA_MAX): it casts only with at least
 * PRIEST_MIN_CAST_MANA, and once below that it is drained until the mana is back to PRIEST_MANA_RECOVER_SHARE of full.
 * The mana goes when the cast (scepter raised, PRIEST_CAST_MS) starts and the heals land when it ends; knocked down,
 * thrown, frozen or caught in a vortex meanwhile, the cast is lost. Casts start at least PRIEST_HEAL_INTERVAL_MS apart.
 */
export const PRIEST_STANDOFF = 160;
export const PRIEST_FOLLOW_GAP = 55;
export const PRIEST_ESCAPE_BEYOND = 60;
export const PRIEST_POST_SLACK = 15;
export const PRIEST_HEAL_RADIUS = 170;
export const PRIEST_HEAL_INTERVAL_MS = 3000;
export const PRIEST_HEAL_PER_TARGET = 10;
export const PRIEST_MANA_MAX = 40;
export const PRIEST_MANA_REGEN_PER_S = 3;
export const PRIEST_MANA_RECOVER_SHARE = 0.8;
export const PRIEST_MIN_CAST_MANA = 4;
export const PRIEST_CAST_MS = 1000;
/**
 * A vortex arrow hitting a dragon: a ring of wind swirls round it for DRAGON_TURBULENCE_MS and it's buffeted
 * (DRAGON_BUFFET: px sideways and up and down, tilt in radians). Meanwhile the fire dragon can't breathe fire and
 * the dragon archer's rider shoots DRAGON_TURBULENCE_SPREAD times as wide.
 */
export const DRAGON_TURBULENCE_MS = 4200;
export const DRAGON_TURBULENCE_SPREAD = 4;
export const DRAGON_BUFFET = { x: 14, y: 20, tilt: 0.16 } as const;
/**
 * Regeneration (trolls, `regenerates` in data/enemyKinds): perSecond health back, in steps every tickMs (each step is
 * a co-op heal event). Being set alight (a re-hit too) stops it for afterFireMs from then, and for as long as it burns;
 * frozen, it waits.
 */
export const REGEN = tunable('REGEN', 'Troll regeneration', {
  perSecond: 6,
  tickMs: 500,
  afterFireMs: 12000,
});
/**
 * Goblin shaman (systems/shamanBuffs.ts): keeps back like the priest and every intervalMs (when there's anyone to help)
 * casts (PRIEST_CAST_MS), then buffs up to perCast others within radius, nearest first, for durationMs: haste (walk × haste),
 * stone skin on heavies (damage × stoneskinDamage, no pin, no knockback), a quicker draw for archers (draw and pause ×
 * drawPace), a bigger bomb for kamikazes (blast × blastPower, walk × kamikazeHaste); the undead get undeadHeal health.
 */
export const SHAMAN = tunable('SHAMAN', 'Goblin shaman', {
  intervalMs: 3500,
  radius: 180,
  perCast: 3,
  durationMs: 7000,
  haste: 1.4,
  kamikazeHaste: 1.15,
  stoneskinDamage: 0.65,
  drawPace: 0.6,
  blastPower: 1.6,
  undeadHeal: 12,
});
/**
 * Enemy attacks: the pause between club swings (intervalMs) and how long a swing takes (animationMs); enemy archers
 * stop and shoot from archerRange, draw for archerDrawMs, wait archerCooldownMs between shots, aim error archerSpread.
 */
export const ENEMY_ATTACK = tunable('ENEMY_ATTACK', 'Enemy attacks', {
  intervalMs: 2000,
  animationMs: 1130,
  archerRange: 340,
  archerDrawMs: 900,
  archerCooldownMs: 1700,
  archerSpread: 0.1,
});
/** Draw power (0..1) of enemy shots (their damage per shooter is in data/enemies.ts, ENEMY_DAMAGE). */
export const ENEMY_ARROW_POWER = 0.75;
/**
 * Dragon archer: flies at DRAGON_ALTITUDE (y), hovers DRAGON_HOVER_OFFSET in front of the bowman, shoots
 * within DRAGON_RANGE, drawing for DRAGON_DRAW_MS once every DRAGON_SHOT_INTERVAL_MS.
 */
export const DRAGON_ALTITUDE = 180;
export const DRAGON_HOVER_OFFSET = 260;
export const DRAGON_RANGE = 520;
export const DRAGON_DRAW_MS = 900;
export const DRAGON_SHOT_INTERVAL_MS = 2800;
/**
 * Dragons turn round (systems/dragonFlight.ts) when their target gets DRAGON_TURN_PAST px behind them, or when
 * there's no room in front of it by the world's edge; the turn takes DRAGON_TURN_MS (no shooting or fire meanwhile).
 */
export const DRAGON_TURN_PAST = 60;
export const DRAGON_TURN_MS = 700;
/**
 * Dragon flight between hovers (systems/dragonManoeuvre.ts), both dragons: top speed transitSpeed (px/s), steering
 * accel (px/s²), diveGain (share of both gained diving straight down, lost climbing), braking into the hover from
 * flareLift px above it. A hit jolts it by hitKick px/s (springs back) and delays the archer's draw by hitShotDelayMs.
 * In flight the archer's aim error grows to movingSpread× and his shots come movingShotPace as often (at full speed).
 */
export const DRAGON_FLIGHT = tunable('DRAGON_FLIGHT', 'Dragon flight', {
  transitSpeed: 130,
  accel: 140,
  diveGain: 0.5,
  flareLift: 18,
  hitKick: 80,
  hitShotDelayMs: 300,
  movingSpread: 4,
  movingShotPace: 0.5,
});
/**
 * Where and how long a dragon hovers (systems/dragonManoeuvre.ts): hoverMinMs..hoverMaxMs, then it flies to a new
 * hover point at a random height (y altitudeMin..altitudeMax, at least minAltitudeChange from the last) and distance
 * (offsetMin..offsetMax in front of its target). The fire dragon stays low and close enough for its fire to reach.
 */
export const DRAGON_ARCHER_HOVER = tunable('DRAGON_ARCHER_HOVER', 'Dragon archer hovers', {
  altitudeMin: 120,
  altitudeMax: 260,
  minAltitudeChange: 50,
  offsetMin: 200,
  offsetMax: 340,
  hoverMinMs: 10000,
  hoverMaxMs: 14000,
});
export const FIRE_DRAGON_HOVER = tunable('FIRE_DRAGON_HOVER', 'Fire dragon hovers', {
  altitudeMin: 255,
  altitudeMax: 320,
  minAltitudeChange: 30,
  offsetMin: 160,
  offsetMax: 240,
  hoverMinMs: 5000,
  hoverMaxMs: 8000,
});
/**
 * The fire dragon while everyone hides in the keep (its fire can't hurt it): no fire, it hovers well away from the
 * keep (offsetMin..offsetMax px) and high, now and then moving, until someone comes out.
 */
export const FIRE_DRAGON_WAIT = tunable('FIRE_DRAGON_WAIT', 'Fire dragon waits', {
  altitudeMin: 150,
  altitudeMax: 230,
  minAltitudeChange: 30,
  offsetMin: 300,
  offsetMax: 860,
  hoverMinMs: 6000,
  hoverMaxMs: 10000,
});
/**
 * The fire dragon's strafing run (systems/dragonStrafe.ts), picked with `weight` (0..1) when a hover ends: within
 * readyRange px of its start it sets off at once, else it flies there (a hover point farther out) and lurks
 * lurkMinMs..lurkMaxMs. Setting off it rears its head and dives to where the fire meets the ground at reachShare of
 * the stream (aimed `aim` rad down-forward), flying level past him up to `speed` px/s with `accel` px/s², so he's in
 * the middle of the burnt strip; it brakes passBeyond px behind him, and a next pass goes the other way. By the
 * player's keep it may fly up to edgeOut px past the world's edge.
 */
export const FIRE_DRAGON_STRAFE = tunable('FIRE_DRAGON_STRAFE', 'Fire dragon strafe', {
  weight: 0.65,
  speed: 170,
  accel: 220,
  aim: 0.8,
  reachShare: 0.65,
  passBeyond: 220,
  edgeOut: 300,
  readyRange: 60,
  lurkMinMs: 1200,
  lurkMaxMs: 2200,
  diveSpeed: 220,
});
/**
 * Fire dragon: flies lower (FIRE_DRAGON_ALTITUDE) and hovers closer (FIRE_DRAGON_HOVER_OFFSET) so its fire
 * (rendering/dragonFire.ts, ~290 px long at DRAGON_SCALE) reaches the bowman; it breathes when he's within
 * FIRE_DRAGON_RANGE of its mouth, at most once every FIRE_DRAGON_BREATH_INTERVAL_MS (start to start).
 */
export const FIRE_DRAGON_ALTITUDE = 290;
export const FIRE_DRAGON_HOVER_OFFSET = 200;
export const FIRE_DRAGON_RANGE = 300;
export const FIRE_DRAGON_BREATH_INTERVAL_MS = 6500;
/**
 * Burning (the fire dragon's flames set the bowman alight, systems/burning.ts): BURN_DAMAGE_PER_S of steady
 * damage for BURN_DURATION_MS (by difficulty) after the flames last touched him; staying in the fire keeps relighting it.
 */
export const BURN_DURATION_MS = { easy: 4000, medium: 6000, hard: 8000 } as const;
export const BURN_DAMAGE_PER_S = 3;
/** Dragon drawn at this scale (its art is ~300 px long with the tail). */
export const DRAGON_SCALE = 0.42;
