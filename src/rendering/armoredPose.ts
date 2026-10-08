import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import { LOWERED_ANGLE, LOWERED_ELBOW, LOWERED_GRIP, getArcherRig, type ArcherRig } from './archer';
import { ARMOR_COLORS, type ArmorPalette, drawArmor, drawArmoredBow, drawHood, drawPauldron, drawQuiver } from './armor';
import { STICKMAN_HEAD } from './stickman';
import { getFallPose, type FallKind } from './stickmanFall';
import type { JointPose } from './stickmanPose';

/** Armored limbs are this much thicker than the skeleton's (as in drawStickman). */
const WIDTH_SCALE = 2.3;

/** The bow sits at this angle to the bow arm's forearm, as when carried lowered (drawStickman's archer). */
const BOW_TO_FOREARM = LOWERED_ANGLE - Math.atan2(LOWERED_GRIP.y - LOWERED_ELBOW.y, LOWERED_GRIP.x - LOWERED_ELBOW.x);
/** Last part of getting up, in which the bow arm moves to where the standing archer carries the bow. */
const BOW_ARM_BLEND_FROM = 0.7;
/** Shoulder of the upright stickman in sprite space (hip at the origin). */
const UPRIGHT_SHOULDER: Vec2 = { x: 0, y: -35 };

/** Angle of a bone from `from` to `to` as a sprite rotation (0 = pointing up). */
const uprightAngle = (from: Vec2, to: Vec2): number => Math.atan2(to.x - from.x, from.y - to.y);

/** Turns the bone `from`→`to` towards `from`→`target` (angle and length blended), so it never stretches. */
const blendBone = (from: Vec2, to: Vec2, target: Vec2, t: number): Vec2 => {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const targetAngle = Math.atan2(target.y - from.y, target.x - from.x);
  const turn = Math.atan2(Math.sin(targetAngle - angle), Math.cos(targetAngle - angle));
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const targetLength = Math.hypot(target.x - from.x, target.y - from.y);
  const blended = angle + turn * t;
  const blendedLength = length + (targetLength - length) * t;
  return { x: from.x + Math.cos(blended) * blendedLength, y: from.y + Math.sin(blended) * blendedLength };
};

/**
 * A fall pose for the armored archer: stickmanFall's pose, with the bow arm brought to the lowered-bow
 * carry over the end of getting up, so the standing archer (drawStickman) takes over without a jump.
 */
export const armoredFallPose = (kind: FallKind, progress: number): JointPose => {
  const pose = getFallPose(kind, progress);
  if (kind !== 'getUp' || progress <= BOW_ARM_BLEND_FROM) {
    return pose;
  }
  const s = Math.min(1, (progress - BOW_ARM_BLEND_FROM) / (1 - BOW_ARM_BLEND_FROM));
  const t = s * s * (3 - 2 * s);
  // The carry is authored for an upright torso (shoulder at 0,-35 above the hip): turn it with the torso,
  // which is still leaning while he gets up, and hang it from the shoulder.
  const torso = uprightAngle(pose.hip, pose.shoulder);
  const cos = Math.cos(torso);
  const sin = Math.sin(torso);
  const fromShoulder = (point: Vec2): Vec2 => {
    const x = point.x - UPRIGHT_SHOULDER.x;
    const y = point.y - UPRIGHT_SHOULDER.y;
    return { x: pose.shoulder.x + x * cos - y * sin, y: pose.shoulder.y + x * sin + y * cos };
  };
  const rearElbow = blendBone(pose.shoulder, pose.rearElbow, fromShoulder(LOWERED_ELBOW), t);
  // The forearm moves along with the elbow, then turns towards the carried hand.
  const forearmFrom = { x: rearElbow.x + pose.rearHand.x - pose.rearElbow.x, y: rearElbow.y + pose.rearHand.y - pose.rearElbow.y };
  const elbowCarried = fromShoulder(LOWERED_ELBOW);
  const handCarried = fromShoulder(LOWERED_GRIP);
  const handTarget = { x: rearElbow.x + handCarried.x - elbowCarried.x, y: rearElbow.y + handCarried.y - elbowCarried.y };
  return { ...pose, rearElbow, rearHand: blendBone(rearElbow, forearmFrom, handTarget, t) };
};

/** The archer rig at rest (string not drawn), moved so its grip sits in `hand`, the bow turned to `angle`. */
const bowInHand = (hand: Vec2, angle: number): ArcherRig => {
  const rig = getArcherRig(0, 0, 1);
  const grip = rig.woodHand;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const move = (point: Vec2): Vec2 => ({
    x: hand.x + (point.x - grip.x) * cos - (point.y - grip.y) * sin,
    y: hand.y + (point.x - grip.x) * sin + (point.y - grip.y) * cos,
  });
  return {
    woodHand: hand,
    woodElbow: move(rig.woodElbow),
    stringHand: move(rig.stringHand),
    stringElbow: move(rig.stringElbow),
    stringNock: move(rig.stringNock),
    bowTop: move(rig.bowTop),
    bowBottom: move(rig.bowBottom),
    bowControl: move(rig.bowControl),
  };
};

/** The bow in the rear (bow) hand of a fall pose, at the angle it's carried to the forearm. */
export const bowInRearHand = (pose: JointPose): ArcherRig => {
  const forearm = Math.atan2(pose.rearHand.y - pose.rearElbow.y, pose.rearHand.x - pose.rearElbow.x);
  return bowInHand(pose.rearHand, forearm + BOW_TO_FOREARM);
};

/**
 * Draws a joint pose (falls, getting up) with the player's armored archer look: thick dark limbs, quiver,
 * armor and hood turned with the torso and head, and the bow still in the rear (bow) hand.
 * Same sprite space as drawJointPose.
 */
export const drawArmoredJointPose = (sprite: Graphics, pose: JointPose, originY = 0, colors: ArmorPalette = ARMOR_COLORS): void => {
  sprite.clear();
  sprite.rotation = 0;
  sprite.x = 0;
  sprite.y = originY;

  const line = (a: Vec2, b: Vec2, isRear: boolean, width = 3.5): void => {
    sprite.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({
      width: (isRear ? width - 0.5 : width) * WIDTH_SCALE,
      color: isRear ? colors.limbRear : colors.limb,
      cap: 'round',
      join: 'round',
    });
  };
  const endpoint = (point: Vec2, isRear: boolean): void => {
    sprite.circle(point.x, point.y, 4.5).fill({ color: isRear ? colors.limbRear : colors.limb });
  };
  const leg = (knee: Vec2, foot: Vec2, shinAngle: number, isRear: boolean): void => {
    line(pose.hip, knee, isRear);
    line(knee, foot, isRear);
    endpoint(foot, isRear);
    const toe = { x: Math.cos(shinAngle), y: -Math.sin(shinAngle) };
    line({ x: foot.x - toe.x * 2, y: foot.y - toe.y * 2 }, { x: foot.x + toe.x * 9, y: foot.y + toe.y * 9 }, isRear, 3);
  };
  const arm = (elbow: Vec2, hand: Vec2, isRear: boolean): void => {
    line(pose.shoulder, elbow, isRear);
    line(elbow, hand, isRear);
    endpoint(hand, isRear);
  };
  /** Draws `draw` in a frame at `origin` turned by `angle` (armor pieces are authored upright). */
  const inFrame = (origin: Vec2, angle: number, draw: () => void): void => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    sprite.save();
    sprite.setTransform(cos, sin, -sin, cos, origin.x, origin.y);
    draw();
    sprite.restore();
  };

  const torso = uprightAngle(pose.hip, pose.shoulder);
  const head = uprightAngle(pose.shoulder, pose.neckTop);
  const forearm = Math.atan2(pose.rearHand.y - pose.rearElbow.y, pose.rearHand.x - pose.rearElbow.x);

  // Back to front, as drawStickman's armored archer: rear leg and bow arm, quiver, torso, front leg,
  // armor, hood, front arm, shoulder plate.
  leg(pose.rearKnee, pose.rearFoot, pose.rearShinAngle, true);
  arm(pose.rearElbow, pose.rearHand, true);
  drawArmoredBow(sprite, bowInHand(pose.rearHand, forearm + BOW_TO_FOREARM), 0, colors);
  inFrame(pose.hip, torso, () => drawQuiver(sprite, colors));
  line(pose.hip, pose.shoulder, false);
  leg(pose.frontKnee, pose.frontFoot, pose.frontShinAngle, false);
  inFrame(pose.hip, torso, () => drawArmor(sprite, colors));
  inFrame(pose.head, head, () => drawHood(sprite, { x: 0, y: 0, radius: STICKMAN_HEAD.radius }, colors));
  arm(pose.frontElbow, pose.frontHand, false);
  inFrame(pose.shoulder, torso, () => drawPauldron(sprite, { x: 0, y: 0 }, colors));
};
