export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 540;
export const RENDER_SCALE = 1;
export const WORLD_WIDTH = GAME_WIDTH * 1.171875;
export const CAMERA_ZOOM = 1;

export const GROUND_Y = 490;
export const PLAYER_TOWER_X = 70;
export const ENEMY_TOWER_X = WORLD_WIDTH - 70;
export const BOWMAN_START_X = 160;
export const BOWMAN_Y = GROUND_Y;

export const TOWER_ENTRY_ZONE_WIDTH = 30;
export const TOWER_ENTRY_ZONE_HEIGHT = 90;
export const TOWER_EXIT_X_OFFSET = 20;

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

export const ENEMY_SPEED = 40;
export const ENEMY_HEALTH = 20;
export const ENEMY_ATTACK_INTERVAL_MS = 2000;
export const ENEMY_HIT_DAMAGE = 10;
export const PROJECTILE_DAMAGE = 20;
/** Damage multiplier when an arrow hits an enemy's head. */
export const HEADSHOT_DAMAGE_MULTIPLIER = 2;
export const EXPLOSION_RADIUS = 72;
export const EXPLOSION_DAMAGE = 14;
export const PIERCING_DAMAGE_MULTIPLIER = 0.62;
export const ENEMY_TOWER_DAMAGE = 16;
/** Enemy archers: stop and shoot from this distance, draw time, pause between shots, aim error. */
export const ENEMY_ARCHER_RANGE = 340;
export const ENEMY_ARCHER_DRAW_MS = 900;
export const ENEMY_ARCHER_COOLDOWN_MS = 1700;
export const ENEMY_ARCHER_SPREAD = 0.07;
/** Draw power (0..1) of enemy shots and the damage they deal to the bowman or the keep. */
export const ENEMY_ARROW_POWER = 0.75;
export const ENEMY_ARROW_DAMAGE = 8;
export const ENEMY_GROUND_Y = GROUND_Y;


export const WALK_ACCELERATION = 600;
export const SPRINT_ACCELERATION = 185;
export const WALK_DECELERATION = 1100;
export const SPRINT_DECELERATION = 480;
/** Sprint top speed as a multiple of walking speed (120 px/s → 270 px/s). */
export const SPRINT_MAX_MULTIPLIER = 2.25;
export const JUMP_SPEED = 420;
/** Bowman gravity: with JUMP_SPEED this gives a ~40 px jump lasting ~0.38 s. */
export const GRAVITY = 2200;
export const JUMP_BUFFER_MS = 110;

/** The enemy keep's health in every sandbox run (destroying it wins immediately). */
export const ENEMY_KEEP_HEALTH = 650;
/** Time between enemies of a wave appearing, and the pause before the first one. */
export const WAVE_SPAWN_INTERVAL_MS = 900;
export const WAVE_START_DELAY_MS = 800;

/** Sound effects: default effects volume (0..1) and the base volume of each sound. */
export const SOUND_DEFAULT_VOLUME = 0.7;
export const SOUND_VOLUMES = { bowShot: 0.7, groan: 0.75, explosion: 1 } as const;
/** Theme music volume (0..1), loop range in the file (see MusicPlayer) and fade time when toggled. */
export const MUSIC_DEFAULT_VOLUME = 0.35;
export const MUSIC_LOOP_START_S = 10.5;
export const MUSIC_LOOP_END_S = 228;
export const MUSIC_FADE_S = 1.2;
/** Each play is pitched randomly by ±this fraction so repeats don't sound identical. */
export const SOUND_PITCH_VARIATION = 0.07;
/** At most this many copies of one sound play at once (piercing hits, volleys). */
export const SOUND_MAX_VOICES = 4;
/** Sounds at the screen edge pan this far; off-screen ones fade to SOUND_MIN_GAIN over one screen width. */
export const SOUND_MAX_PAN = 0.6;
export const SOUND_MIN_GAIN = 0.2;

// Enable with ?debug in the URL.
export const SHOW_HITBOX_DEBUG = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('debug');
