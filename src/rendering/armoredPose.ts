import type { Vec2 } from '../types';
import { LOWERED_ANGLE, LOWERED_ELBOW, LOWERED_GRIP, getArcherRig, type ArcherRig } from './archer';
import { getFallPose, type FallKind } from './stickmanFall';
import type { JointPose } from './stickmanPose';

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
