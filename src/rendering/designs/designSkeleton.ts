import type { Vec2 } from '../../types';

/**
 * Walking skeletons for the enemy design lab (pure, tested). Sprite space as in drawStickman with
 * originY 0: facing +x, ground at DESIGN_GROUND_Y. The figures walk on the spot (the lab scrolls the
 * ground under them), so a planted foot slides back at the walking speed.
 */
export const DESIGN_GROUND_Y = 58;

export interface Gait {
  thigh: number;
  shin: number;
  /** Hip height above the ground at mid-stance (its highest point). */
  hipHeight: number;
  /** Half the step length: a planted foot slides from +stride to -stride. */
  stride: number;
  /** How high a swinging foot is lifted. */
  lift: number;
  /** How far the hip dips when both feet are down. */
  bob: number;
}

export interface WalkPose {
  hip: Vec2;
  frontKnee: Vec2;
  frontFoot: Vec2;
  rearKnee: Vec2;
  rearFoot: Vec2;
  /** 1 when the front leg reaches forward, -1 when the rear one does (arms swing against it). */
  swing: number;
}

/** Gaits of the walking designs (their limb proportions). */
export const DESIGN_GAITS = {
  raider: { thigh: 30, shin: 30, hipHeight: 57, stride: 13, lift: 9, bob: 2 },
  goblin: { thigh: 20, shin: 20, hipHeight: 38, stride: 10, lift: 8, bob: 2.5 },
  footman: { thigh: 30, shin: 30, hipHeight: 57, stride: 12, lift: 7, bob: 1.5 },
  orc: { thigh: 24, shin: 24, hipHeight: 45, stride: 11, lift: 6, bob: 3.5 },
  cultist: { thigh: 28, shin: 28, hipHeight: 54, stride: 9, lift: 4, bob: 1 },
  golem: { thigh: 28, shin: 28, hipHeight: 53, stride: 12, lift: 5, bob: 3 },
} as const satisfies Record<string, Gait>;

const smooth = (u: number): number => u * u * (3 - 2 * u);
const wrap = (p: number): number => ((p % 1) + 1) % 1;

/** A foot at cycle progress p: planted and sliding back for the first half, swinging forward in the second. */
export const footAt = (p: number, stride: number, lift: number, groundY = DESIGN_GROUND_Y): Vec2 => {
  const q = wrap(p);
  if (q < 0.5) {
    return { x: stride * (1 - 4 * q), y: groundY };
  }
  const u = (q - 0.5) * 2;
  return { x: -stride + 2 * stride * smooth(u), y: groundY - lift * Math.sin(Math.PI * u) };
};

/**
 * The middle joint of a two-bone limb from `root` to `end`. For a limb pointing down, bend 1 puts it in
 * front (+x, a knee) and -1 behind. An end out of reach stretches the limb straight.
 */
export const solveJoint = (root: Vec2, end: Vec2, upper: number, lower: number, bend: 1 | -1): Vec2 => {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  const length = Math.hypot(dx, dy);
  const ux = length > 1e-9 ? dx / length : 0;
  const uy = length > 1e-9 ? dy / length : 1;
  const d = Math.max(Math.abs(upper - lower) + 1e-6, Math.min(length, upper + lower));
  const along = (upper * upper - lower * lower + d * d) / (2 * d);
  const across = Math.sqrt(Math.max(0, upper * upper - along * along));
  return { x: root.x + ux * along + bend * uy * across, y: root.y + uy * along - bend * ux * across };
};

/** The legs at walk progress p (cycles; one cycle is two steps). */
export const walkPose = (p: number, gait: Gait, groundY = DESIGN_GROUND_Y): WalkPose => {
  const rise = (1 - Math.cos(4 * Math.PI * p)) / 2;
  const hip = { x: 0, y: groundY - gait.hipHeight + gait.bob * (1 - rise) };
  const frontFoot = footAt(p, gait.stride, gait.lift, groundY);
  const rearFoot = footAt(p + 0.5, gait.stride, gait.lift, groundY);
  return {
    hip,
    frontFoot,
    rearFoot,
    frontKnee: solveJoint(hip, frontFoot, gait.thigh, gait.shin, 1),
    rearKnee: solveJoint(hip, rearFoot, gait.thigh, gait.shin, 1),
    swing: Math.cos(2 * Math.PI * p),
  };
};

/** Direction of a limb at `angle` (0 = straight down, positive = forward). */
export const along = (from: Vec2, angle: number, length: number): Vec2 => ({
  x: from.x + Math.sin(angle) * length,
  y: from.y + Math.cos(angle) * length,
});

/** Elbow and hand of an arm hanging at `angle` with the forearm bent `bend` further forward. */
export const armPose = (shoulder: Vec2, angle: number, bend: number, upper: number, lower: number): { elbow: Vec2; hand: Vec2 } => {
  const elbow = along(shoulder, angle, upper);
  return { elbow, hand: along(elbow, angle + bend, lower) };
};
