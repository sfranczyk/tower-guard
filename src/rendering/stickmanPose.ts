import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import { STICKMAN_HEAD } from './stickman';

/**
 * A stickman as explicit joint positions, for one-shot and keyframed animations (falls, cheers)
 * that don't fit drawStickman's walk/run model. Sprite space as in drawStickman with originY 0:
 * hip at (0, 0) when standing, facing +x, ground at y ≈ 58.
 */
export interface JointPose {
  hip: Vec2;
  shoulder: Vec2;
  neckTop: Vec2;
  head: Vec2;
  frontKnee: Vec2;
  frontFoot: Vec2;
  rearKnee: Vec2;
  rearFoot: Vec2;
  frontElbow: Vec2;
  frontHand: Vec2;
  rearElbow: Vec2;
  rearHand: Vec2;
  /** Shin directions (0 = straight down, +π/2 = forward), used to orient the feet. */
  frontShinAngle: number;
  rearShinAngle: number;
}

export interface JointPoseOptions {
  /** Draw a club in the front hand along the forearm (like drawStickman's armed enemies). */
  club?: boolean;
  /** Draw on top of what's already in the sprite (no clear, no transform reset), e.g. a dragon's rider. */
  append?: boolean;
  /** Leave out the rear leg (e.g. a rider's far leg hidden behind the mount, drawn separately). */
  hideRearLeg?: boolean;
}

const SKELETON = 0xf4f7fb;
const REAR = 0xb7c1d1;

/** Draws only the rear leg of a pose (skeleton look), e.g. a rider's far leg before the mount's body. */
export const drawRearLeg = (sprite: Graphics, pose: JointPose): void => {
  const line = (a: Vec2, b: Vec2, width = 3): void => {
    sprite.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width, color: REAR, cap: 'round', join: 'round' });
  };
  line(pose.hip, pose.rearKnee);
  line(pose.rearKnee, pose.rearFoot);
  sprite.circle(pose.rearKnee.x, pose.rearKnee.y, 3).stroke({ width: 1.5, color: REAR });
  sprite.circle(pose.rearFoot.x, pose.rearFoot.y, 2.5).fill({ color: REAR });
  const toe = { x: Math.cos(pose.rearShinAngle), y: -Math.sin(pose.rearShinAngle) };
  line({ x: pose.rearFoot.x - toe.x * 2, y: pose.rearFoot.y - toe.y * 2 }, { x: pose.rearFoot.x + toe.x * 9, y: pose.rearFoot.y + toe.y * 9 }, 2.5);
};

/** Draws a joint pose with the skeleton look (same colours and widths as drawStickman). */
export const drawJointPose = (sprite: Graphics, pose: JointPose, originY = 0, options: JointPoseOptions = {}): void => {
  if (!options.append) {
    sprite.clear();
    sprite.rotation = 0;
    sprite.y = originY;
  }

  const line = (a: Vec2, b: Vec2, isRear: boolean, width = 3.5): void => {
    sprite.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({
      width: isRear ? width - 0.5 : width,
      color: isRear ? REAR : SKELETON,
      cap: 'round',
      join: 'round',
    });
  };
  const joint = (point: Vec2, isRear: boolean): void => {
    sprite.circle(point.x, point.y, 3).stroke({ width: 1.5, color: isRear ? REAR : SKELETON });
  };
  const endpoint = (point: Vec2, isRear: boolean): void => {
    sprite.circle(point.x, point.y, 2.5).fill({ color: isRear ? REAR : SKELETON });
  };
  const leg = (knee: Vec2, foot: Vec2, shinAngle: number, isRear: boolean): void => {
    line(pose.hip, knee, isRear);
    line(knee, foot, isRear);
    joint(knee, isRear);
    endpoint(foot, isRear);
    // Foot points "forward" relative to the shin, like drawStickman.
    const toe = { x: Math.cos(shinAngle), y: -Math.sin(shinAngle) };
    line({ x: foot.x - toe.x * 2, y: foot.y - toe.y * 2 }, { x: foot.x + toe.x * 9, y: foot.y + toe.y * 9 }, isRear, 3);
  };
  const arm = (elbow: Vec2, hand: Vec2, isRear: boolean): void => {
    line(pose.shoulder, elbow, isRear);
    line(elbow, hand, isRear);
    joint(elbow, isRear);
    endpoint(hand, isRear);
  };

  if (!options.hideRearLeg) {
    leg(pose.rearKnee, pose.rearFoot, pose.rearShinAngle, true);
  }
  arm(pose.rearElbow, pose.rearHand, true);
  line(pose.hip, pose.shoulder, false);
  joint(pose.hip, false);
  line(pose.shoulder, pose.neckTop, false);
  sprite.circle(pose.head.x, pose.head.y, STICKMAN_HEAD.radius).stroke({ width: 2, color: SKELETON });
  leg(pose.frontKnee, pose.frontFoot, pose.frontShinAngle, false);
  arm(pose.frontElbow, pose.frontHand, false);

  if (options.club) {
    const { frontElbow: elbow, frontHand: hand } = pose;
    const length = Math.hypot(hand.x - elbow.x, hand.y - elbow.y) || 1;
    const direction = { x: (hand.x - elbow.x) / length, y: (hand.y - elbow.y) / length };
    const from = { x: hand.x - direction.x * 8, y: hand.y - direction.y * 8 };
    const to = { x: hand.x + direction.x * 28, y: hand.y + direction.y * 28 };
    sprite.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: 5, color: 0x30243a, cap: 'round' });
    sprite.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: 2.5, color: 0xe3ad4f, cap: 'round' });
  }
};
