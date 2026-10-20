/** View, battlefield and ground layout. */
/**
 * The view (screen) in game px: always GAME_HEIGHT tall and at least GAME_WIDTH wide (~2.14:1). A wider
 * window, or one big enough to pass MAX_VIEW_SCALE, widens the view (more landscape) instead of scaling
 * everything up, up to MAX_VIEW_WIDTH (see core/viewport.ts).
 */
export const GAME_WIDTH = 1260;
export const GAME_HEIGHT = 590;
export const MAX_VIEW_WIDTH = 1970;
/**
 * World y at the view's bottom and top edge. The ground and scenery are laid out for a view bottom at 540, so
 * a taller view shows more sky: world y 0 sits -VIEW_TOP below the top of the screen (scenery containers and
 * the battle camera are moved down by that much).
 */
export const VIEW_BOTTOM = 540;
export const VIEW_TOP = VIEW_BOTTOM - GAME_HEIGHT;
/** Largest on-screen scale (CSS px per game px) before the view widens instead of growing. */
export const MAX_VIEW_SCALE = 1.4;
/** Upper limit of the renderer resolution (backing pixels per game px) for big windows and browser zoom. */
export const MAX_RENDER_RESOLUTION = 4;
/**
 * The battlefield of a battle level, keep to keep (independent of the view width); the camera follows the bowman across
 * it. A survival level is shorter (SURVIVAL_WORLD_WIDTH). At run time ask systems/battlefield.ts (`worldWidth()`).
 */
export const WORLD_WIDTH = 2400;
export const SURVIVAL_WORLD_WIDTH = 1800;
/**
 * Width of the backdrop behind menus, labs and the lobby (centred in the view), and of one stretch of the hills
 * drawing, which repeats (mirrored every other time) across the battlefield.
 */
export const BACKDROP_WIDTH = 1200;
/** Landscape (sky, hills, trees, ground) is drawn this far beyond both ends, for views wider than the backdrop. */
export const SCENERY_MARGIN = Math.max(0, Math.ceil((MAX_VIEW_WIDTH - BACKDROP_WIDTH) / 2)) + 40;

export const GROUND_Y = 490;
/** The ground surface waves up and down by this much around GROUND_Y (see systems/terrain.ts). */
export const TERRAIN_AMPLITUDE = 7;
export const PLAYER_TOWER_X = 160;
/** The enemy keep stands this far in from the battlefield's right end (`enemyKeepX()`). */
export const KEEP_INSET = 160;
/** The enemy keep on a battle level's battlefield; at run time `enemyKeepX()`. */
export const ENEMY_TOWER_X = WORLD_WIDTH - KEEP_INSET;
export const BOWMAN_START_X = 250;
export const BOWMAN_Y = GROUND_Y;

/** Jumping within this zone under the keep (centred on it, about its footprint) takes the bowman inside. */
export const TOWER_ENTRY_ZONE_WIDTH = 100;
export const TOWER_ENTRY_ZONE_HEIGHT = 90;

// Enable with ?debug in the URL.
export const SHOW_HITBOX_DEBUG = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('debug');
