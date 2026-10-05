/**
 * Running gait for one leg, as a function of cycle progress p ∈ [0, 1) (the other leg is offset by
 * half a cycle). Positions are relative to the hip in stickman sprite space, facing +x.
 *
 *   0.00  contact     foot lands slightly in front of the hip
 *   0.00–0.40 stance  foot stays on the ground and slides back at constant speed
 *   0.40  toe-off     push off behind the body
 *   0.55  heel kick   heel flicks up behind
 *   0.72  knee drive  foot passes high under the hip, thigh nearly horizontal
 *   0.87  reach       foot swings forward before landing again
 *
 * Each foot is grounded 40% of the time, so both feet are briefly in the air twice per cycle.
 */

export const STANCE_END = 0.4;
/** Foot y on the ground while running (the body is drawn 5 px lower when running). */
export const RUN_GROUND_Y = 50;
/** Vertical body bob amplitude: lowest at mid-stance, highest in the flight phase. */
export const RUN_BOUNCE = 2.4;
const CONTACT_X = 20;
const TOE_OFF_X = -26;

interface RunKey {
  p: number;
  x: number;
  /** Height above the ground. */
  lift: number;
}

/** Swing keys from toe-off to the next contact, with stance neighbours for smooth tangents. */
const SWING_KEYS: RunKey[] = [
  { p: 0.2, x: (CONTACT_X + TOE_OFF_X) / 2, lift: 0 },
  { p: STANCE_END, x: TOE_OFF_X, lift: 2 },
  { p: 0.55, x: -24, lift: 26 },
  { p: 0.72, x: 0, lift: 30 },
  { p: 0.87, x: 26, lift: 14 },
  { p: 1, x: CONTACT_X, lift: 0 },
  { p: 1.2, x: (CONTACT_X + TOE_OFF_X) / 2, lift: 0 },
];

const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
  const m1 = (p2 - p0) / 2;
  const m2 = (p3 - p1) / 2;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2 + (t3 - t2) * m2;
};

const wrap = (p: number): number => ((p % 1) + 1) % 1;

/** Foot position relative to the ground: x and lift (height above the ground). */
export const runFoot = (progress: number): { x: number; lift: number } => {
  const p = wrap(progress);
  if (p < STANCE_END) {
    return { x: CONTACT_X + (TOE_OFF_X - CONTACT_X) * (p / STANCE_END), lift: 0 };
  }
  const index = SWING_KEYS.findIndex((key) => key.p > p);
  const [k0, k1, k2, k3] = [SWING_KEYS[index - 2], SWING_KEYS[index - 1], SWING_KEYS[index], SWING_KEYS[index + 1]];
  const t = (p - k1.p) / (k2.p - k1.p);
  return {
    x: catmullRom(k0.x, k1.x, k2.x, k3.x, t),
    lift: Math.max(0, catmullRom(k0.lift, k1.lift, k2.lift, k3.lift, t)),
  };
};

/** Body bob (added to sprite.y, so larger = lower): lowest at each mid-stance, highest in flight. */
export const runBounce = (progress: number): number =>
  RUN_BOUNCE * (0.5 + 0.5 * Math.cos(4 * Math.PI * (wrap(progress) - STANCE_END / 2)));

/** Swing of the arm paired with this leg (−1 back … 1 forward); arms move opposite to their leg. */
export const runArmSwing = (progress: number): number => Math.cos(2 * Math.PI * wrap(progress));
