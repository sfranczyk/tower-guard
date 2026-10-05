import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import { STICKMAN_HEAD } from './stickman';
import { drawJointPose, type JointPose, type JointPoseOptions } from './stickmanPose';

/**
 * Looping victory cheers, as joint poses (pure, testable):
 * - cheerJump: crouch, spring up with both arms thrown into a V, land softly;
 * - cheerFist: pumps a fist overhead, the other hand on the hip, dipping at each "yes!";
 * - cheerWave: both arms up, waving side to side while bouncing on the toes.
 *
 * Sprite space as in drawStickman: hip at (0, 0) when standing, facing +x, feet on the ground at
 * CHEER_FOOT_Y. Legs are solved with two-bone IK (knees forward) so planted feet never slide.
 * Arm angles: 0 = hanging down, +π/2 = forward, ±π = straight up.
 */
export type CheerKind = 'cheerJump' | 'cheerFist' | 'cheerWave';

export const CHEER_KINDS: readonly CheerKind[] = ['cheerJump', 'cheerFist', 'cheerWave'];

/** Length of one loop of each cheer. */
export const CHEER_PERIOD_MS: Readonly<Record<CheerKind, number>> = {
  cheerJump: 900,
  cheerFist: 620,
  cheerWave: 1100,
};

/** Standing foot height (matches the fall animations' standing pose). */
export const CHEER_FOOT_Y = 57.2;
const FOOT_X = 16;
const THIGH = 30;
const SHIN = 30;
const UPPER_ARM = 21;
const FOREARM = 21;
const TORSO = 35;
const NECK = 8;
const HEAD_OFFSET = -STICKMAN_HEAD.y - TORSO;
const JUMP_HEIGHT = 22;

interface Arms {
  frontUpper: number;
  frontFore: number;
  rearUpper: number;
  rearFore: number;
}

interface CheerFrame extends Arms {
  hip: Vec2;
  torso: number;
  headTilt: number;
  frontFoot: Vec2;
  rearFoot: Vec2;
}

const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerpArms = (a: Arms, b: Arms, t: number): Arms => ({
  frontUpper: lerp(a.frontUpper, b.frontUpper, t),
  frontFore: lerp(a.frontFore, b.frontFore, t),
  rearUpper: lerp(a.rearUpper, b.rearUpper, t),
  rearFore: lerp(a.rearFore, b.rearFore, t),
});
const limb = (from: Vec2, angle: number, length: number): Vec2 => ({
  x: from.x + Math.sin(angle) * length,
  y: from.y + Math.cos(angle) * length,
});
const angleTo = (from: Vec2, to: Vec2): number => Math.atan2(to.x - from.x, to.y - from.y);

const GROUND_FEET = { front: { x: FOOT_X, y: CHEER_FOOT_Y }, rear: { x: -FOOT_X, y: CHEER_FOOT_Y } };

// Arm sets for the jump.
const ARMS_HALF_UP: Arms = { frontUpper: 1.9, frontFore: 2.6, rearUpper: -1.9, rearFore: -2.6 };
const ARMS_BACK: Arms = { frontUpper: -0.5, frontFore: -0.3, rearUpper: -0.7, rearFore: -0.5 };
const ARMS_V: Arms = { frontUpper: 2.45, frontFore: 2.7, rearUpper: -2.5, rearFore: -2.75 };

/** Jump arms run on their own timeline: they swing up through the push and finish in the air. */
const jumpArms = (p: number): Arms => {
  if (p < 0.24) {
    return lerpArms(ARMS_HALF_UP, ARMS_BACK, smooth(p / 0.24));
  }
  if (p < 0.44) {
    return lerpArms(ARMS_BACK, ARMS_V, smooth((p - 0.24) / 0.2));
  }
  if (p < 0.86) {
    return ARMS_V;
  }
  return lerpArms(ARMS_V, ARMS_HALF_UP, smooth((p - 0.86) / 0.14));
};

const jumpFrame = (p: number): CheerFrame => {
  const arms = jumpArms(p);
  const base = { headTilt: 0, frontFoot: GROUND_FEET.front, rearFoot: GROUND_FEET.rear, ...arms };
  if (p < 0.25) {
    // Crouch.
    const t = smooth(p / 0.25);
    return { ...base, hip: { x: 0, y: 9 * t }, torso: 0.15 * t };
  }
  if (p < 0.34) {
    // Push off.
    const t = smooth((p - 0.25) / 0.09);
    return { ...base, hip: { x: 0, y: lerp(9, -2, t) }, torso: lerp(0.15, 0, t) };
  }
  if (p < 0.76) {
    // Airborne: parabolic hop with the legs tucked under.
    const t = (p - 0.34) / 0.42;
    const hipY = -2 - JUMP_HEIGHT * 4 * t * (1 - t);
    const tuck = Math.sin(Math.PI * t);
    const foot = (side: number): Vec2 => ({ x: side * (FOOT_X - 5 * tuck), y: Math.min(CHEER_FOOT_Y, hipY + 59.2 - 14 * tuck) });
    return { ...arms, hip: { x: 0, y: hipY }, torso: -0.06 * tuck, headTilt: -0.18 * tuck, frontFoot: foot(1), rearFoot: foot(-1) };
  }
  if (p < 0.86) {
    // Land and absorb.
    const t = smooth((p - 0.76) / 0.1);
    return { ...base, hip: { x: 0, y: lerp(-2, 9, t) }, torso: 0.12 * t };
  }
  // Stand back up.
  const t = smooth((p - 0.86) / 0.14);
  return { ...base, hip: { x: 0, y: lerp(9, 0, t) }, torso: lerp(0.12, 0, t) };
};

const fistFrame = (p: number): CheerFrame => {
  const pump = (1 - Math.cos(Math.PI * 2 * p)) / 2;
  return {
    hip: { x: 0, y: 2.5 * pump },
    torso: -0.06 * pump,
    headTilt: -0.14 * pump,
    frontFoot: GROUND_FEET.front,
    rearFoot: GROUND_FEET.rear,
    // Fist by the ear (elbow forward) up to straight overhead.
    frontUpper: 1.6 + 1.25 * pump,
    frontFore: 3.0 - 0.05 * pump,
    // Hand on the hip, elbow out behind.
    rearUpper: -0.9,
    rearFore: 0.7,
  };
};

const waveFrame = (p: number): CheerFrame => {
  const sway = Math.sin(Math.PI * 2 * p);
  const up = Math.PI - 0.45;
  return {
    hip: { x: 2 * sway, y: 2.5 * (1 - Math.cos(Math.PI * 4 * p)) / 2 },
    torso: 0.07 * sway,
    headTilt: -0.1,
    frontFoot: GROUND_FEET.front,
    rearFoot: GROUND_FEET.rear,
    frontUpper: up + 0.35 * sway,
    frontFore: up + 0.6 * sway,
    rearUpper: -up + 0.35 * sway,
    rearFore: -up + 0.6 * sway,
  };
};

const FRAMES: Record<CheerKind, (p: number) => CheerFrame> = { cheerJump: jumpFrame, cheerFist: fistFrame, cheerWave: waveFrame };

/** Two-bone leg with the knee in front; the foot is recomputed so limb lengths stay exact. */
const solveLeg = (hip: Vec2, target: Vec2): { knee: Vec2; foot: Vec2; shinAngle: number } => {
  const reach = Math.max(1, Math.min(THIGH + SHIN - 0.01, Math.hypot(target.x - hip.x, target.y - hip.y)));
  const bend = Math.acos(reach / (THIGH + SHIN));
  const base = angleTo(hip, target);
  const kneeA = limb(hip, base + bend, THIGH);
  const kneeB = limb(hip, base - bend, THIGH);
  const knee = kneeA.x >= kneeB.x ? kneeA : kneeB;
  const shinAngle = angleTo(knee, target);
  return { knee, foot: limb(knee, shinAngle, SHIN), shinAngle };
};

/** Joint positions of a cheer at `timeMs` (loops every CHEER_PERIOD_MS). */
export const getCheerPose = (kind: CheerKind, timeMs: number): JointPose => {
  const period = CHEER_PERIOD_MS[kind];
  const p = (((timeMs % period) + period) % period) / period;
  const frame = FRAMES[kind](p);
  const { hip, torso } = frame;
  const shoulder = { x: hip.x + Math.sin(torso) * TORSO, y: hip.y - Math.cos(torso) * TORSO };
  const headAngle = torso + frame.headTilt;
  const headUp = { x: Math.sin(headAngle), y: -Math.cos(headAngle) };
  const front = solveLeg(hip, frame.frontFoot);
  const rear = solveLeg(hip, frame.rearFoot);
  const frontElbow = limb(shoulder, frame.frontUpper, UPPER_ARM);
  const rearElbow = limb(shoulder, frame.rearUpper, UPPER_ARM);
  return {
    hip,
    shoulder,
    neckTop: { x: shoulder.x + headUp.x * NECK, y: shoulder.y + headUp.y * NECK },
    head: { x: shoulder.x + headUp.x * HEAD_OFFSET, y: shoulder.y + headUp.y * HEAD_OFFSET },
    frontKnee: front.knee,
    frontFoot: front.foot,
    rearKnee: rear.knee,
    rearFoot: rear.foot,
    frontElbow,
    frontHand: limb(frontElbow, frame.frontFore, FOREARM),
    rearElbow,
    rearHand: limb(rearElbow, frame.rearFore, FOREARM),
    frontShinAngle: front.shinAngle,
    rearShinAngle: rear.shinAngle,
  };
};

/** Draws a cheer frame with the skeleton look (optionally waving a club). */
export const drawStickmanCheer = (
  sprite: Graphics,
  kind: CheerKind,
  timeMs: number,
  originY = 0,
  options: JointPoseOptions = {},
): void => {
  drawJointPose(sprite, getCheerPose(kind, timeMs), originY, options);
};
