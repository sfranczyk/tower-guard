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

export const ENEMY_SPEED = 40;
export const ENEMY_HEALTH = 20;
export const ENEMY_ATTACK_INTERVAL_MS = 2000;
export const ENEMY_HIT_DAMAGE = 10;
export const PROJECTILE_DAMAGE = 20;
export const EXPLOSION_RADIUS = 72;
export const EXPLOSION_DAMAGE = 14;
export const PIERCING_DAMAGE_MULTIPLIER = 0.62;
export const ENEMY_TOWER_DAMAGE = 16;
export const ENEMY_GROUND_Y = GROUND_Y;

export const TOTAL_LEVEL_ENEMIES = 10;

export const WALK_ACCELERATION = 600;
export const SPRINT_ACCELERATION = 185;
export const WALK_DECELERATION = 1100;
export const SPRINT_DECELERATION = 480;
export const SPRINT_MAX_MULTIPLIER = 3;
export const JUMP_SPEED = 420;
export const GRAVITY = 1100;
export const JUMP_BUFFER_MS = 110;

export const TOWER_MAX_HEALTH = 570;

// Enable with ?debug in the URL.
export const SHOW_HITBOX_DEBUG = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('debug');
