/**
 * Club swings as pure keyframes, driven by progress 0..1 (drawStickman passes attackPhase / 2π).
 * Every style starts and ends exactly at the standing pose, so a swing never jumps in or out.
 *
 * - overhead: one-handed club, wound up behind the head with the torso leaning back, then a fast
 *   strike down into a forward lunge and dip;
 * - twoHanded: a longer club gripped with both hands, a bigger wind-up and a heavier lunge;
 * - uppercut: a short club swung from below: crouched wind-up low behind, then up and forward while
 *   rising.
 *
 * Angles use drawStickman's arm convention (0 = hanging down, π/2 = forward, π = straight up,
 * above π = behind the head); `torsoLean` tilts the shoulder forward (+) or back (−) about the hip.
 */
export type AttackStyle = 'overhead' | 'twoHanded' | 'uppercut';

export interface AttackPose {
  /** Front (club) upper arm angle. */
  armAngle: number;
  /** Forearm bend added to the upper arm (the club follows the forearm). */
  forearmBend: number;
  /** Rear (free) upper arm angle; ignored when the style holds the club with both hands. */
  rearArmAngle: number;
  torsoLean: number;
  /** Hip drop in px (+ = lower), for the dip into the strike. */
  dip: number;
  /** Front foot step forward in px. */
  step: number;
}

/** The club each style swings: how far it reaches past the fist, the butt behind it, and the grip. */
export interface ClubShape {
  reach: number;
  butt: number;
  width: number;
  /** The rear hand grips the shaft too. */
  twoHanded: boolean;
}

export const CLUBS: Readonly<Record<AttackStyle, ClubShape>> = {
  overhead: { reach: 28, butt: 8, width: 5, twoHanded: false },
  twoHanded: { reach: 42, butt: 14, width: 5.5, twoHanded: true },
  uppercut: { reach: 17, butt: 5, width: 5, twoHanded: false },
};

type Key = AttackPose & { t: number };

/** Standing pose: matches drawStickman's idle arms (0.1) and forearm bend for an armed hand. */
export const ATTACK_REST: AttackPose = { armAngle: 0.1, forearmBend: 0.48, rearArmAngle: 0.1, torsoLean: 0, dip: 0, step: 0 };

const STYLE_KEYS: Readonly<Record<AttackStyle, readonly Key[]>> = {
  overhead: [
    { t: 0, ...ATTACK_REST },
    { t: 0.34, armAngle: Math.PI + 0.55, forearmBend: 1.25, rearArmAngle: 0.6, torsoLean: -0.2, dip: -1.5, step: -2 },
    // The wrist snaps through the strike so the club lands forward and down.
    { t: 0.5, armAngle: 1.05, forearmBend: -0.75, rearArmAngle: -0.65, torsoLean: 0.3, dip: 3.5, step: 9 },
    { t: 0.6, armAngle: 0.82, forearmBend: -0.85, rearArmAngle: -0.5, torsoLean: 0.26, dip: 3, step: 9 },
    { t: 1, ...ATTACK_REST },
  ],
  twoHanded: [
    { t: 0, ...ATTACK_REST },
    { t: 0.38, armAngle: Math.PI + 0.75, forearmBend: 1.05, rearArmAngle: 0, torsoLean: -0.28, dip: -2, step: -3 },
    { t: 0.55, armAngle: 1.15, forearmBend: -0.9, rearArmAngle: 0, torsoLean: 0.4, dip: 5, step: 11 },
    { t: 0.66, armAngle: 0.9, forearmBend: -1.05, rearArmAngle: 0, torsoLean: 0.35, dip: 4.5, step: 11 },
    { t: 1, ...ATTACK_REST },
  ],
  uppercut: [
    { t: 0, ...ATTACK_REST },
    // Crouched wind-up: club low behind the hip.
    { t: 0.3, armAngle: -1.1, forearmBend: -0.25, rearArmAngle: 0.85, torsoLean: 0.2, dip: 4, step: 0 },
    // Swing up and forward, rising and leaning back.
    { t: 0.48, armAngle: 1.95, forearmBend: -0.85, rearArmAngle: -0.7, torsoLean: -0.18, dip: -2, step: 7 },
    { t: 0.58, armAngle: 2.1, forearmBend: -0.75, rearArmAngle: -0.55, torsoLean: -0.12, dip: -1, step: 7 },
    { t: 1, ...ATTACK_REST },
  ],
};

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Attack pose at `progress` (0..1, wraps) for a swing style. */
export const getAttackPose = (progress: number, style: AttackStyle = 'overhead'): AttackPose => {
  const keys = STYLE_KEYS[style];
  const p = ((progress % 1) + 1) % 1;
  const index = Math.max(0, keys.findIndex((key) => key.t > p) - 1);
  const from = keys[index];
  const to = keys[Math.min(keys.length - 1, index + 1)];
  const span = to.t - from.t || 1;
  // The strike (second segment) eases in hard, like an accelerating swing; the others ease in and out.
  const raw = (p - from.t) / span;
  const t = index === 1 ? raw * raw : smooth(raw);
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
