import type { BodyColors } from './bodyColors';
import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import { STICKMAN_HEAD } from './stickman';
import { drawJointPose, type JointPose } from './stickmanPose';

/**
 * One-shot falling animations for the skeleton stickman, driven by progress 0..1:
 * - death: buckles at the knees, kneels and collapses face down where it stood;
 * - deathCrumple: recoils, the legs give way, sits down and falls onto its back;
 * - deathStiff: head snaps back and the rigid body topples backwards around the feet (headshot);
 * - knockback: thrown a short distance backwards (−x), lands and ends lying on its back;
 * - getUp: starts from knockback's final pose, sits up, pushes off and stands up again.
 *
 * Sprite space matches drawStickman with originY 0: hip starts at (0, 0), facing +x, and the
 * ground is at y ≈ 58. Mirror with sprite.scale.x for the other direction.
 */
export type FallKind = 'death' | 'deathCrumple' | 'deathStiff' | 'knockback' | 'getUp';

export const FALL_DURATION_MS: Readonly<Record<FallKind, number>> = {
  death: 1000,
  deathCrumple: 1100,
  deathStiff: 900,
  knockback: 900,
  getUp: 1100,
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

/** Keyframed kinds; deathStiff is computed analytically (see stiffFallFrame). */
const KEYFRAMES: Readonly<Record<Exclude<FallKind, 'deathStiff'>, FallKeyframe[]>> = {
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
  deathCrumple: [
    { t: 0, ...STANDING },
    {
      // Hit: recoils backwards, head thrown back, arms jerk forward.
      t: 0.2, hip: { x: -3, y: 3 }, torso: -0.3, head: -0.4,
      frontThigh: 0.3, frontShin: 0.25, rearThigh: -0.2, rearShin: -0.35,
      frontUpper: 0.9, frontFore: 1.3, rearUpper: 0.6, rearFore: 1.0,
    },
    {
      // Legs give way, sinking down with the head dropping forward.
      t: 0.5, hip: { x: -10, y: 23 }, torso: -0.15, head: 0.3,
      frontThigh: 1.4, frontShin: -0.1, rearThigh: 1.2, rearShin: -0.45,
      frontUpper: 0.4, frontFore: 0.5, rearUpper: 0.2, rearFore: 0.4,
    },
    {
      // Sits on the ground and starts tipping backwards.
      t: 0.72, hip: { x: -14, y: 48 }, torso: -0.8, head: 0.25,
      frontThigh: 2.0, frontShin: 0.55, rearThigh: 1.8, rearShin: 0.9,
      frontUpper: -0.9, frontFore: -0.7, rearUpper: -0.6, rearFore: -0.4,
    },
    {
      // Lying on the back, one knee still up, arms flopped back.
      t: 1, hip: { x: -16, y: 47 }, torso: -1.5, head: -0.1,
      frontThigh: 1.5, frontShin: 1.6, rearThigh: 2.2, rearShin: 0.7,
      frontUpper: -1.5, frontFore: -1.55, rearUpper: -1.25, rearFore: -1.45,
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
  getUp: [
    {
      // Same as knockback's last frame: lying on the back, one knee up.
      t: 0, hip: { x: -66, y: 47 }, torso: -1.53, head: -0.05,
      frontThigh: 1.45, frontShin: 1.55, rearThigh: 2.0, rearShin: 0.9,
      frontUpper: -1.65, frontFore: -1.3, rearUpper: -1.35, rearFore: -1.55,
    },
    {
      // Sits up halfway, propped on both hands behind, knees pulled in.
      t: 0.25, hip: { x: -66, y: 48 }, torso: -0.6, head: 0.2,
      frontThigh: 2.1, frontShin: 0.5, rearThigh: 2.3, rearShin: 0.3,
      frontUpper: -0.7, frontFore: -0.3, rearUpper: -0.5, rearFore: -0.2,
    },
    {
      // Sitting upright, feet planted, arms reaching forward.
      t: 0.5, hip: { x: -64, y: 46 }, torso: 0.5, head: 0,
      frontThigh: 2.4, frontShin: 0.2, rearThigh: 2.5, rearShin: 0.15,
      frontUpper: 1.2, frontFore: 1.6, rearUpper: 0.9, rearFore: 1.4,
    },
    {
      // Rocks forward into a crouch over the feet.
      t: 0.72, hip: { x: -52, y: 22 }, torso: 0.7, head: -0.1,
      frontThigh: 1.2, frontShin: -0.3, rearThigh: 1.0, rearShin: -0.75,
      frontUpper: 0.6, frontFore: 0.9, rearUpper: 0.4, rearFore: 0.8,
    },
    {
      // Rising out of the crouch with the feet kept on the ground.
      t: 0.86, hip: { x: -55, y: 10 }, torso: 0.35, head: 0,
      frontThigh: 0.8, frontShin: -0.15, rearThigh: 0.5, rearShin: -0.75,
      frontUpper: 0.35, frontFore: 0.6, rearUpper: 0.35, rearFore: 0.6,
    },
    // Standing again (same pose as drawStickman's idle stance).
    { t: 1, ...STANDING, hip: { x: -58, y: 0 } },
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

type FallFrame = Omit<FallKeyframe, 't'>;

/** Feet stay planted here while the rigid body rotates around them. */
const STIFF_PIVOT: Vec2 = { x: 0, y: 58 };
const STIFF_HIP_RADIUS = 58;
/** Final tilt: slightly short of horizontal so the head rests on the ground. */
const STIFF_LYING_ANGLE = 1.45;
/** Knee offset angle so a 30+30 leg spans exactly STIFF_HIP_RADIUS. */
const STIFF_KNEE = Math.acos(STIFF_HIP_RADIUS / (THIGH + SHIN));
const STIFF_FALL_START = 0.08;
const STIFF_IMPACT = 0.8;

/**
 * Rigid backwards topple: the head snaps back, then the whole body rotates around the feet with
 * gravity-like acceleration, lands and bounces slightly.
 */
const stiffFallFrame = (p: number): FallFrame => {
  let tilt: number;
  if (p < STIFF_FALL_START) {
    tilt = 0;
  } else if (p < STIFF_IMPACT) {
    tilt = STIFF_LYING_ANGLE * ((p - STIFF_FALL_START) / (STIFF_IMPACT - STIFF_FALL_START)) ** 2;
  } else {
    tilt = STIFF_LYING_ANGLE - 0.07 * Math.sin(Math.PI * (p - STIFF_IMPACT) / (1 - STIFF_IMPACT));
  }
  const snap = smooth(Math.min(1, p / 0.12));
  const relax = smooth(Math.max(0, Math.min(1, (p - 0.12) / (STIFF_IMPACT - 0.12))));
  // Arms float up a little while falling and settle along the body on impact.
  const armLift = 0.5 * Math.sin(Math.PI * Math.min(1, p / STIFF_IMPACT));
  const frame: FallFrame = {
    hip: {
      x: STIFF_PIVOT.x - Math.sin(tilt) * STIFF_HIP_RADIUS,
      y: STIFF_PIVOT.y - Math.cos(tilt) * STIFF_HIP_RADIUS,
    },
    torso: -tilt,
    head: -0.7 * snap + 0.55 * relax,
    // Legs reach exactly from the hip to the planted feet (60 long over 58 → soft knees), slightly apart.
    frontThigh: tilt + STIFF_KNEE + 0.04,
    frontShin: tilt - STIFF_KNEE + 0.04,
    rearThigh: tilt + STIFF_KNEE - 0.04,
    rearShin: tilt - STIFF_KNEE - 0.04,
    frontUpper: tilt + 0.15 + armLift,
    frontFore: tilt + 0.25 + armLift,
    rearUpper: tilt + 0.1 + armLift * 0.8,
    rearFore: tilt + 0.2 + armLift * 0.8,
  };
  // During the snap the limbs move from the normal standing pose into the rigid one.
  const settle = smooth(Math.min(1, p / STIFF_FALL_START));
  const limbs = ['frontThigh', 'frontShin', 'rearThigh', 'rearShin', 'frontUpper', 'frontFore', 'rearUpper', 'rearFore'] as const;
  limbs.forEach((key) => {
    frame[key] = lerp(STANDING[key], frame[key], settle);
  });
  return frame;
};

/** Interpolates the keyframes of a keyframed kind (knockback's hip follows its own arc). */
const keyframedFrame = (kind: Exclude<FallKind, 'deathStiff'>, p: number): FallFrame => {
  const frames = KEYFRAMES[kind];
  const nextIndex = Math.max(1, frames.findIndex((frame) => frame.t >= p));
  const from = frames[nextIndex - 1];
  const to = frames[nextIndex];
  const amount = smooth((p - from.t) / (to.t - from.t || 1));
  const mix = (key: Exclude<keyof FallKeyframe, 't' | 'hip'>): number => lerp(from[key], to[key], amount);
  return {
    hip: kind === 'knockback'
      ? knockbackHip(p)
      : { x: lerp(from.hip.x, to.hip.x, amount), y: lerp(from.hip.y, to.hip.y, amount) },
    torso: mix('torso'),
    head: mix('head'),
    frontThigh: mix('frontThigh'),
    frontShin: mix('frontShin'),
    rearThigh: mix('rearThigh'),
    rearShin: mix('rearShin'),
    frontUpper: mix('frontUpper'),
    frontFore: mix('frontFore'),
    rearUpper: mix('rearUpper'),
    rearFore: mix('rearFore'),
  };
};
const lerp = (a: number, b: number, amount: number): number => a + (b - a) * amount;
/** Feet and hands rest on this line; lower ends are rotated at the knee/elbow to meet it. */
const CONTACT_GROUND_Y = 58;

/**
 * Rotates a lower limb (shin or forearm) at its joint so its end doesn't go below the ground,
 * keeping the bone length. Leaves it alone when the joint itself is already at/below the ground.
 */
const groundedAngle = (joint: Vec2, angle: number, length: number): number => {
  const endY = joint.y + Math.cos(angle) * length;
  if (endY <= CONTACT_GROUND_Y || joint.y >= CONTACT_GROUND_Y) {
    return angle;
  }
  const cos = (CONTACT_GROUND_Y - joint.y) / length;
  const side = Math.sin(angle) >= 0 ? 1 : -1;
  return side * Math.acos(Math.max(-1, Math.min(1, cos)));
};

const limb = (from: Vec2, angle: number, length: number): Vec2 => ({
  x: from.x + Math.sin(angle) * length,
  y: from.y + Math.cos(angle) * length,
});

/** Fall frames are plain joint poses (see stickmanPose.ts). */
export type FallPose = JointPose;

/** Joint positions for a fall animation at `progress` (0..1, clamped). Pure and testable. */
export const getFallPose = (kind: FallKind, progress: number): FallPose => {
  const p = Math.max(0, Math.min(1, progress));
  const frame = kind === 'deathStiff' ? stiffFallFrame(p) : keyframedFrame(kind, p);
  const mix = (key: Exclude<keyof FallKeyframe, 't' | 'hip'>): number => frame[key];
  const { hip } = frame;
  const torso = mix('torso');
  const up = { x: Math.sin(torso), y: -Math.cos(torso) };
  const shoulder = { x: hip.x + up.x * TORSO, y: hip.y + up.y * TORSO };
  const headAngle = torso + mix('head');
  const headUp = { x: Math.sin(headAngle), y: -Math.cos(headAngle) };
  const frontKnee = limb(hip, mix('frontThigh'), THIGH);
  const rearKnee = limb(hip, mix('rearThigh'), THIGH);
  const frontElbow = limb(shoulder, mix('frontUpper'), UPPER_ARM);
  const rearElbow = limb(shoulder, mix('rearUpper'), UPPER_ARM);
  const frontShinAngle = groundedAngle(frontKnee, mix('frontShin'), SHIN);
  const rearShinAngle = groundedAngle(rearKnee, mix('rearShin'), SHIN);

  return {
    hip,
    shoulder,
    neckTop: { x: shoulder.x + headUp.x * NECK, y: shoulder.y + headUp.y * NECK },
    head: { x: shoulder.x + headUp.x * HEAD_OFFSET, y: shoulder.y + headUp.y * HEAD_OFFSET },
    frontKnee,
    frontFoot: limb(frontKnee, frontShinAngle, SHIN),
    rearKnee,
    rearFoot: limb(rearKnee, rearShinAngle, SHIN),
    frontElbow,
    frontHand: limb(frontElbow, groundedAngle(frontElbow, mix('frontFore'), FOREARM), FOREARM),
    rearElbow,
    rearHand: limb(rearElbow, groundedAngle(rearElbow, mix('rearFore'), FOREARM), FOREARM),
    frontShinAngle,
    rearShinAngle,
  };
};

/** Draws a fall animation frame with the skeleton look (same colours and widths as drawStickman). */
export const drawStickmanFall = (sprite: Graphics, kind: FallKind, progress: number, originY = 0, colors?: BodyColors): void => {
  drawJointPose(sprite, getFallPose(kind, progress), originY, { colors });
};
