import type { Graphics } from 'pixi.js';
import type { ArmorPalette } from './armor';
import { bowInRearHand } from './armoredPose';
import type { JointPose } from './stickmanPose';
import { bowmanBody } from './designs/bodyPoses';
import { rangerLook, wardenLook } from './designs/playerSkins';
import { drawHumanoid, type HumanoidLook } from './designs/skinKit';

/**
 * The player drawn in a look from the design lab: the ranger (player 1) or, in co-op, the keep warden
 * (player 2), coloured from the battleground's player palette. Same poses as drawStickman's armored archer.
 */
export type BowmanLook = 'ranger' | 'warden';

/** drawStickman's feet are 55 below the hip, the BodyPoses' 57: live poses are drawn this much higher. */
const LIVE_POSE_LIFT = 2;

const lookOf = (look: BowmanLook, palette: ArmorPalette | undefined, timeMs: number, moving: number): HumanoidLook =>
  look === 'ranger' ? rangerLook(timeMs, moving, palette) : wardenLook(palette);

export interface BowmanBodyState {
  /** drawStickman's walk phase (radians, one cycle = 2π). */
  phase: number;
  idleBlend: number;
  runningBlend: number;
  /** Aim angle in the sprite's own space (toArcherLocalAngle). */
  localAngle: number;
  tension: number;
  ready: number;
}

/** Standing, walking or sprinting with the bow (cleared first; sets the sprite's x and y like drawStickman). */
export const drawBowmanBody = (
  sprite: Graphics, look: BowmanLook, palette: ArmorPalette | undefined, state: BowmanBodyState, originY: number, timeMs: number,
): void => {
  sprite.clear();
  sprite.x = 0;
  sprite.y = originY - LIVE_POSE_LIFT;
  const pose = bowmanBody(state.phase / (Math.PI * 2), state.idleBlend, state.runningBlend, state.localAngle, state.tension, state.ready);
  drawHumanoid(sprite, pose, lookOf(look, palette, timeMs, 1 - state.idleBlend));
};

/** A fall pose (knocked down, getting up) with the bow still in the bow hand (sprite reset like drawJointPose). */
export const drawBowmanFall = (
  sprite: Graphics, look: BowmanLook, palette: ArmorPalette | undefined, pose: JointPose, originY: number, timeMs: number,
): void => {
  sprite.clear();
  sprite.rotation = 0;
  sprite.x = 0;
  sprite.y = originY;
  drawHumanoid(sprite, { ...pose, bow: { rig: bowInRearHand(pose), tension: 0 } }, lookOf(look, palette, timeMs, 0));
};
