import type { Vec2 } from '../types';
import type { ArcherRig } from './archer';
import { GIB_GROUND_Y } from './stickmanGibs';
import { STICKMAN_HEAD } from './stickman';
import type { JointPose } from './stickmanPose';

/**
 * The dragon's rider thrown off when the dragon is killed (pure, sprite space, ground at GIB_GROUND_Y):
 * he flies backwards with his arms and legs flung out, tumbles onto his back and ends lying flat, every
 * limb on the ground. His bow flies off on its own and lands flat too.
 */

/** Gravity of everything falling in the dragon deaths (sprite units/s²). */
export const DEATH_GRAVITY = 1700;

/** Time (s) until something thrown with vy0 from y0 falls to `floor`. */
export const landingTime = (y0: number, vy0: number, floor: number): number =>
  (-vy0 + Math.sqrt(vy0 * vy0 + 2 * DEATH_GRAVITY * Math.max(0, floor - y0))) / DEATH_GRAVITY;

const THROW = { vx: -230, vy: -230 };
/** Lying on his back: the torso points backwards (−x) and he faces up. */
const LYING_ROTATION = -Math.PI / 2;
/** Half a bone's line width: bones lying on the ground sit this far above it. */
const BONE = 1.5;
export const RIDER_LYING_HIP = GIB_GROUND_Y - BONE;
const SPRAWL_MS = 220;
const SETTLE_MS = 260;
const BOW_THROW = { vx: -110, vy: -260 };

/**
 * Body angles in drawStickman's limb convention (0 = down, +π/2 = forward, π = up), each segment absolute.
 * `headTurn` tips the head off the torso line (towards the back is negative).
 */
interface BodyAngles {
  torso: number;
  headTurn: number;
  frontUpper: number;
  frontFore: number;
  rearUpper: number;
  rearFore: number;
  frontThigh: number;
  frontShin: number;
  rearThigh: number;
  rearShin: number;
}

const ANGLE_KEYS = ['torso', 'headTurn', 'frontUpper', 'frontFore', 'rearUpper', 'rearFore', 'frontThigh', 'frontShin', 'rearThigh', 'rearShin'] as const;

/** Flung out in the air: arms thrown up, legs apart. `flail` (−1..1) waves the limbs. */
const sprawled = (flail: number): BodyAngles => ({
  torso: Math.PI,
  headTurn: 0,
  frontUpper: 2.2 + flail * 0.25,
  frontFore: 2.7 + flail * 0.35,
  rearUpper: -2.1 - flail * 0.25,
  rearFore: -2.6 - flail * 0.3,
  frontThigh: 0.65 - flail * 0.15,
  frontShin: 0.2 - flail * 0.2,
  rearThigh: -0.55 + flail * 0.15,
  rearShin: -0.85 + flail * 0.2,
});

/**
 * Lying flat on his back (in the unrotated frame "up" is the ground side's normal, so every joint keeps
 * x ≥ 0): one arm flopped above the head, the other along the body, legs out straight, head resting
 * on the back of the skull.
 */
const FLAT: BodyAngles = {
  torso: Math.PI,
  headTurn: -0.5,
  frontUpper: Math.PI - 0.12,
  frontFore: Math.PI - 0.04,
  rearUpper: 0.12,
  rearFore: 0.04,
  frontThigh: 0.06,
  frontShin: 0.02,
  rearThigh: 0.12,
  rearShin: -0.06,
};

const limbAngle = (from: Vec2, to: Vec2): number => Math.atan2(to.x - from.x, to.y - from.y);
const distance = (a: Vec2, b: Vec2): number => Math.hypot(b.x - a.x, b.y - a.y);
const limb = (from: Vec2, angle: number, length: number): Vec2 => ({ x: from.x + Math.sin(angle) * length, y: from.y + Math.cos(angle) * length });
/** Shortest-way blend between two angles. */
const blendAngle = (a: number, b: number, t: number): number => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

const anglesOf = (pose: JointPose): BodyAngles => ({
  torso: limbAngle(pose.hip, pose.shoulder),
  headTurn: limbAngle(pose.shoulder, pose.head) - limbAngle(pose.hip, pose.shoulder),
  frontUpper: limbAngle(pose.shoulder, pose.frontElbow),
  frontFore: limbAngle(pose.frontElbow, pose.frontHand),
  rearUpper: limbAngle(pose.shoulder, pose.rearElbow),
  rearFore: limbAngle(pose.rearElbow, pose.rearHand),
  frontThigh: limbAngle(pose.hip, pose.frontKnee),
  frontShin: limbAngle(pose.frontKnee, pose.frontFoot),
  rearThigh: limbAngle(pose.hip, pose.rearKnee),
  rearShin: limbAngle(pose.rearKnee, pose.rearFoot),
});

const blendAngles = (a: BodyAngles, b: BodyAngles, t: number): BodyAngles =>
  Object.fromEntries(ANGLE_KEYS.map((key) => [key, blendAngle(a[key], b[key], t)])) as unknown as BodyAngles;

/** Rebuilds a pose with the hip at the origin from angles and the segment lengths of `model`. */
const buildPose = (model: JointPose, angles: BodyAngles): JointPose => {
  const hip = { x: 0, y: 0 };
  const shoulder = limb(hip, angles.torso, distance(model.hip, model.shoulder));
  const headAngle = angles.torso + angles.headTurn;
  const frontElbow = limb(shoulder, angles.frontUpper, distance(model.shoulder, model.frontElbow));
  const rearElbow = limb(shoulder, angles.rearUpper, distance(model.shoulder, model.rearElbow));
  const frontKnee = limb(hip, angles.frontThigh, distance(model.hip, model.frontKnee));
  const rearKnee = limb(hip, angles.rearThigh, distance(model.hip, model.rearKnee));
  return {
    hip,
    shoulder,
    neckTop: limb(shoulder, headAngle, distance(model.shoulder, model.neckTop)),
    head: limb(shoulder, headAngle, distance(model.shoulder, model.head)),
    frontElbow,
    frontHand: limb(frontElbow, angles.frontFore, distance(model.frontElbow, model.frontHand)),
    rearElbow,
    rearHand: limb(rearElbow, angles.rearFore, distance(model.rearElbow, model.rearHand)),
    frontKnee,
    frontFoot: limb(frontKnee, angles.frontShin, distance(model.frontKnee, model.frontFoot)),
    rearKnee,
    rearFoot: limb(rearKnee, angles.rearShin, distance(model.rearKnee, model.rearFoot)),
    frontShinAngle: angles.frontShin,
    rearShinAngle: angles.rearShin,
  };
};

const POINT_KEYS = ['hip', 'shoulder', 'neckTop', 'head', 'frontKnee', 'frontFoot', 'rearKnee', 'rearFoot', 'frontElbow', 'frontHand', 'rearElbow', 'rearHand'] as const;

/** Rotates a hip-centred pose by `rotation` and moves the hip to `at`. */
const placePose = (pose: JointPose, rotation: number, at: Vec2): JointPose => {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const placed = { ...pose };
  POINT_KEYS.forEach((key) => {
    const { x, y } = pose[key];
    placed[key] = { x: at.x + x * cos - y * sin, y: at.y + x * sin + y * cos };
  });
  // Shin angles turn the opposite way to the screen rotation (see drawRearLeg's toe direction).
  placed.frontShinAngle = pose.frontShinAngle - rotation;
  placed.rearShinAngle = pose.rearShinAngle - rotation;
  return placed;
};

/** Lowest point of a pose (head circle included). */
const lowestPoint = (pose: JointPose): number =>
  Math.max(...POINT_KEYS.filter((key) => key !== 'head').map((key) => pose[key].y + BONE), pose.head.y + STICKMAN_HEAD.radius);

/** Moves a pose up so nothing sinks into the ground. */
const keepAboveGround = (pose: JointPose): JointPose => {
  const sink = lowestPoint(pose) - GIB_GROUND_Y;
  if (sink <= 0) {
    return pose;
  }
  const up = { ...pose };
  POINT_KEYS.forEach((key) => {
    up[key] = { x: pose[key].x, y: pose[key].y - sink };
  });
  return up;
};

export interface ThrownRider {
  pose: JointPose;
  /** 0 = in the saddle, 1 = limbs flung out. */
  sprawl: number;
  /** 0 = in the air, 1 = lying flat. */
  flat: number;
  landed: boolean;
}

/**
 * The rider `sinceMs` after the dragon was hit. `seated` is his pose at the hit, in sprite space: he's
 * thrown backwards and up, flings his limbs out, tumbles onto his back and settles flat.
 */
export const thrownRider = (seated: JointPose, sinceMs: number): ThrownRider => {
  const t = Math.max(0, sinceMs) / 1000;
  const land = landingTime(seated.hip.y, THROW.vy, RIDER_LYING_HIP);
  const flying = Math.min(t, land);
  const hip = {
    x: seated.hip.x + THROW.vx * flying,
    y: seated.hip.y + THROW.vy * flying + (DEATH_GRAVITY * flying * flying) / 2,
  };
  const sprawl = smooth(sinceMs / SPRAWL_MS);
  const landed = t >= land;
  const flat = landed ? smooth(((t - land) * 1000) / SETTLE_MS) : 0;
  // The flailing stops as he lands.
  const flail = Math.sin(sinceMs / 70) * (1 - flat);
  const angles = blendAngles(blendAngles(anglesOf(seated), sprawled(flail), sprawl), FLAT, flat);
  const rotation = LYING_ROTATION * Math.min(1, t / land);
  return { pose: keepAboveGround(placePose(buildPose(seated, angles), rotation, hip)), sprawl, flat, landed };
};

export interface ThrownBow {
  bowTop: Vec2;
  bowBottom: Vec2;
  bowControl: Vec2;
}

/** The rider's bow flying off on its own, tumbling and landing flat. `rig` is in sprite space. */
export const thrownBow = (rig: ArcherRig, sinceMs: number): ThrownBow => {
  const center = { x: (rig.bowTop.x + rig.bowBottom.x) / 2, y: (rig.bowTop.y + rig.bowBottom.y) / 2 };
  const axis = Math.atan2(rig.bowBottom.y - rig.bowTop.y, rig.bowBottom.x - rig.bowTop.x);
  // Lying flat means its axis is horizontal: a forward tumble of between a half and a whole turn.
  const restRotation = (((-axis % Math.PI) + Math.PI) % Math.PI) + Math.PI;
  const t = Math.max(0, sinceMs) / 1000;
  const land = landingTime(center.y, BOW_THROW.vy, GIB_GROUND_Y - 4);
  const flying = Math.min(t, land);
  const at = {
    x: center.x + BOW_THROW.vx * flying,
    y: center.y + BOW_THROW.vy * flying + (DEATH_GRAVITY * flying * flying) / 2,
  };
  const rotation = restRotation * Math.min(1, t / land);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const move = (point: Vec2): Vec2 => {
    const x = point.x - center.x;
    const y = point.y - center.y;
    return { x: at.x + x * cos - y * sin, y: at.y + x * sin + y * cos };
  };
  const bow = { bowTop: move(rig.bowTop), bowBottom: move(rig.bowBottom), bowControl: move(rig.bowControl) };
  // The limb curve's lowest point (quadratic midpoint) and both tips stay on or above the ground.
  const middle = (bow.bowTop.y + 2 * bow.bowControl.y + bow.bowBottom.y) / 4;
  const sink = Math.max(bow.bowTop.y, bow.bowBottom.y, middle) + 2.5 - GIB_GROUND_Y;
  if (sink > 0) {
    bow.bowTop.y -= sink;
    bow.bowBottom.y -= sink;
    bow.bowControl.y -= sink;
  }
  return bow;
};
