/**
 * The club swing as pure keyframes, driven by progress 0..1 (drawStickman passes attackPhase / 2π).
 * Wind-up (club up and behind the head, torso leaning back, weight back), a fast strike (swing down
 * and forward, torso pitching forward, front foot stepping in, knees dipping, the other arm thrown
 * back), then recovery. Progress 0 and 1 are exactly the standing pose, so the swing starts and ends
 * without a jump.
 *
 * Angles use drawStickman's arm convention (0 = hanging down, π/2 = forward, π = straight up,
 * above π = behind the head); `torsoLean` tilts the shoulder forward (+) or back (−) about the hip.
 */
export interface AttackPose {
  /** Front (club) upper arm angle. */
  armAngle: number;
  /** Forearm bend added to the upper arm (the club follows the forearm). */
  forearmBend: number;
  /** Rear (free) upper arm angle. */
  rearArmAngle: number;
  torsoLean: number;
  /** Hip drop in px (+ = lower), for the dip into the strike. */
  dip: number;
  /** Front foot step forward in px. */
  step: number;
}

type Key = AttackPose & { t: number };

/** Standing pose: matches drawStickman's idle arms (0.1) and forearm bend for an armed hand. */
export const ATTACK_REST: AttackPose = { armAngle: 0.1, forearmBend: 0.48, rearArmAngle: 0.1, torsoLean: 0, dip: 0, step: 0 };

const KEYS: readonly Key[] = [
  { t: 0, ...ATTACK_REST },
  // Wind-up: club raised up and behind the head, leaning back, rising slightly.
  { t: 0.34, armAngle: Math.PI + 0.55, forearmBend: 1.25, rearArmAngle: 0.6, torsoLean: -0.2, dip: -1.5, step: -2 },
  // Strike: fast swing down and forward into a lunge.
  { t: 0.5, armAngle: 1.05, forearmBend: 0.15, rearArmAngle: -0.65, torsoLean: 0.3, dip: 3.5, step: 9 },
  // Follow-through settles.
  { t: 0.6, armAngle: 0.82, forearmBend: 0.25, rearArmAngle: -0.5, torsoLean: 0.26, dip: 3, step: 9 },
  { t: 1, ...ATTACK_REST },
];

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Attack pose at `progress` (0..1, wraps). */
export const getAttackPose = (progress: number): AttackPose => {
  const p = ((progress % 1) + 1) % 1;
  const index = Math.max(0, KEYS.findIndex((key) => key.t > p) - 1);
  const from = KEYS[index];
  const to = KEYS[Math.min(KEYS.length - 1, index + 1)];
  const span = to.t - from.t || 1;
  // The strike segment eases in hard (accelerating swing); the others ease in and out.
  const raw = (p - from.t) / span;
  const t = from.t === 0.34 ? raw * raw : smooth(raw);
  const mix = (key: keyof AttackPose): number => from[key] + (to[key] - from[key]) * t;
  return {
    armAngle: mix('armAngle'),
    forearmBend: mix('forearmBend'),
    rearArmAngle: mix('rearArmAngle'),
    torsoLean: mix('torsoLean'),
    dip: mix('dip'),
    step: mix('step'),
  };
};
