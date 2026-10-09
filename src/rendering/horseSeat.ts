import type { Vec2 } from '../types';
import { solveJoint } from './designs/designSkeleton';
import type { HorseGait } from './horseRider';
import type { JointPose } from './stickmanPose';

/** The rider on a horse (pure, tested via getHorsePose): sat in the saddle, reins in hand, or a lance (`LanceHold`). */

/** The rider's limbs, as drawStickman's. */
export const RIDER_LIMBS = { thigh: 30, shin: 30, upperArm: 21, forearm: 21 } as const;

/** The near hand holds a lance: carried (thrust 0), a thrust `thrust` 0..1 through (LANCE_IMPACT is the hit), or raised high. */
export interface LanceHold {
  thrust: number;
  raised?: boolean;
}

/** The lance's length behind and ahead of the fist. */
export const LANCE = { butt: 28, ahead: 118 } as const;
/** How far through a thrust the point strikes (as the sword thrust's, attackSwing). */
export const LANCE_IMPACT = 0.5;

/** A held lance, from its butt to its point (sprite space). */
export interface LancePose {
  butt: Vec2;
  tip: Vec2;
}

/** A key of the lance: the fist relative to the shoulder, the lance's angle (+ = point down) and the rider's lean. */
interface LanceKey {
  t: number;
  grip: Vec2;
  angle: number;
  lean: number;
}

const LANCE_CARRY: Omit<LanceKey, 't'> = { grip: { x: 8, y: 22 }, angle: -0.12, lean: 0 };
const LANCE_KEYS: readonly LanceKey[] = [
  { t: 0, ...LANCE_CARRY },
  // Drawn back, the rider sitting up, the point rising.
  { t: 0.36, grip: { x: -4, y: 18 }, angle: 0.02, lean: -0.12 },
  // Driven forward and down at the chest, leaning into it.
  { t: LANCE_IMPACT, grip: { x: 22, y: 20 }, angle: 0.42, lean: 0.18 },
  { t: 0.64, grip: { x: 20, y: 21 }, angle: 0.4, lean: 0.16 },
  { t: 1, ...LANCE_CARRY },
];
const LANCE_RAISED: Omit<LanceKey, 't'> = { grip: { x: 9, y: -12 }, angle: -1.2, lean: -0.04 };

/** The lance's key `thrust` through (eased between the keys). */
const lanceKey = ({ thrust, raised }: LanceHold): Omit<LanceKey, 't'> => {
  if (raised) {
    return LANCE_RAISED;
  }
  const t = Math.max(0, Math.min(1, thrust));
  const next = LANCE_KEYS.findIndex((key) => key.t >= t);
  if (next <= 0) {
    return LANCE_KEYS[0];
  }
  const from = LANCE_KEYS[next - 1];
  const to = LANCE_KEYS[next];
  const u = smooth((t - from.t) / (to.t - from.t));
  const mix = (a: number, b: number): number => a + (b - a) * u;
  return { grip: { x: mix(from.grip.x, to.grip.x), y: mix(from.grip.y, to.grip.y) }, angle: mix(from.angle, to.angle), lean: mix(from.lean, to.lean) };
};


export const smooth = (u: number): number => u * u * (3 - 2 * u);
const shinAngle = (knee: Vec2, foot: Vec2): number => Math.atan2(foot.x - knee.x, foot.y - knee.y);

/**
 * The rider astride: hip on the saddle, feet in the stirrups, hands on the reins between the shoulder and the bit; with
 * a lance the near fist holds it instead (and he leans with the thrust).
 */
export const riderPose = (
  saddle: Vec2, stirrup: Vec2, mouth: Vec2, lean: number, cycle: number, gait: HorseGait, lance?: LanceHold,
): { rider: JointPose; lance?: LancePose } => {
  // At the gallop he rises a little out of the saddle with each stride.
  const lift = gait === 'gallop' ? 2.5 * (1 + Math.cos(cycle - 0.4)) : 0;
  const hip = { x: saddle.x, y: saddle.y - lift };
  const key = lance ? lanceKey(lance) : undefined;
  const tilt = lean + (key?.lean ?? 0) + (gait === 'gallop' ? 0.04 * Math.sin(cycle) : 0.02 * Math.sin(cycle * 2));
  const up = (distance: number): Vec2 => ({ x: hip.x + Math.sin(tilt) * distance, y: hip.y - Math.cos(tilt) * distance });
  const shoulder = up(35);
  // The hands hold the reins about a third of the way from the shoulder to the bit, a little lower.
  const toward = (share: number, drop: number, back: number): Vec2 => ({
    x: shoulder.x + (mouth.x - shoulder.x) * share - back,
    y: shoulder.y + (mouth.y - shoulder.y) * share + drop,
  });
  const frontHand = key ? { x: shoulder.x + key.grip.x, y: shoulder.y + key.grip.y } : toward(0.42, 14, 0);
  const rearHand = toward(0.42, 15, 3);
  const frontFoot = stirrup;
  const rearFoot = { x: stirrup.x - 3, y: stirrup.y - 1 };
  const frontKnee = solveJoint(hip, frontFoot, RIDER_LIMBS.thigh, RIDER_LIMBS.shin, 1);
  const rearKnee = solveJoint(hip, rearFoot, RIDER_LIMBS.thigh, RIDER_LIMBS.shin, 1);
  const rider: JointPose = {
    hip, shoulder, neckTop: up(43), head: up(52),
    frontKnee, frontFoot, rearKnee, rearFoot,
    frontElbow: solveJoint(shoulder, frontHand, RIDER_LIMBS.upperArm, RIDER_LIMBS.forearm, -1),
    frontHand,
    rearElbow: solveJoint(shoulder, rearHand, RIDER_LIMBS.upperArm, RIDER_LIMBS.forearm, -1),
    rearHand,
    frontShinAngle: shinAngle(frontKnee, frontFoot),
    rearShinAngle: shinAngle(rearKnee, rearFoot),
  };
  if (!key) {
    return { rider };
  }
  const direction = { x: Math.cos(key.angle), y: Math.sin(key.angle) };
  return {
    rider,
    lance: {
      butt: { x: frontHand.x - direction.x * LANCE.butt, y: frontHand.y - direction.y * LANCE.butt },
      tip: { x: frontHand.x + direction.x * LANCE.ahead, y: frontHand.y + direction.y * LANCE.ahead },
    },
  };
};
