import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import { STICKMAN_HEAD } from './stickman';

/**
 * One-shot falling animations for the skeleton stickman, driven by progress 0..1:
 * - death: buckles at the knees, kneels and collapses face down where it stood;
 * - knockback: thrown a short distance backwards (−x), lands and ends lying on its back.
 *
 * Sprite space matches drawStickman with originY 0: hip starts at (0, 0), facing +x, and the
 * ground is at y ≈ 58. Mirror with sprite.scale.x for the other direction.
 */
export type FallKind = 'death' | 'knockback';

export const FALL_DURATION_MS: Readonly<Record<FallKind, number>> = {
  death: 1000,
  knockback: 900,
};

const THIGH = 30;
const SHIN = 30;
const UPPER_ARM = 21;
const FOREARM = 21;
const TORSO = 35;
const NECK = 8;
/** Shoulder to head centre (17), matching drawStickman's proportions. */
const HEAD_OFFSET = -STICKMAN_HEAD.y - TORSO;

/**
 * Angles in radians. Limbs: 0 = pointing straight down, +π/2 = forward (+x), −π/2 = backward.
 * Torso: 0 = upright, +π/2 = lying forward, −π/2 = lying backward. Head tilts relative to the torso.
 */
interface FallKeyframe {
  t: number;
  hip: Vec2;
  torso: number;
  head: number;
  frontThigh: number;
  frontShin: number;
  rearThigh: number;
  rearShin: number;
  frontUpper: number;
  frontFore: number;
  rearUpper: number;
  rearFore: number;
}

/** Matches drawStickman's standing pose (feet at ±16, soft knees forward) so a fall starts seamlessly. */
const STANDING: Omit<FallKeyframe, 't'> = {
  hip: { x: 0, y: 0 },
  torso: 0,
  head: 0,
  frontThigh: 0.39,
  frontShin: 0.17,
  rearThigh: -0.17,
  rearShin: -0.39,
  frontUpper: 0.1,
  frontFore: 0.3,
  rearUpper: 0.1,
  rearFore: 0.3,
};

const KEYFRAMES: Readonly<Record<FallKind, FallKeyframe[]>> = {
  death: [
    { t: 0, ...STANDING },
    {
      // Hit: knees buckle and the upper body folds forward.
      t: 0.3, hip: { x: -2, y: 9.5 }, torso: 0.45, head: 0.35,
      frontThigh: 0.8, frontShin: -0.4, rearThigh: 0.45, rearShin: -0.75,
      frontUpper: 0.5, frontFore: 0.7, rearUpper: 0.3, rearFore: 0.6,
    },
    {
      // Drops to the knees, slumping forward with the arms hanging.
      t: 0.6, hip: { x: 0, y: 29.5 }, torso: 0.9, head: 0.4,
      frontThigh: 0.5, frontShin: -1.45, rearThigh: 0.3, rearShin: -1.5,
      frontUpper: 0.3, frontFore: 0.2, rearUpper: 0.15, rearFore: 0.1,
    },
    {
      // Knees stay planted while the hips tip forward over them; arms reach out to break the fall.
      t: 0.72, hip: { x: 8, y: 27 }, torso: 1.15, head: 0.3,
      frontThigh: -0.1, frontShin: -1.56, rearThigh: -0.15, rearShin: -1.56,
      frontUpper: 1.0, frontFore: 0.5, rearUpper: 0.7, rearFore: 0.8,
    },
    {
      // Hands reach the ground as the body goes down.
      t: 0.86, hip: { x: 2, y: 41 }, torso: 1.4, head: 0.15,
      frontThigh: -0.95, frontShin: -1.56, rearThigh: -0.9, rearShin: -1.56,
      frontUpper: 1.3, frontFore: 1.0, rearUpper: 1.1, rearFore: 1.2,
    },
    {
      // Face down on the ground, legs stretched back.
      t: 1, hip: { x: -4, y: 49 }, torso: 1.52, head: 0.05,
      frontThigh: -1.48, frontShin: -1.52, rearThigh: -1.42, rearShin: -1.5,
      frontUpper: 1.75, frontFore: 1.45, rearUpper: 1.3, rearFore: 1.6,
    },
  ],
  knockback: [
    { t: 0, ...STANDING },
    {
      // Blast hits: recoils backwards, arms fly up.
      t: 0.12, hip: { x: -6, y: 2 }, torso: -0.45, head: -0.3,
      frontThigh: 0.35, frontShin: 0.25, rearThigh: 0.05, rearShin: -0.1,
      frontUpper: 1.9, frontFore: 2.3, rearUpper: 1.5, rearFore: 1.9,
    },
    {
      // In the air, tipping over backwards with the legs swinging forward.
      t: 0.45, hip: { x: 0, y: 0 }, torso: -1.0, head: -0.4,
      frontThigh: 1.1, frontShin: 0.4, rearThigh: 0.7, rearShin: 0.1,
      frontUpper: 2.6, frontFore: 2.9, rearUpper: 2.3, rearFore: 2.7,
    },
    {
      // Hits the ground on the back.
      t: 0.72, hip: { x: 0, y: 0 }, torso: -1.5, head: -0.2,
      frontThigh: 1.5, frontShin: 1.2, rearThigh: 1.3, rearShin: 1.2,
      frontUpper: -1.7, frontFore: -1.9, rearUpper: -1.4, rearFore: -1.5,
    },
    {
      // Lying on the back, one knee up.
      t: 1, hip: { x: -66, y: 47 }, torso: -1.53, head: -0.05,
      frontThigh: 1.45, frontShin: 1.55, rearThigh: 2.0, rearShin: 0.9,
      frontUpper: -1.65, frontFore: -1.3, rearUpper: -1.35, rearFore: -1.55,
    },
  ],
};

/** Knockback hip path: short recoil, a ballistic-looking arc backwards, then a small slide. */
const knockbackHip = (progress: number): Vec2 => {
  if (progress <= 0.12) {
    const s = smooth(progress / 0.12);
    return { x: -6 * s, y: 2 * s };
  }
  if (progress <= 0.72) {
    const s = (progress - 0.12) / 0.6;
    const control = -45;
    return {
      x: -6 + (-58 + 6) * s,
      y: (1 - s) ** 2 * 2 + 2 * (1 - s) * s * control + s ** 2 * 40,
    };
  }
  const s = smooth((progress - 0.72) / 0.28);
  return { x: -58 - 8 * s, y: 40 + 7 * s };
};

const smooth = (value: number): number => value * value * (3 - 2 * value);
const lerp = (a: number, b: number, amount: number): number => a + (b - a) * amount;
const limb = (from: Vec2, angle: number, length: number): Vec2 => ({
  x: from.x + Math.sin(angle) * length,
  y: from.y + Math.cos(angle) * length,
});

export interface FallPose {
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
  /** Shin directions, used to orient the feet. */
  frontShinAngle: number;
  rearShinAngle: number;
}

/** Joint positions for a fall animation at `progress` (0..1, clamped). Pure and testable. */
export const getFallPose = (kind: FallKind, progress: number): FallPose => {
  const p = Math.max(0, Math.min(1, progress));
  const frames = KEYFRAMES[kind];
  const nextIndex = Math.max(1, frames.findIndex((frame) => frame.t >= p));
  const from = frames[nextIndex - 1];
  const to = frames[nextIndex];
  const amount = smooth((p - from.t) / (to.t - from.t || 1));
  const mix = (key: Exclude<keyof FallKeyframe, 't' | 'hip'>): number => lerp(from[key], to[key], amount);

  const hip = kind === 'knockback'
    ? knockbackHip(p)
    : { x: lerp(from.hip.x, to.hip.x, amount), y: lerp(from.hip.y, to.hip.y, amount) };
  const torso = mix('torso');
  const up = { x: Math.sin(torso), y: -Math.cos(torso) };
  const shoulder = { x: hip.x + up.x * TORSO, y: hip.y + up.y * TORSO };
  const headAngle = torso + mix('head');
  const headUp = { x: Math.sin(headAngle), y: -Math.cos(headAngle) };
  const frontKnee = limb(hip, mix('frontThigh'), THIGH);
  const rearKnee = limb(hip, mix('rearThigh'), THIGH);
  const frontElbow = limb(shoulder, mix('frontUpper'), UPPER_ARM);
  const rearElbow = limb(shoulder, mix('rearUpper'), UPPER_ARM);

  return {
    hip,
    shoulder,
    neckTop: { x: shoulder.x + headUp.x * NECK, y: shoulder.y + headUp.y * NECK },
    head: { x: shoulder.x + headUp.x * HEAD_OFFSET, y: shoulder.y + headUp.y * HEAD_OFFSET },
    frontKnee,
    frontFoot: limb(frontKnee, mix('frontShin'), SHIN),
    rearKnee,
    rearFoot: limb(rearKnee, mix('rearShin'), SHIN),
    frontElbow,
    frontHand: limb(frontElbow, mix('frontFore'), FOREARM),
    rearElbow,
    rearHand: limb(rearElbow, mix('rearFore'), FOREARM),
    frontShinAngle: mix('frontShin'),
    rearShinAngle: mix('rearShin'),
  };
};

/** Draws a fall animation frame with the skeleton look (same colours and widths as drawStickman). */
export const drawStickmanFall = (sprite: Graphics, kind: FallKind, progress: number, originY = 0): void => {
  sprite.clear();
  sprite.rotation = 0;
  sprite.y = originY;
  const pose = getFallPose(kind, progress);
  const skeleton = 0xf4f7fb;
  const rear = 0xb7c1d1;

  const line = (a: Vec2, b: Vec2, isRear: boolean, width = 3.5): void => {
    sprite.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({
      width: isRear ? width - 0.5 : width,
      color: isRear ? rear : skeleton,
      cap: 'round',
      join: 'round',
    });
  };
  const joint = (point: Vec2, isRear: boolean): void => {
    sprite.circle(point.x, point.y, 3).stroke({ width: 1.5, color: isRear ? rear : skeleton });
  };
  const endpoint = (point: Vec2, isRear: boolean): void => {
    sprite.circle(point.x, point.y, 2.5).fill({ color: isRear ? rear : skeleton });
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

  leg(pose.rearKnee, pose.rearFoot, pose.rearShinAngle, true);
  arm(pose.rearElbow, pose.rearHand, true);
  line(pose.hip, pose.shoulder, false);
  joint(pose.hip, false);
  line(pose.shoulder, pose.neckTop, false);
  sprite.circle(pose.head.x, pose.head.y, STICKMAN_HEAD.radius).stroke({ width: 2, color: skeleton });
  leg(pose.frontKnee, pose.frontFoot, pose.frontShinAngle, false);
  arm(pose.frontElbow, pose.frontHand, false);
};
