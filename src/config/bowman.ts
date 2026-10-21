/** The bowman's movement, knockback and friendly fire. */
export const WALK_ACCELERATION = 600;
export const SPRINT_ACCELERATION = 185;
export const WALK_DECELERATION = 1100;
export const SPRINT_DECELERATION = 480;
/** The bowman's walking speed (px/s). */
export const BOWMAN_WALK_SPEED = 90;
/** Sprint top speed as a multiple of walking speed (90 px/s → 180 px/s). */
export const SPRINT_MAX_MULTIPLIER = 2;
export const JUMP_SPEED = 594;
/** Bowman gravity: with JUMP_SPEED this gives a ~80 px jump lasting ~0.54 s. */
export const GRAVITY = 2200;
/**
 * A kamikaze blast knocks the bowman down (stickmanFall's knockback, then getUp): the fall throws him back
 * ~22 px by itself, plus a slide of up to `pushMax` px (scaled by closeness, from `minStrength` at the edge).
 * He lies `lieMs` before getting up, and the animations play `animationSpeed`× faster than the enemies'.
 */
export const BOWMAN_KNOCKBACK = { pushMax: 40, minStrength: 0.35, lieMs: 250, animationSpeed: 1.3 } as const;
/**
 * Friendly fire (battle setup's Rules, on by default alone, off in co-op): the players' arrows and what they do (blasts, fire, frost,
 * vortices, pins) hit the bowmen out in the open as they hit enemies. An arrow spares the bowman who loosed it for
 * its first FRIENDLY_FIRE_GRACE_MS (it leaves the bow inside his hit box).
 */
export const FRIENDLY_FIRE_GRACE_MS = 200;
export const JUMP_BUFFER_MS = 110;
