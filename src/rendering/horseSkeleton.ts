import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import { rotateAbout as rotate } from '../utils/math';
import { HUMAN_BODY } from './bodyColors';
import { getHorsePose, type HorseGait, type HorseLeg, type HorsePose } from './horseRider';
import type { LanceHold } from './horseSeat';
import { drawJointPose, drawRearLeg } from './stickmanPose';

const BONE = HUMAN_BODY.bone;
const REAR = HUMAN_BODY.boneRear;
const HORSE_FILL = 0x46666a;

/** Draws the horse and rider (skeleton look) into `sprite` (cleared first, hip of a standing stickman at the origin). */
export const drawHorseRider = (sprite: Graphics, timeMs: number, gait: HorseGait, lance?: LanceHold): HorsePose => {
  const pose = getHorsePose(timeMs, gait, lance);
  drawHorsePose(sprite, pose);
  return pose;
};

/** Draws `pose` (skeleton look; cleared first): the horse and, unless `riderless`, its rider with the reins and lance. */
export const drawHorsePose = (sprite: Graphics, pose: HorsePose, riderless = false): void => {
  sprite.clear();
  sprite.rotation = 0;
  sprite.y = 0;
  const line = (a: Vec2, b: Vec2, color: number, width: number): void => {
    sprite.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width, color, cap: 'round', join: 'round' });
  };
  /** A body part: filled a shade lighter than the lab's slate (so it hides what's behind it), outlined in bone. */
  const part = (points: readonly Vec2[]): void => {
    sprite.poly(points.flatMap((point) => [point.x, point.y])).fill({ color: HORSE_FILL }).stroke({ width: 2.5, color: BONE, join: 'round' });
  };
  const drawLeg = ({ root, joint, hoof }: HorseLeg, color: number): void => {
    line(root, joint, color, 4);
    line(joint, hoof, color, 3.5);
    sprite.circle(joint.x, joint.y, 3).stroke({ width: 1.5, color });
    // The hoof: a short block on the ground.
    sprite.roundRect(hoof.x - 4, hoof.y - 3, 9, 5, 1.5).fill({ color });
  };

  // Far side first: the far legs, the tail and the rider's far leg.
  drawLeg(pose.farHind, REAR);
  drawLeg(pose.farFore, REAR);
  pose.tail.forEach((end, strand) => {
    sprite.moveTo(pose.croup.x, pose.croup.y)
      .quadraticCurveTo(pose.croup.x - 14, pose.croup.y + 4 + strand * 2, end.x, end.y)
      .stroke({ width: 2.2 - strand * 0.4, color: REAR, cap: 'round' });
  });
  if (!riderless) {
    drawRearLeg(sprite, pose.rider);
  }

  // The body: barrel, neck and head outlined, mane, ear and eye.
  const { centre, rx, ry, angle } = pose.barrel;
  const barrel = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    return rotate({ x: centre.x + Math.cos(a) * rx, y: centre.y + Math.sin(a) * ry }, centre, angle);
  });
  part([pose.withers, pose.poll, pose.forehead, pose.muzzle, pose.nose, pose.chin, pose.throat, pose.chest]);
  part(barrel);
  // The neck runs into the barrel without a seam.
  sprite.poly([pose.withers, pose.chest, pose.barrel.centre].flatMap((point) => [point.x, point.y])).fill({ color: HORSE_FILL });
  for (let tuft = 0; tuft < 4; tuft += 1) {
    const t = 0.2 + tuft * 0.2;
    const base = { x: pose.withers.x + (pose.poll.x - pose.withers.x) * t, y: pose.withers.y + (pose.poll.y - pose.withers.y) * t };
    line(base, { x: base.x - 7, y: base.y + 2 }, REAR, 2);
  }
  const ear = { x: pose.poll.x + 1, y: pose.poll.y - 9 };
  line(pose.poll, ear, BONE, 2.5);
  const eye = { x: pose.forehead.x + (pose.muzzle.x - pose.forehead.x) * 0.22, y: pose.forehead.y + (pose.muzzle.y - pose.forehead.y) * 0.22 + 4 };
  sprite.circle(eye.x, eye.y, 1.8).fill({ color: BONE });

  drawLeg(pose.nearHind, BONE);
  drawLeg(pose.nearFore, BONE);
  if (riderless) {
    return;
  }
  // The reins, from the bit to the hands.
  line(pose.mouth, pose.lance ? pose.rider.rearHand : pose.rider.frontHand, 0xe3ad4f, 1.5);
  drawJointPose(sprite, pose.rider, 0, { append: true, hideRearLeg: true });
  if (pose.lance) {
    line(pose.lance.butt, pose.lance.tip, BONE, 2.5);
  }
};
