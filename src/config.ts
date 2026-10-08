/**
 * The view (screen) in game px: always GAME_HEIGHT tall and at least GAME_WIDTH wide (2.1:1). A wider
 * window, or one big enough to pass MAX_VIEW_SCALE, widens the view (more landscape) instead of scaling
 * everything up, up to MAX_VIEW_WIDTH (see core/viewport.ts).
 */
export const GAME_WIDTH = 1134;
export const GAME_HEIGHT = 540;
export const MAX_VIEW_WIDTH = 1800;
/** Largest on-screen scale (CSS px per game px) before the view widens instead of growing. */
export const MAX_VIEW_SCALE = 1.4;
/** Upper limit of the renderer resolution (backing pixels per game px) for big windows and browser zoom. */
export const MAX_RENDER_RESOLUTION = 4;
export const RENDER_SCALE = 1;
/** The battlefield, keep to keep (independent of the view width); the camera follows the bowman across it. */
export const WORLD_WIDTH = 3600;
/**
 * Width of the backdrop behind menus, labs and the lobby (centred in the view), and of one stretch of the hills
 * drawing, which repeats (mirrored every other time) across the battlefield.
 */
export const BACKDROP_WIDTH = 1200;
/** Landscape (sky, hills, trees, ground) is drawn this far beyond both ends, for views wider than the backdrop. */
export const SCENERY_MARGIN = Math.max(0, Math.ceil((MAX_VIEW_WIDTH - BACKDROP_WIDTH) / 2)) + 40;
export const CAMERA_ZOOM = 1;

export const GROUND_Y = 490;
/** The ground surface waves up and down by this much around GROUND_Y (see systems/terrain.ts). */
export const TERRAIN_AMPLITUDE = 7;
export const PLAYER_TOWER_X = 70;
export const ENEMY_TOWER_X = WORLD_WIDTH - 70;
export const BOWMAN_START_X = 160;
export const BOWMAN_Y = GROUND_Y;

export const TOWER_ENTRY_ZONE_WIDTH = 30;
export const TOWER_ENTRY_ZONE_HEIGHT = 90;
export const TOWER_EXIT_X_OFFSET = 20;

/** How many of the latest shots keep their trail (settings drawer, 0 = no trails, up to MAX_ARROW_TRAILS). */
export const DEFAULT_ARROW_TRAILS = 1;
export const MAX_ARROW_TRAILS = 3;

export const ARROW_RELEASE_Y = 0;
export const ARROW_SPEED_FACTOR = 1.6;
export const ARROW_BASE_SPEED = 180;
export const ARROW_FORCE_SPEED = 450;
export const ARROW_GRAVITY = 700;
/**
 * Quadratic air drag k (a = −k·|v|·v). 0.0005 makes a full-power shot lose ~30% speed in its first
 * second; terminal fall speed is √(ARROW_GRAVITY / k) ≈ 1180 px/s. Keep it small or arrows float.
 */
export const ARROW_DRAG = 0.0005;

export const ENEMY_SPEED = 30;
export const ENEMY_ATTACK_INTERVAL_MS = 2000;
export const PROJECTILE_DAMAGE = 20;
/** Damage multiplier when an arrow hits an enemy's head. */
export const HEADSHOT_DAMAGE_MULTIPLIER = 1.25;
export const EXPLOSION_RADIUS = 72;
/**
 * A fire dragon killed by a direct explosive hit blows up: the arrow's explosion this many times over (radius and
 * damage), in a cloud of fire, and the dragon and rider burst apart.
 */
export const FIRE_DRAGON_BLAST_POWER = 3;
/**
 * A kamikaze killed by a direct explosive hit sets its bomb off: the arrow's explosion this many times over (radius
 * and damage). A kamikaze blown apart (by that or its own bomb) throws its pieces KAMIKAZE_GIB_FORCE times harder.
 */
export const KAMIKAZE_BLAST_POWER = 2;
export const KAMIKAZE_GIB_FORCE = 1.8;
/**
 * Explosion damage by distance from the blast: `centre` at the middle (and for the enemy an explosive arrow hits
 * directly), falling off linearly to `edge` at EXPLOSION_RADIUS. The arrow itself does no damage.
 */
export const EXPLOSION_DAMAGE = { centre: 35, edge: 10 } as const;
/**
 * Shrapnel arrow: Space in flight bursts it into SHRAPNEL_FRAGMENTS small arrows fanned SHRAPNEL_SPREAD
 * radians apart around its heading, each dealing SHRAPNEL_FRAGMENT_DAMAGE × PROJECTILE_DAMAGE.
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
export const PIERCING_DAMAGE_MULTIPLIER = 0.62;
/**
 * Pinning arrow: an enemy it hits stays put this long (zombies longer; brutes and dragons can't be pinned), and
 * takes only a scratch, PIN_DAMAGE (random within the range, no headshot bonus).
 */
export const PIN_DURATION_MS = 10000;
export const PIN_DURATION_ZOMBIE_MS = 15000;
export const PIN_DAMAGE: readonly [number, number] = [0, 4];
export const ENEMY_TOWER_DAMAGE = 16;
/**
 * Fire arrow (systems/afflictions.ts, systems/ArrowMagic.ts): hits for FIRE_ARROW_DAMAGE × PROJECTILE_DAMAGE and
 * sets the enemy alight for ENEMY_BURN_MS (zombies × ENEMY_BURN_ZOMBIE_FACTOR; the fire dragon doesn't burn),
 * ENEMY_BURN_DPS dealt every BURN_TICK_MS. Each tick a burning enemy may set others within FIRE_SPREAD_RADIUS
 * alight (FIRE_SPREAD_CHANCE). In the ground it leaves a fire FIRE_PATCH_RADIUS wide for FIRE_PATCH_MS.
 */
export const FIRE_ARROW_DAMAGE = 0.3;
export const ENEMY_BURN_MS = 4000;
export const ENEMY_BURN_ZOMBIE_FACTOR = 1.5;
export const ENEMY_BURN_DPS = 5;
export const BURN_TICK_MS = 250;
export const FIRE_SPREAD_RADIUS = 32;
export const FIRE_SPREAD_CHANCE = 0.12;
export const FIRE_PATCH_MS = 3500;
export const FIRE_PATCH_RADIUS = 28;
/**
 * Frost arrow: hits for FROST_ARROW_DAMAGE × PROJECTILE_DAMAGE and chills for FROST_CHILL_MS (everything it does
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
 * Vortex arrow (systems/vortex.ts): where it lands a vortex opens for VORTEX_MS. It pulls ground enemies within
 * VORTEX_RADIUS to its centre (up to VORTEX_PULL_SPEED px/s), lifts them up the funnel (VORTEX_RISE_SPEED px/s)
 * and at VORTEX_TOP throws them up and out (VORTEX_THROW, px/s). Brutes are too heavy to be caught: inside its
 * reach they only walk at VORTEX_HEAVY_WALK of their pace. At
 * the end it dies away and flings out the ones it hasn't lifted yet (VORTEX_FLING). Thrown enemies fall under
 * THROW_GRAVITY and take FALL_DAMAGE on landing: perSpeed × how much faster than safeSpeed they hit the ground.
 * The arrow itself does no damage: an enemy it hits glows and levitates straight up (towards VORTEX_LEVITATE_HEIGHT
 * at VORTEX_LEVITATE_SPEED px/s, rising above the funnel) while the vortex lasts, then drops, taking VORTEX_LEVITATE_FALL × the fall damage.
 * Each further vortex arrow that hits it lifts it VORTEX_LEVITATE_BOOST px higher (at most VORTEX_LEVITATE_MAX); a
 * brute only rises VORTEX_LEVITATE_HEAVY as high.
 */
export const VORTEX_MS = 4200;
export const VORTEX_RADIUS = 150;
export const VORTEX_PULL_SPEED = 190;
export const VORTEX_HEAVY_WALK = 0.45;
export const VORTEX_RISE_SPEED = 85;
export const VORTEX_TOP = 130;
export const VORTEX_THROW = { up: [420, 560], side: [110, 260] } as const;
export const VORTEX_FLING = { up: [170, 260], side: [170, 290] } as const;
export const THROW_GRAVITY = 1100;
export const FALL_DAMAGE = { safeSpeed: 220, perSpeed: 0.025 } as const;
export const VORTEX_LEVITATE_SPEED = 110;
export const VORTEX_LEVITATE_HEIGHT = 280;
export const VORTEX_LEVITATE_FALL = 0.5;
export const VORTEX_LEVITATE_BOOST = 110;
export const VORTEX_LEVITATE_MAX = 400;
export const VORTEX_LEVITATE_HEAVY = 0.15;
/**
 * A vortex arrow hitting a dragon: a ring of wind swirls round it for DRAGON_TURBULENCE_MS and it's buffeted
 * (DRAGON_BUFFET: px sideways and up and down, tilt in radians). Meanwhile the fire dragon can't breathe fire and
 * the dragon archer's rider shoots DRAGON_TURBULENCE_SPREAD times as wide.
 */
export const DRAGON_TURBULENCE_MS = 4200;
export const DRAGON_TURBULENCE_SPREAD = 4;
export const DRAGON_BUFFET = { x: 14, y: 20, tilt: 0.16 } as const;
/** Enemy archers: stop and shoot from this distance, draw time, pause between shots, aim error. */
export const ENEMY_ARCHER_RANGE = 340;
export const ENEMY_ARCHER_DRAW_MS = 900;
export const ENEMY_ARCHER_COOLDOWN_MS = 1700;
export const ENEMY_ARCHER_SPREAD = 0.07;
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
 * damage for BURN_DURATION_MS after the flames last touched him; staying in the fire keeps relighting it.
 */
export const BURN_DURATION_MS = 4000;
export const BURN_DAMAGE_PER_S = 3;
/** Dragon drawn at this scale (its art is ~300 px long with the tail). */
export const DRAGON_SCALE = 0.42;
export const ENEMY_GROUND_Y = GROUND_Y;


export const WALK_ACCELERATION = 600;
export const SPRINT_ACCELERATION = 185;
export const WALK_DECELERATION = 1100;
export const SPRINT_DECELERATION = 480;
/** Sprint top speed as a multiple of walking speed (120 px/s → 270 px/s). */
export const SPRINT_MAX_MULTIPLIER = 2.25;
export const JUMP_SPEED = 594;
/** Bowman gravity: with JUMP_SPEED this gives a ~80 px jump lasting ~0.54 s. */
export const GRAVITY = 2200;
/**
 * A kamikaze blast knocks the bowman down (stickmanFall's knockback, then getUp): the fall throws him back
 * ~22 px by itself, plus a slide of up to `pushMax` px (scaled by closeness, from `minStrength` at the edge).
 * He lies `lieMs` before getting up, and the animations play `animationSpeed`× faster than the enemies'.
 */
/**
 * Friendly fire (settings drawer, on by default): the players' arrows and what they do (blasts, fire, frost,
 * vortices, pins) hit the bowmen out in the open as they hit enemies. An arrow spares the bowman who loosed it for
 * its first FRIENDLY_FIRE_GRACE_MS (it leaves the bow inside his hit box).
 */
export const FRIENDLY_FIRE_GRACE_MS = 200;
export const BOWMAN_KNOCKBACK = { pushMax: 40, minStrength: 0.35, lieMs: 250, animationSpeed: 1.3 } as const;
export const JUMP_BUFFER_MS = 110;

/** The enemy keep's health in every sandbox run (destroying it wins immediately). */
export const ENEMY_KEEP_HEALTH = 650;
/** Time between enemies of a wave appearing, and the pause before the first one. */
/**
 * A wave arrives in groups (systems/waveDirector.ts): the first one after WAVE_START_DELAY_MS, its enemies
 * WAVE_SPAWN_INTERVAL_MS apart. The next group comes once at most GROUP_RELEASE_ALIVE enemies are left
 * standing and GROUP_MIN_GAP_MS have passed since the last spawn, or after GROUP_MAX_GAP_MS regardless.
 */
export const WAVE_SPAWN_INTERVAL_MS = 1100;
export const WAVE_START_DELAY_MS = 1500;
export const GROUP_RELEASE_ALIVE = 1;
export const GROUP_MIN_GAP_MS = 2500;
export const GROUP_MAX_GAP_MS = 15000;
/** Group sizes: the first FIRST_GROUP_SIZE, each next one bigger by one, up to MAX_GROUP_SIZE. */
export const FIRST_GROUP_SIZE = 2;
export const MAX_GROUP_SIZE = 5;

/** Sound effects: default effects volume (0..1) and the base volume of each sound. */
export const SOUND_DEFAULT_VOLUME = 0.7;
export const SOUND_VOLUMES = { bowShot: 0.7, groan: 0.75, explosion: 1, thunder: 1, shrapnelBurst: 0.6 } as const;
/** Base playback rate per sound (thunder is the explosion recording slowed down). */
export const SOUND_RATES: Partial<Record<keyof typeof SOUND_VOLUMES, number>> = { thunder: 0.5, shrapnelBurst: 1.7 };
/** Theme music volume (0..1), loop range in the file (see MusicPlayer) and fade time when toggled. */
export const MUSIC_DEFAULT_VOLUME = 0.35;
export const MUSIC_LOOP_START_S = 10.5;
export const MUSIC_LOOP_END_S = 228;
export const MUSIC_FADE_S = 1.2;
/** Each play is pitched randomly by ±this fraction so repeats don't sound identical. */
export const SOUND_PITCH_VARIATION = 0.07;
/** At most this many copies of one sound play at once (piercing hits, volleys). */
export const SOUND_MAX_VOICES = 6;
/** Sounds at the screen edge pan this far; off-screen ones fade to SOUND_MIN_GAIN over one screen width. */
export const SOUND_MAX_PAN = 0.6;
export const SOUND_MIN_GAIN = 0.2;

/**
 * Lightning (storm battlegrounds): a strike every LIGHTNING_INTERVAL_MS (random in the range); only
 * LIGHTNING_GROUND_CHANCE of them reach the ground, after a LIGHTNING_WARNING_MS crackle at the spot.
 * A ground strike hurts everyone within LIGHTNING_RADIUS (the bowman is safe inside the keep).
 */
export const LIGHTNING_INTERVAL_MS: readonly [number, number] = [5000, 11000];
export const LIGHTNING_FIRST_DELAY_MS = 4000;
export const LIGHTNING_GROUND_CHANCE = 0.4;
export const LIGHTNING_WARNING_MS = 700;
export const LIGHTNING_DAMAGE = 30;
export const LIGHTNING_RADIUS = 38;

/** Light rain during storms: number of streaks, fall speed range (px/s), sideways drift per px fallen, opacity. */
export const RAIN_DROPS = 90;
export const RAIN_SPEED: readonly [number, number] = [620, 820];
export const RAIN_SLANT = 0.22;
export const RAIN_ALPHA = 0.28;

/** Snowfall: number of flakes, fall speed range (px/s), and how much of the wind (px/s²) becomes drift (px/s). */
export const SNOW_FLAKES = 110;
export const SNOW_SPEED: readonly [number, number] = [40, 85];
export const SNOW_WIND_DRIFT = 0.35;

// Enable with ?debug in the URL.
export const SHOW_HITBOX_DEBUG = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('debug');
