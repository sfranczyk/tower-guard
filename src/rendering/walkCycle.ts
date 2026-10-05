/**
 * Walk knee bend for one leg, in drawStickman's IK convention: negative pushes the knee forward,
 * positive pushes it backwards (hyperextension), so walking never goes above zero.
 *
 * `progress` is 0..1 through the current half cycle; `swinging` says whether this leg is in the air.
 * Both phases meet at WALK_KNEE_MIN_BEND so the knee never pops at the stance/swing boundary.
 */
export const WALK_KNEE_MIN_BEND = -0.15;
/** Extra soft flex while the leg takes the body's weight (peaks mid-stance). */
const STANCE_FLEX = 0.2;
/** Extra flex while the leg swings through (peaks mid-swing). */
const SWING_FLEX = 0.8;

export const walkKneeBend = (progress: number, swinging: boolean): number =>
  WALK_KNEE_MIN_BEND - Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI) * (swinging ? SWING_FLEX : STANCE_FLEX);
