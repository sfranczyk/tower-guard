import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import { HUMAN_BODY } from './bodyColors';
import { solveJoint } from './designs/designSkeleton';
import { drawJointPose, drawRearLeg, type JointPose } from './stickmanPose';

/**
 * A stickman riding a horse (animation lab; pure poses, tested): the horse in the skeleton look, side view facing +x,
 * hooves on the ground at HORSE_GROUND_Y like the stickman's feet, and the rider sitting astride, feet in the stirrups
 * and both hands on the reins. Two gaits: a four-beat walk and a gallop with a moment of suspension, the body rocking
 * and the head nodding with it. The horse moves on the spot (the lab doesn't scroll), so planted hooves slide back.
 */

export const HORSE_GROUND_Y = 58;

export type HorseGait = 'walk' | 'gallop';

/** Leg lengths: upper (to the knee or hock) and lower (cannon and pastern to the hoof). */
export const HORSE_LEG = { upper: 38, lower: 40 } as const;
/** The rider's limbs, as drawStickman's. */
export const RIDER_LIMBS = { thigh: 30, shin: 30, upperArm: 21, forearm: 21 } as const;

interface GaitSpec {
  cycleMs: number;
  /** Half the distance a planted hoof slides back. */
  stride: number;
  lift: number;
  /** Share of the cycle each hoof is on the ground. */
  stance: number;
  /** When each hoof lands (fraction of the cycle): near hind, far hind, near fore, far fore. */
  landings: { nearHind: number; farHind: number; nearFore: number; farFore: number };
  /** Body rise and fall (px), pitch (radians, + = nose down) and head nod (radians). */
  bob: number;
  pitch: number;
  nod: number;
  /** The rider leans forward this far (radians). */
  lean: number;
}

const GAITS: Readonly<Record<HorseGait, GaitSpec>> = {
  // Four beats, evenly spaced: hind, fore on the same side, the other hind, the other fore.
  walk: {
    cycleMs: 1200, stride: 15, lift: 12, stance: 0.62,
    landings: { nearHind: 0, nearFore: 0.25, farHind: 0.5, farFore: 0.75 },
    bob: 1.5, pitch: 0.012, nod: 0.07, lean: 0.06,
  },
  // Hind, hind, fore, fore, then all four off the ground.
  gallop: {
    cycleMs: 620, stride: 24, lift: 24, stance: 0.32,
    landings: { farHind: 0, nearHind: 0.1, farFore: 0.3, nearFore: 0.4 },
    bob: 4, pitch: 0.05, nod: 0.16, lean: 0.32,
  },
};

/** One leg: where it hangs from the body, the knee (fore) or hock (hind), and the hoof. */
export interface HorseLeg {
  root: Vec2;
  joint: Vec2;
  hoof: Vec2;
}

export interface HorsePose {
  nearFore: HorseLeg;
  farFore: HorseLeg;
  nearHind: HorseLeg;
  farHind: HorseLeg;
  /** The barrel (an ellipse): centre, radii and tilt. */
  barrel: { centre: Vec2; rx: number; ry: number; angle: number };
  withers: Vec2;
  chest: Vec2;
  croup: Vec2;
  poll: Vec2;
  throat: Vec2;
  forehead: Vec2;
  muzzle: Vec2;
  nose: Vec2;
  chin: Vec2;
  /** Where the reins meet the bit. */
  mouth: Vec2;
  /** Tail strands from the croup. */
  tail: Vec2[];
  rider: JointPose;
}

const smooth = (u: number): number => u * u * (3 - 2 * u);
const wrap = (p: number): number => ((p % 1) + 1) % 1;
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
const rotate = (point: Vec2, about: Vec2, angle: number): Vec2 => {
  const dx = point.x - about.x;
  const dy = point.y - about.y;
  return { x: about.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: about.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
};
const shinAngle = (knee: Vec2, foot: Vec2): number => Math.atan2(foot.x - knee.x, foot.y - knee.y);

/** A hoof `sinceLanding` (cycles) after it landed: planted and sliding back, then lifted and swung forward. */
const hoofAt = (sinceLanding: number, rootX: number, { stride, lift, stance }: GaitSpec): Vec2 => {
  const q = wrap(sinceLanding);
  if (q < stance) {
    return { x: rootX + stride * (1 - (2 * q) / stance), y: HORSE_GROUND_Y };
  }
  const u = (q - stance) / (1 - stance);
  return { x: rootX - stride + 2 * stride * smooth(u), y: HORSE_GROUND_Y - lift * Math.sin(Math.PI * u) };
};

/** The body's frame (before bob and pitch): the horse stands with its back at about y -38. */
const BODY = {
  centre: { x: -4, y: -20 },
  fore: { x: 26, y: -8 },
  hind: { x: -30, y: -9 },
  withers: { x: 18, y: -38 },
  chest: { x: 44, y: -14 },
  croup: { x: -40, y: -36 },
  saddle: { x: 2, y: -42 },
  stirrup: { x: 10, y: 4 },
} as const;
/** The neck and head, nodding about the withers. */
const HEAD = {
  poll: { x: 52, y: -80 },
  throat: { x: 62, y: -60 },
  forehead: { x: 60, y: -85 },
  muzzle: { x: 88, y: -62 },
  nose: { x: 87, y: -54 },
  chin: { x: 76, y: -52 },
  mouth: { x: 79, y: -55 },
} as const;

/** The horse and its rider `timeMs` into the `gait` (pure). */
export const getHorsePose = (timeMs: number, gait: HorseGait): HorsePose => {
  const spec = GAITS[gait];
  const p = wrap(timeMs / spec.cycleMs);
  const cycle = Math.PI * 2 * p;
  // Walk: a little dip with each of the four beats; gallop: up during the suspension, down on the hind landing.
  const rise = gait === 'walk' ? spec.bob * Math.cos(cycle * 4) : spec.bob * Math.cos(cycle - Math.PI * 1.55);
  const pitch = spec.pitch * (gait === 'walk' ? Math.sin(cycle * 2) : Math.sin(cycle + 0.6));
  const nod = spec.nod * (gait === 'walk' ? Math.sin(cycle * 2) : Math.sin(cycle - 1.2));
  const pivot = add(BODY.centre, { x: 0, y: -rise });
  const body = (point: Vec2): Vec2 => rotate(add(point, { x: 0, y: -rise }), pivot, pitch);
  const withers = body(BODY.withers);
  const head = (point: Vec2): Vec2 => rotate(body(point), withers, nod);

  const leg = (rootAt: Vec2, landing: number, bend: 1 | -1): HorseLeg => {
    const root = body(rootAt);
    const hoof = hoofAt(p - landing, rootAt.x, spec);
    return { root, joint: solveJoint(root, hoof, HORSE_LEG.upper, HORSE_LEG.lower, bend), hoof };
  };
  const { landings } = spec;
  const croup = body(BODY.croup);
  const swish = Math.sin(cycle + 0.8) * (gait === 'gallop' ? 7 : 3);
  const tail = [0, 1, 2].map((strand) => ({ x: croup.x - 16 - strand * 3 - swish * 0.5, y: croup.y + 30 + strand * 5 + swish * 0.3 }));

  return {
    // Knees bend forward, hocks back.
    nearFore: leg(BODY.fore, landings.nearFore, 1),
    farFore: leg({ x: BODY.fore.x - 4, y: BODY.fore.y }, landings.farFore, 1),
    nearHind: leg(BODY.hind, landings.nearHind, -1),
    farHind: leg({ x: BODY.hind.x - 4, y: BODY.hind.y }, landings.farHind, -1),
    barrel: { centre: body(BODY.centre), rx: 40, ry: 17, angle: pitch },
    withers,
    chest: body(BODY.chest),
    croup,
    poll: head(HEAD.poll),
    throat: head(HEAD.throat),
    forehead: head(HEAD.forehead),
    muzzle: head(HEAD.muzzle),
    nose: head(HEAD.nose),
    chin: head(HEAD.chin),
    mouth: head(HEAD.mouth),
    tail,
    rider: riderPose(body(BODY.saddle), body(BODY.stirrup), head(HEAD.mouth), spec.lean, cycle, gait),
  };
};

/** The rider astride: hip on the saddle, feet in the stirrups, hands on the reins between the shoulder and the bit. */
const riderPose = (saddle: Vec2, stirrup: Vec2, mouth: Vec2, lean: number, cycle: number, gait: HorseGait): JointPose => {
  // At the gallop he rises a little out of the saddle with each stride.
  const lift = gait === 'gallop' ? 2.5 * (1 + Math.cos(cycle - 0.4)) : 0;
  const hip = { x: saddle.x, y: saddle.y - lift };
  const tilt = lean + (gait === 'gallop' ? 0.04 * Math.sin(cycle) : 0.02 * Math.sin(cycle * 2));
  const up = (distance: number): Vec2 => ({ x: hip.x + Math.sin(tilt) * distance, y: hip.y - Math.cos(tilt) * distance });
  const shoulder = up(35);
  // The hands hold the reins about a third of the way from the shoulder to the bit, a little lower.
  const toward = (share: number, drop: number, back: number): Vec2 => ({
    x: shoulder.x + (mouth.x - shoulder.x) * share - back,
    y: shoulder.y + (mouth.y - shoulder.y) * share + drop,
  });
  const frontHand = toward(0.42, 14, 0);
  const rearHand = toward(0.42, 15, 3);
  const frontFoot = stirrup;
  const rearFoot = { x: stirrup.x - 3, y: stirrup.y - 1 };
  const frontKnee = solveJoint(hip, frontFoot, RIDER_LIMBS.thigh, RIDER_LIMBS.shin, 1);
  const rearKnee = solveJoint(hip, rearFoot, RIDER_LIMBS.thigh, RIDER_LIMBS.shin, 1);
  return {
    hip, shoulder, neckTop: up(43), head: up(52),
    frontKnee, frontFoot, rearKnee, rearFoot,
    frontElbow: solveJoint(shoulder, frontHand, RIDER_LIMBS.upperArm, RIDER_LIMBS.forearm, -1),
    frontHand,
    rearElbow: solveJoint(shoulder, rearHand, RIDER_LIMBS.upperArm, RIDER_LIMBS.forearm, -1),
    rearHand,
    frontShinAngle: shinAngle(frontKnee, frontFoot),
    rearShinAngle: shinAngle(rearKnee, rearFoot),
  };
};

const BONE = HUMAN_BODY.bone;
const REAR = HUMAN_BODY.boneRear;
const HORSE_FILL = 0x46666a;

/** Draws the horse and rider (skeleton look) into `sprite` (cleared first, hip of a standing stickman at the origin). */
export const drawHorseRider = (sprite: Graphics, timeMs: number, gait: HorseGait): HorsePose => {
  const pose = getHorsePose(timeMs, gait);
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
  drawRearLeg(sprite, pose.rider);

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
  // The reins, from the bit to the hands.
  line(pose.mouth, pose.rider.frontHand, 0xe3ad4f, 1.5);
  drawJointPose(sprite, pose.rider, 0, { append: true, hideRearLeg: true });
  return pose;
};
