/** View, battlefield and ground layout. */
import { DEV_TOOLS } from '../core/devTools';

/**
 * The view (screen) in game px: always GAME_HEIGHT tall and at least GAME_WIDTH wide (~2.14:1). A wider
 * window, or one big enough to pass MAX_VIEW_SCALE, widens the view (more landscape) instead of scaling
 * everything up, up to MAX_VIEW_WIDTH (see core/viewport.ts).
 */
export const GAME_WIDTH = 1455;
export const GAME_HEIGHT = 680;
export const MAX_VIEW_WIDTH = 2270;
/**
 * World y at the view's bottom and top edge. The ground and scenery were laid out for a view bottom at 540 and a
 * 590 tall view; the view is now zoomed out ~15% (680 tall), showing 30 px more ground and 60 px more sky. World y 0 sits -VIEW_TOP below the top
 * of the screen (scenery containers and the battle camera are moved down by that much).
 */
export const VIEW_BOTTOM = 570;
export const VIEW_TOP = VIEW_BOTTOM - GAME_HEIGHT;
/** Largest on-screen scale (CSS px per game px) before the view widens instead of growing. */
export const MAX_VIEW_SCALE = 1.2;
/** Upper limit of the renderer resolution (backing pixels per game px) for big windows and browser zoom. */
export const MAX_RENDER_RESOLUTION = 4;
/**
 * The battlefield of a battle level, keep to keep (independent of the view width); the camera follows the bowman across
 * it. A survival level is shorter (SURVIVAL_WORLD_WIDTH). At run time ask systems/battlefield.ts (`worldWidth()`).
 * The view never gets wider than the field (DomUi.limitViewWidth): a wider window shows bars beside the canvas.
 */
export const WORLD_WIDTH = 2400;
/** A survival level's field: there is no enemy keep, only the spot one would stand on (`enemyKeepX()`). */
export const SURVIVAL_WORLD_WIDTH = 2100;
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
/** The enemy keep stands this far in from the battlefield's right end (`enemyKeepX()`; survival has no keep). */
export const KEEP_INSET = 160;
/** The enemy keep on a battle level's battlefield; at run time `enemyKeepX()`. */
export const ENEMY_TOWER_X = WORLD_WIDTH - KEEP_INSET;
export const BOWMAN_START_X = 250;
export const BOWMAN_Y = GROUND_Y;

/** Jumping within this zone under the keep (centred on it, about its footprint) takes the bowman inside. */
export const TOWER_ENTRY_ZONE_WIDTH = 100;
export const TOWER_ENTRY_ZONE_HEIGHT = 90;

// Enable with ?debug in the URL (not in the release build, core/devTools.ts).
export const SHOW_HITBOX_DEBUG = DEV_TOOLS && typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('debug');
