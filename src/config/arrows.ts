import { tunable } from '../core/tuning';
/** The players' arrows and what they do: flight, damage, blasts, pins, fire, frost, vortex. */
/**
 * Outline under the aim lines, circles and dots on maps that give one (`AimColors.halo`): `extra` px wider than the
 * line (half on each side), at `alpha` × the line's opacity. Read every frame.
 */
export const AIM_HALO = tunable('AIM_HALO', 'Aim halo', {
  extra: 1,
  alpha: 0.35,
}, { meta: { alpha: { max: 1 }, extra: { min: 0, max: 4, step: 0.25 } } });
/** Damage numbers over an enemy's head on an arrow hit (objects/DamageNumbers.ts; settings drawer toggle). */
export const DAMAGE_NUMBERS = tunable('DAMAGE_NUMBERS', 'Damage numbers', {
  lifeMs: 900,
  rise: 36,
  fontSize: 15,
  headshotFontSize: 20,
  aboveHead: 4,
}, { meta: { lifeMs: { min: 200, max: 3000, step: 50 }, rise: { min: 0, max: 120 } } });

/** How many of the latest shots keep their trail (settings drawer, 0 = no trails, up to MAX_ARROW_TRAILS). */
export const DEFAULT_ARROW_TRAILS = 1;
export const MAX_ARROW_TRAILS = 3;

/**
 * The player's arrows (tunable, `?tune`): launch speed (baseSpeed + power × forceSpeed) × speedFactor, gravity, and
 * quadratic air drag k (a = −k·|v|·v; 0.0005 makes a full-power shot lose ~30% speed in its first second, terminal
 * fall speed √(gravity / k) ≈ 1180 px/s; keep it small or arrows float). A normal hit deals a random damageMin..damageMax,
 * a headshot a random value from the upper half of that range × headshotMultiplier, a piercing arrow × piercingMultiplier
 * for each body it went through before (data/enemies `rollArrowDamage`).
 * The player's draw maps to range, not speed (`launchSpeed`): from MIN_SHOT_POWER to a full draw the speed goes from
 * minSpeedFrac to 1 of the full-draw speed so that the range (∝ v²) grows evenly with the drag (drawCurve 1; above 1
 * finer control close by, below 1 further). Enemy archers keep the plain `bowSpeed`.
 */
export const ARROWS = tunable('ARROWS', 'Arrows', {
  baseSpeed: 180,
  forceSpeed: 450,
  speedFactor: 1.6,
  minSpeedFrac: 0.12,
  drawCurve: 1,
  gravity: 700,
  drag: 0.0005,
  damageMin: 10,
  damageMax: 20,
  headshotMultiplier: 1.5,
  piercingMultiplier: 0.62,
}, { meta: { headshotMultiplier: { min: 1, max: 3 }, piercingMultiplier: { max: 1 }, minSpeedFrac: { min: 0, max: 1, step: 0.01 }, drawCurve: { min: 0.3, max: 3, step: 0.05 } } });
/**
 * Each arrow type holds up to ARROW_CHARGES[type] shots (full at the start of a level); a shot spends one and the
 * missing ones come back one at a time, ARROW_COOLDOWN[type] seconds each (per player; switching type is free). The
 * host gives a co-op guest's shots ARROW_COOLDOWN_SLACK_MS of network leeway (BattlePlayers).
 */
export const ARROW_COOLDOWN = tunable('ARROW_COOLDOWN', 'Arrow cooldowns (s)', {
  normal: 0.33,
  piercing: 2,
  fire: 4,
  frost: 4,
  pinning: 8,
  shrapnel: 3,
  explosive: 7,
  vortex: 15,
}, { meta: { normal: { min: 0, max: 5, step: 0.1 } } });
export const ARROW_CHARGES = tunable('ARROW_CHARGES', 'Arrow charges', {
  normal: 1,
  piercing: 1,
  fire: 1,
  frost: 1,
  pinning: 5,
  shrapnel: 4,
  explosive: 1,
  vortex: 4,
}, { meta: Object.fromEntries(['normal', 'piercing', 'fire', 'frost', 'pinning', 'shrapnel', 'explosive', 'vortex'].map((type) => [type, { min: 1, max: 10, step: 1 }])) });
export const ARROW_COOLDOWN_SLACK_MS = 250;
/**
 * Arrows stuck in something that blows apart (or shatters) snap in two (`breakMin..breakMax` of the shaft), the halves
 * thrown from the blast (`speedMin..speedMax` px/s, `lift` up), spinning up to `spin` rad/s, falling at `gravity`; they
 * lie where they land and are gone after `lifeMs`, fading over the last `fadeMs` (systems/arrowShards.ts).
 */
export const ARROW_SHARDS = tunable('ARROW_SHARDS', 'Arrow shards', {
  breakMin: 0.35,
  breakMax: 0.65,
  speedMin: 90,
  speedMax: 240,
  lift: 120,
  spin: 14,
  gravity: 700,
  lifeMs: 1400,
  fadeMs: 500,
});
/** A draw shorter than this (share of the full draw) looses nothing and shows no path. */
export const MIN_SHOT_POWER = 0.05;

export const EXPLOSION_RADIUS = 72;
/**
 * A fire dragon killed by a direct explosive hit blows up: the arrow's explosion this many times over (radius and
 * damage), in a cloud of fire, and the dragon and rider burst apart.
 */
export const FIRE_DRAGON_BLAST_POWER = 3;
/**
 * Explosion damage by distance from the blast: `centre` at the middle (and for the enemy an explosive arrow hits
 * directly), falling off linearly to `edge` at EXPLOSION_RADIUS. The arrow itself does no damage.
 */
export const EXPLOSION_DAMAGE = { centre: 45, edge: 10 } as const;
/**
 * Shrapnel arrow: Space in flight bursts it into SHRAPNEL_FRAGMENTS small arrows fanned SHRAPNEL_SPREAD
 * radians apart around its heading, each dealing SHRAPNEL_FRAGMENT_DAMAGE × a normal arrow's hit.
 */
export const SHRAPNEL_FRAGMENTS = 3;
export const SHRAPNEL_SPREAD = 0.16;
export const SHRAPNEL_SPEED_FACTOR = 1.05;
export const SHRAPNEL_FRAGMENT_DAMAGE = 0.55;
/**
 * Splash explosions, by distance from the blast as a fraction of EXPLOSION_RADIUS (0 = centre, 1 = edge).
 * A kill blows the body apart with SPLASH_GIB_CHANCE.max up to SPLASH_GIB_CHANCE.near, easing down to
 * SPLASH_GIB_CHANCE.min from SPLASH_GIB_CHANCE.far out (a direct explosive hit always does). Knocked-back
 * enemies are also pushed up to KNOCKBACK_PUSH_MAX px further the closer they were.
 */
export const SPLASH_GIB_CHANCE = { near: 0.3, far: 0.7, max: 0.95, min: 0.05 } as const;
export const KNOCKBACK_PUSH_MAX = 110;
/**
 * Pinning arrow: an enemy it hits stays put this long (zombies as long; brutes and dragons can't be pinned), and
 * takes only a scratch, PIN_DAMAGE (random within the range, no headshot bonus).
 */
export const PIN_DURATION_MS = 20000;
export const PIN_DURATION_ZOMBIE_MS = 20000;
export const PIN_DAMAGE: readonly [number, number] = [0, 4];
/** An arrow's damage to the enemy keep; an explosive bolt deals KEEP_BLAST_FACTOR times as much (siege). */
export const ENEMY_TOWER_DAMAGE = 16;
export const KEEP_BLAST_FACTOR = 3;
/**
 * Fire arrow (systems/afflictions.ts, systems/ArrowMagic.ts): hits for FIRE_ARROW_DAMAGE × a normal arrow's hit and
 * sets the enemy alight for ENEMY_BURN_MS (zombies × ENEMY_BURN_ZOMBIE_FACTOR, trolls × TROLL_BURN_FACTOR; the fire
 * dragon doesn't burn),
 * ENEMY_BURN_DPS dealt every BURN_TICK_MS.
 */
export const FIRE_ARROW_DAMAGE = 0.3;
export const ENEMY_BURN_MS = 6000;
export const ENEMY_BURN_ZOMBIE_FACTOR = 1.5;
export const TROLL_BURN_FACTOR = 1.2;
export const ENEMY_BURN_DPS = 5;
export const BURN_TICK_MS = 250;
/**
 * Fire spreading (systems/afflictions.ts, ArrowMagic.burnTick): each burn tick a burning enemy may set others within
 * `radius` px alight (`chance`). A fire that caught from another burns `genFactor` as long for every step away from the
 * arrow and spreads only while fewer than `maxGen` steps away, so a chain dies out. One whose fire just went out can't
 * catch from another (or from fire in the ground) for `fireproofMs`; a fire arrow still sets it alight.
 */
export const FIRE_SPREAD = tunable('FIRE_SPREAD', 'Fire spreading', {
  radius: 32,
  chance: 0.12,
  genFactor: 0.6,
  maxGen: 2,
  fireproofMs: 3500,
}, { meta: { chance: { max: 1 }, genFactor: { max: 1 }, maxGen: { min: 0, max: 5, step: 1 }, fireproofMs: { max: 10000, step: 100 } } });
/**
 * A fire arrow in the ground (ArrowMagic.groundImpact) sets it burning only with `chance` (else nothing happens): a
 * fire `radius` px wide for `ms`, which sets alight whoever walks through it (as fire caught from another).
 */
export const FIRE_PATCH = tunable('FIRE_PATCH', 'Fire in the ground', {
  chance: 0.15,
  radius: 14,
  ms: 3500,
}, { meta: { chance: { max: 1 }, radius: { max: 60 }, ms: { max: 10000, step: 100 } } });
/**
 * Weather and arrows (systems/weatherArrows.ts): on loosing, an explosive arrow in a sandstorm goes unstable with
 * `sandstormBlastChance` and a fire arrow in the rain with `rainDouseChance`; an unstable one goes off (or out) in flight
 * at a moment rolled between `minMs` and `maxMs` after the shot, unless it lands first. A doused fire arrow flies on as a
 * plain one. Fire in the ground catches with `rainGroundFire` in the rain (never on snow); on snow a frost hit freezes at once.
 */
export const WEATHER_ARROWS = tunable('WEATHER_ARROWS', 'Weather and arrows', {
  sandstormBlastChance: 0.3,
  rainDouseChance: 0.45,
  minMs: 300,
  maxMs: 3000,
  rainGroundFire: 0.03,
}, { meta: { sandstormBlastChance: { max: 1 }, rainDouseChance: { max: 1 }, rainGroundFire: { max: 1 }, minMs: { max: 10000, step: 50 }, maxMs: { max: 20000, step: 50 } } });
/**
 * Frost arrow: hits for FROST_ARROW_DAMAGE × a normal arrow's hit and chills for FROST_CHILL_MS (everything it does
 * runs at FROST_SLOW speed). The FROST_FREEZE_HITS-th hit in a row (while still chilled), or a headshot, freezes it solid for
 * FROST_FREEZE_MS (brutes FROST_FREEZE_BRUTE_MS; dragons are only chilled). Frozen enemies killed, or caught in
 * an explosion, shatter. Fire thaws them.
 */
export const FROST_ARROW_DAMAGE = 0.2;
export const FROST_CHILL_MS = 12000;
export const FROST_SLOW = 0.45;
export const FROST_FREEZE_HITS = 2;
export const FROST_FREEZE_MS = 12000;
export const FROST_FREEZE_BRUTE_MS = 5000;
/**
 * Vortex arrow (systems/vortex.ts): where it lands a vortex opens for VORTEX.ms. It pulls ground enemies within
 * VORTEX.radius to its centre (up to VORTEX.pullSpeed px/s), lifts them up the funnel (VORTEX.riseSpeed px/s)
 * and at VORTEX.top throws them up and out (VORTEX_THROW, px/s). How it takes each one depends on its mass (race
 * traits; a fighter is VORTEX_MASS.reference): pulled in and lifted at reference/mass the pace (at most
 * VORTEX_MASS.lightest× for the lightest), thrown √(reference/mass) as hard; above VORTEX_MASS.fullLift it no longer reaches the top (its ceiling drops to
 * nothing at VORTEX_MASS.anchor) and circles there until the vortex lets go; from VORTEX_MASS.anchor (brutes) it isn't
 * caught at all: inside its reach it only walks at VORTEX.heavyWalk of its pace. At
 * the end it dies away and flings out the ones it hasn't lifted yet (VORTEX_FLING). Thrown enemies fall under
 * THROW_GRAVITY and take FALL_DAMAGE on landing: perSpeed × how much faster than safeSpeed they hit the ground.
 * The arrow itself does no damage: an enemy it hits glows and levitates straight up (towards VORTEX.levitateHeight
 * at VORTEX.levitateSpeed px/s, rising above the funnel) for VORTEX.ms, then drops and takes the full fall damage.
 * Each further vortex arrow that hits it starts its VORTEX.ms over and lifts it again, VORTEX.levitateDecay as high as
 * the lift before (all together at most 1 / (1 - levitateDecay) × levitateHeight); no new vortex opens up there. Up to
 * VORTEX_MASS.levitateFull it levitates as a man does; heavier ones rise ever slower and lower, down to
 * VORTEX_LEVITATE_HEAVY as high at VORTEX_MASS.levitateHeavy (a brute) and beyond.
 */
export const VORTEX = tunable('VORTEX', 'Vortex', {
  ms: 4200,
  radius: 150,
  pullSpeed: 190,
  heavyWalk: 0.45,
  riseSpeed: 85,
  top: 130,
  levitateSpeed: 110,
  levitateHeight: 280,
  levitateDecay: 0.8,
}, { meta: { heavyWalk: { max: 1 }, levitateDecay: { max: 0.95 } } });
export const VORTEX_THROW = { up: [420, 560], side: [110, 260] } as const;
export const VORTEX_FLING = { up: [170, 260], side: [170, 290] } as const;
export const THROW_GRAVITY = 1100;
/** How fast a stickman held in a vortex or thrown flails its arms and legs (1 = the original, frantic pace). */
export const FLAIL_SPEED = 0.55;
export const FALL_DAMAGE = { safeSpeed: 220, perSpeed: 0.025 } as const;
export const VORTEX_LEVITATE_HEAVY = 0.15;
export const VORTEX_MASS = { reference: 1.2, lightest: 1.6, fullLift: 2.1, anchor: 3.6, levitateFull: 1.4, levitateHeavy: 4.2 } as const;
/** The bowman's mass for a vortex (friendly fire): a man with his bow, quiver and armour. */
export const BOWMAN_MASS = 1.3;
