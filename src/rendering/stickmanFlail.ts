import { FLAIL_SPEED } from '../config';
import type { Vec2 } from '../types';
import { STICKMAN_HEAD } from './stickman';
import type { JointPose } from './stickmanPose';

/**
 * A stickman thrown through the air, flailing (pure, tested): arms windmilling at their own pace, legs kicking,
 * the head lolling and the torso twisting a little. Loops; the tumble of the whole body is the sprite's rotation.
 * Sprite space like drawStickman with originY 0: hip at (0, 0), facing +x.
 */

const THIGH = 30;
const SHIN = 30;
const UPPER_ARM = 21;
const FOREARM = 21;
const TORSO = 35;
const NECK = 8;
const HEAD_OFFSET = -STICKMAN_HEAD.y - TORSO;

/** Angles: 0 = pointing down, +π/2 = forward (+x). */
const limb = (from: Vec2, angle: number, length: number): Vec2 => ({ x: from.x + Math.sin(angle) * length, y: from.y + Math.cos(angle) * length });

/** The flailing pose `timeMs` into the throw (at FLAIL_SPEED 1 the arms windmill once every ~420 ms, legs kick faster). */
export const getFlailPose = (timeMs: number): JointPose => {
  const t = (timeMs / 1000) * FLAIL_SPEED;
  const torso = Math.sin(t * 7) * 0.22;
  const hip = { x: 0, y: 0 };
  const shoulder = { x: Math.sin(torso) * TORSO, y: -Math.cos(torso) * TORSO };
  const headAngle = torso + Math.sin(t * 9 + 1) * 0.35;
  const headUp = { x: Math.sin(headAngle), y: -Math.cos(headAngle) };

  // Arms windmill in opposite phase, elbows flopping.
  const frontUpper = Math.PI + t * 15;
  const rearUpper = t * 13 + 0.8;
  const frontElbow = limb(shoulder, frontUpper, UPPER_ARM);
  const rearElbow = limb(shoulder, rearUpper, UPPER_ARM);
  const frontHand = limb(frontElbow, frontUpper + 0.5 + Math.sin(t * 11) * 0.6, FOREARM);
  const rearHand = limb(rearElbow, rearUpper + 0.5 + Math.sin(t * 10 + 2) * 0.6, FOREARM);

  // Legs kick back and forth out of step; the shins trail behind the thighs.
  const frontThigh = 0.15 + Math.sin(t * 16) * 0.85;
  const rearThigh = -0.1 + Math.sin(t * 16 + 2.6) * 0.85;
  const frontKnee = limb(hip, frontThigh, THIGH);
  const rearKnee = limb(hip, rearThigh, THIGH);
  const frontShinAngle = frontThigh - 0.5 - Math.max(0, Math.sin(t * 16 + 0.8)) * 0.9;
  const rearShinAngle = rearThigh - 0.5 - Math.max(0, Math.sin(t * 16 + 3.4)) * 0.9;

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
    frontHand,
    rearElbow,
    rearHand,
    frontShinAngle,
    rearShinAngle,
  };
};
