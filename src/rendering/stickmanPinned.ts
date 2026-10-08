import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import { STICKMAN_HEAD, drawBomb } from './stickman';
import { drawJointPose, type JointPose, type JointPoseOptions } from './stickmanPose';

/**
 * A stickman pinned to the ground by one foot (the pinning arrow went through the rear foot), trying to tear
 * free, as a loop (pure, tested): he lunges forward with the free leg and his arms reaching out, the stuck leg
 * stretches and yanks him back, he looks down at the foot and shifts his weight, then steps back to try again.
 * The stuck foot never moves; legs are solved with two-bone IK so they keep their length.
 *
 * Sprite space like drawStickman with originY 0: hip at (0, 0) standing, facing +x, feet at y ≈ 57.
 */

export const PINNED_STRUGGLE_MS = 1400;
/** Where the stuck (rear) foot is, in sprite space: the pinning arrow goes in here. */
export const PINNED_FOOT: Readonly<Vec2> = { x: -16, y: 57.2 };

const THIGH = 30;
const SHIN = 30;
const UPPER_ARM = 21;
const FOREARM = 21;
const TORSO = 35;
const NECK = 8;
const HEAD_OFFSET = -STICKMAN_HEAD.y - TORSO;
/** How high the free foot lifts while stepping. */
const STEP_LIFT = 8;
/** A quick shudder of effort while he strains forward. */
const STRAIN = { amplitude: 0.025, rate: 0.045 };

/** One key of the loop: hip, torso lean (+ = forward), head tilt, free foot x, arm angles (0 = down, + = forward). */
interface StruggleKey {
  p: number;
  hip: Vec2;
  torso: number;
  head: number;
  footX: number;
  frontUpper: number;
  frontFore: number;
  rearUpper: number;
  rearFore: number;
}

const REST: Omit<StruggleKey, 'p'> = {
  hip: { x: 0, y: 0 }, torso: 0, head: 0, footX: 16, frontUpper: 0.15, frontFore: 0.35, rearUpper: -0.1, rearFore: 0.2,
};

const KEYS: readonly StruggleKey[] = [
  { p: 0, ...REST },
  // Lunges forward: free foot out in front, arms reaching, the stuck leg stretched behind.
  { p: 0.32, hip: { x: 12, y: 7 }, torso: 0.55, head: 0.1, footX: 34, frontUpper: 1.5, frontFore: 1.7, rearUpper: 1.0, rearFore: 1.3 },
  // The foot holds: yanked back upright, arms flung back.
  { p: 0.46, hip: { x: 4, y: 3 }, torso: -0.18, head: -0.3, footX: 34, frontUpper: -0.6, frontFore: -0.3, rearUpper: -0.9, rearFore: -0.6 },
  // Crouches and looks down at the stuck foot, one arm reaching down to it, the other out for balance.
  { p: 0.68, hip: { x: -2, y: 10 }, torso: 0.2, head: 0.45, footX: 30, frontUpper: 0.9, frontFore: 1.4, rearUpper: -0.5, rearFore: -0.2 },
  { p: 0.86, hip: { x: 0, y: 5 }, torso: 0.1, head: 0.2, footX: 30, frontUpper: 0.4, frontFore: 0.7, rearUpper: -0.2, rearFore: 0.1 },
  // Steps back to stand and try again.
  { p: 1, ...REST },
];

const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const limb = (from: Vec2, angle: number, length: number): Vec2 => ({ x: from.x + Math.sin(angle) * length, y: from.y + Math.cos(angle) * length });
const angleTo = (from: Vec2, to: Vec2): number => Math.atan2(to.x - from.x, to.y - from.y);

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

/** The pinned struggle at `timeMs` (loops every PINNED_STRUGGLE_MS). */
export const getPinnedPose = (timeMs: number): JointPose => {
  const p = (((timeMs % PINNED_STRUGGLE_MS) + PINNED_STRUGGLE_MS) % PINNED_STRUGGLE_MS) / PINNED_STRUGGLE_MS;
  const index = Math.max(0, KEYS.findIndex((key) => key.p > p) - 1);
  const from = KEYS[index];
  const to = KEYS[Math.min(KEYS.length - 1, index + 1)];
  const t = to.p === from.p ? 0 : smooth((p - from.p) / (to.p - from.p));
  const mix = (key: Exclude<keyof StruggleKey, 'p' | 'hip'>): number => lerp(from[key], to[key], t);

  const hip = { x: lerp(from.hip.x, to.hip.x, t), y: lerp(from.hip.y, to.hip.y, t) };
  // Straining forward he shudders a little (fades in and out with the lunge).
  const strain = Math.sin(timeMs * STRAIN.rate) * STRAIN.amplitude * Math.max(0, Math.sin(Math.PI * Math.min(1, p / 0.46)));
  const torso = mix('torso') + strain;
  const shoulder = { x: hip.x + Math.sin(torso) * TORSO, y: hip.y - Math.cos(torso) * TORSO };
  const headAngle = torso + mix('head');
  const headUp = { x: Math.sin(headAngle), y: -Math.cos(headAngle) };

  // The free foot lifts while it moves between keys.
  const stepping = from.footX !== to.footX;
  const freeFoot = { x: mix('footX'), y: PINNED_FOOT.y - (stepping ? Math.sin(Math.PI * t) * STEP_LIFT : 0) };
  const front = solveLeg(hip, freeFoot);
  const rear = solveLeg(hip, PINNED_FOOT);
  const frontElbow = limb(shoulder, mix('frontUpper'), UPPER_ARM);
  const rearElbow = limb(shoulder, mix('rearUpper'), UPPER_ARM);
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
    frontHand: limb(frontElbow, mix('frontFore'), FOREARM),
    rearElbow,
    rearHand: limb(rearElbow, mix('rearFore'), FOREARM),
    frontShinAngle: front.shinAngle,
    rearShinAngle: rear.shinAngle,
  };
};

/**
 * Draws the pinned struggle (skeleton look; a club in the hand for club fighters, body colours for zombies, and
 * a kamikaze's bomb on the chest with `bomb`).
 */
export const drawPinnedStruggle = (sprite: Graphics, timeMs: number, originY = 0, options: JointPoseOptions & { bomb?: boolean } = {}): void => {
  const pose = getPinnedPose(timeMs);
  drawJointPose(sprite, pose, originY, options);
  if (options.bomb) {
    // On the chest, just in front of the spine (as drawStickman places it).
    const lean = Math.atan2(pose.shoulder.x - pose.hip.x, pose.hip.y - pose.shoulder.y);
    const chest = { x: pose.hip.x + Math.sin(lean) * 19, y: pose.hip.y - Math.cos(lean) * 19 };
    drawBomb(sprite, { x: chest.x + Math.cos(lean) * 7, y: chest.y + Math.sin(lean) * 7 }, timeMs / 150);
  }
};
