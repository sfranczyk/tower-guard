import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../../types';
import { HORSE_GROUND_Y, type HorseLeg, type HorsePose } from '../horseRider';
import type { BodyPose } from './bodyPoses';
import { ellipsePoints, limb, mix, shape } from './designShapes';
import { blackKnightLook } from './knightSkins';
import { drawHumanoid } from './skinKit';

/**
 * The mounted knight's look (the game's horseKnight and the design lab): a black warhorse under a dark red caparison,
 * a steel chamfron with a spike and an ember eye, and the black knight in the saddle with a lance. Drawn over a
 * HorsePose (rendering/horseRider.ts), so the gaits, the thrust and the hit zones are the lab's.
 */

const COAT = 0x232027;
const COAT_FAR = 0x141217;
const COAT_LIGHT = 0x37323d;
const MANE = 0x0c0b0e;
const HOOF = 0x0a090b;
const CLOTH = 0x6e1a1f;
const CLOTH_DARK = 0x45100f;
const CLOTH_TRIM = 0x1a1a1f;
const STEEL = 0x2a2c33;
const STEEL_EDGE = 0x50545f;
const EMBER = 0xff5a3c;
const LEATHER = 0x3b2a20;
const WOOD = 0x8a6440;
const WOOD_LIGHT = 0xb48a5c;

const turn = (point: Vec2, about: Vec2, angle: number): Vec2 => {
  const dx = point.x - about.x;
  const dy = point.y - about.y;
  return { x: about.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: about.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
};

/** A point in the barrel's frame (x along the body, y down), from its centre. */
const onBarrel = (pose: HorsePose, x: number, y: number): Vec2 =>
  turn({ x: pose.barrel.centre.x + x, y: pose.barrel.centre.y + y }, pose.barrel.centre, pose.barrel.angle);

const leg = (g: Graphics, { root, joint, hoof }: HorseLeg, color: number): void => {
  limb(g, root, joint, 11, 6.5, color);
  limb(g, joint, hoof, 5.5, 4.5, color);
  // A tuft of feathering above the hoof, then the hoof.
  limb(g, mix(joint, hoof, 0.78), { x: hoof.x - 1, y: hoof.y - 3 }, 6, 6.5, MANE);
  g.roundRect(hoof.x - 4.5, hoof.y - 3.5, 10, 5, 1.5).fill({ color: HOOF });
};

/** Tail strands from the croup, thick at the root. */
const tail = (g: Graphics, pose: HorsePose): void => {
  pose.tail.forEach((end, strand) => {
    g.moveTo(pose.croup.x, pose.croup.y)
      .quadraticCurveTo(pose.croup.x - 15, pose.croup.y + 3 + strand * 2, end.x, end.y + 4)
      .stroke({ width: 6 - strand * 1.4, color: MANE, cap: 'round' });
  });
};

/** Barrel, haunch and shoulder, neck and head in the coat; the mane along the crest. */
const horseBody = (g: Graphics, pose: HorsePose): void => {
  const { centre, rx, ry, angle } = pose.barrel;
  shape(g, ellipsePoints(centre, rx, ry, 28, angle), COAT);
  shape(g, ellipsePoints(onBarrel(pose, -26, -2), 19, 19, 20, angle), COAT);
  shape(g, ellipsePoints(onBarrel(pose, 30, 0), 15, 17, 20, angle), COAT);
  shape(g, [pose.withers, pose.poll, pose.forehead, pose.muzzle, pose.nose, pose.chin, pose.throat, pose.chest, centre], COAT);
  // Light on the crest of the neck and the cheek.
  shape(g, [pose.withers, mix(pose.withers, pose.poll, 0.85), mix(pose.throat, pose.withers, 0.35)], COAT_LIGHT, 0.5);
  shape(g, ellipsePoints(mix(pose.throat, pose.forehead, 0.45), 7, 5, 12, Math.atan2(pose.muzzle.y - pose.poll.y, pose.muzzle.x - pose.poll.x)), COAT_LIGHT, 0.55);
  for (let tuft = 0; tuft < 5; tuft += 1) {
    const base = mix(pose.withers, pose.poll, 0.1 + tuft * 0.2);
    limb(g, base, { x: base.x - 8, y: base.y + 6 }, 5, 2, MANE);
  }
  // The ears, laid back.
  limb(g, pose.poll, { x: pose.poll.x - 4, y: pose.poll.y - 9 }, 4.5, 1.5, COAT);
};

/** A steel face plate with a spike on the forehead and an ember eye through it; the bridle. */
const chamfron = (g: Graphics, pose: HorsePose, timeMs: number): void => {
  const top = mix(pose.poll, pose.forehead, 0.5);
  const nose = mix(pose.forehead, pose.muzzle, 0.82);
  const lower = mix(pose.chin, pose.throat, 0.35);
  shape(g, [top, pose.forehead, nose, mix(nose, pose.nose, 0.5), mix(pose.chin, nose, 0.4), lower], STEEL);
  limb(g, mix(pose.forehead, nose, 0.1), mix(pose.forehead, nose, 0.9), 1.6, 1.2, STEEL_EDGE, 0.8);
  const spikeBase = mix(pose.forehead, nose, 0.18);
  shape(g, [{ x: spikeBase.x - 2, y: spikeBase.y }, { x: spikeBase.x + 5, y: spikeBase.y - 11 }, { x: spikeBase.x + 4, y: spikeBase.y + 1 }], STEEL_EDGE);
  const eye = { x: mix(pose.forehead, pose.muzzle, 0.25).x, y: mix(pose.forehead, pose.muzzle, 0.25).y + 4 };
  const glow = 0.7 + 0.3 * Math.sin(timeMs / 230);
  g.circle(eye.x, eye.y, 3.6).fill({ color: EMBER, alpha: 0.35 * glow });
  g.circle(eye.x, eye.y, 1.7).fill({ color: 0xffb07a });
  // Nostril and bridle.
  g.circle(pose.nose.x - 2, pose.nose.y - 3, 1.3).fill({ color: HOOF });
  limb(g, mix(pose.poll, pose.throat, 0.15), pose.mouth, 1.6, 1.6, LEATHER);
  g.circle(pose.mouth.x, pose.mouth.y, 1.8).fill({ color: STEEL_EDGE });
};

/** The caparison: a dark red cloth over the barrel to below the belly, scalloped and swaying, and the saddle on it. */
const caparison = (g: Graphics, pose: HorsePose, timeMs: number, empty: boolean): void => {
  const sway = (k: number): number => Math.sin(timeMs / 170 - k) * 1.6;
  // The cloth hangs down to its hem; on a horse lying on the ground it lies flat there (rendering/horseDeath).
  const hanging = (point: Vec2): Vec2 => ({ x: point.x, y: Math.min(point.y, HORSE_GROUND_Y - 1) });
  const hem = Array.from({ length: 9 }, (_, i) => {
    const x = 36 - i * 10;
    return hanging(onBarrel(pose, x + sway(i) * 0.6, 24 + (i % 2) * 3 + sway(i)));
  });
  const cloth = [onBarrel(pose, 30, -16), onBarrel(pose, 36, 6), ...hem, onBarrel(pose, -46, 4), onBarrel(pose, -42, -14), onBarrel(pose, -8, -21)];
  shape(g, cloth, CLOTH);
  // A dark border along the hem and a stripe down from the saddle.
  hem.slice(0, -1).forEach((point, i) => limb(g, point, hem[i + 1], 3, 3, CLOTH_TRIM));
  shape(g, [onBarrel(pose, 6, -20), onBarrel(pose, 13, -19), hanging(onBarrel(pose, 11, 26 + sway(3))), hanging(onBarrel(pose, 3, 26 + sway(3)))], CLOTH_DARK);
  // The saddle and its cantle; a stirrup leather (the rider's foot is in it).
  shape(g, [onBarrel(pose, -20, -21), onBarrel(pose, -22, -30), onBarrel(pose, -14, -24), onBarrel(pose, 14, -24), onBarrel(pose, 20, -30), onBarrel(pose, 18, -18), onBarrel(pose, -16, -16)], LEATHER);
  if (empty) {
    const stirrup = hanging(onBarrel(pose, 14 + sway(1), 14));
    limb(g, onBarrel(pose, 8, -18), stirrup, 1.6, 1.6, LEATHER);
    g.roundRect(stirrup.x - 3.5, stirrup.y, 7, 4, 1.5).fill({ color: STEEL_EDGE });
  }
};

/** A lance: a long tapering wooden shaft, a steel cone guarding the fist, a steel point and a red pennant under it. */
export const drawLance = (g: Graphics, butt: Vec2, tip: Vec2, timeMs: number, grip: Vec2): void => {
  const length = Math.hypot(tip.x - butt.x, tip.y - butt.y) || 1;
  const d = { x: (tip.x - butt.x) / length, y: (tip.y - butt.y) / length };
  const point = (distance: number, side = 0): Vec2 => ({ x: butt.x + d.x * distance - d.y * side, y: butt.y + d.y * distance + d.x * side });
  limb(g, butt, point(length - 10), 6, 3.4, WOOD);
  limb(g, point(4, -0.8), point(length * 0.7, -0.5), 1.6, 1, WOOD_LIGHT, 0.85);
  // The pennant flutters back from just behind the point.
  const flap = Math.sin(timeMs / 110) * 2.5;
  const root = length - 26;
  shape(g, [point(root, 0), point(root - 18, 6 + flap), point(root - 10, 9 + flap), point(root - 22, 13 + flap * 1.4), point(root - 2, 6)], CLOTH);
  shape(g, [point(length - 13, -3.4), point(length, 0), point(length - 13, 3.4)], 0xa9b0ba);
  limb(g, point(length - 11), point(length - 2), 0.8, 0.5, 0xe4e8ee);
  // The vamplate just in front of the fist.
  const fist = (grip.x - butt.x) * d.x + (grip.y - butt.y) * d.y;
  shape(g, [point(fist + 2, -3), point(fist + 12, -8), point(fist + 13, 8), point(fist + 2, 3)], STEEL);
  limb(g, point(fist + 12, -7), point(fist + 12, 7), 1.6, 1.6, STEEL_EDGE);
};

export interface MountedKnightOptions {
  /** No rider: the horse bolted after throwing him (the reins hang, the stirrup swings). */
  riderless?: boolean;
}

/**
 * Draws the mounted knight in `pose` (no clear): the far legs and the tail, the horse and its caparison, the near legs,
 * the reins, then the black knight astride (his far leg hidden) with the lance in his near fist.
 */
export const drawMountedKnight = (g: Graphics, pose: HorsePose, timeMs: number, options: MountedKnightOptions = {}): void => {
  const { riderless = false } = options;
  leg(g, pose.farHind, COAT_FAR);
  leg(g, pose.farFore, COAT_FAR);
  tail(g, pose);
  horseBody(g, pose);
  caparison(g, pose, timeMs, riderless);
  chamfron(g, pose, timeMs);
  leg(g, pose.nearHind, COAT);
  leg(g, pose.nearFore, COAT);
  if (riderless) {
    // The reins hang from the bit over the neck.
    g.moveTo(pose.mouth.x, pose.mouth.y).quadraticCurveTo(pose.chest.x, pose.chest.y + 6, pose.withers.x + 4, pose.withers.y + 6)
      .stroke({ width: 1.3, color: LEATHER });
    return;
  }
  const { rider, lance } = pose;
  g.moveTo(rider.rearHand.x, rider.rearHand.y).lineTo(pose.mouth.x, pose.mouth.y).stroke({ width: 1.3, color: LEATHER });
  const look = blackKnightLook(timeMs);
  const body: BodyPose = { ...rider };
  drawHumanoid(g, body, {
    ...look,
    hideFarLeg: true,
    heldNear: lance ? (target) => drawLance(target, lance.butt, lance.tip, timeMs, rider.frontHand) : undefined,
  });
};
