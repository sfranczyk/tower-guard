/**
 * The two ways of walking (pure, tested). `walk` is a natural walk: heel strike, the foot rolling flat, the heel rising
 * and the toes pushing off, the swinging foot kept low, both feet down for a moment after each step, the hips highest
 * over the planted foot, loose arms with bent elbows. `march` is the old walk, kept for the black knights: high knees and
 * a foot lifted a third of a leg, straight arms swinging wide.
 *
 * Phases are in cycles (one cycle = two steps, 2π of drawStickman's phase). The front leg swings through the first half
 * and lands at 0.5, the rear one lands at 0, as the march's and the run's blends expect.
 */

export type WalkStyle = 'walk' | 'march';

/** Ground covered per walk cycle (sprite px): the planted foot slides back exactly this fast. */
export const WALK_CYCLE_PX = 72;
/** How far the body moves (sprite px) per radian of walk phase with the planted foot not sliding. */
export const WALK_STRIDE_PER_RADIAN = WALK_CYCLE_PX / (Math.PI * 2);

const WALK = {
  /** Share of the cycle a foot is on the ground (over half: both down after each step). */
  stance: 0.58,
  /** Toe up at heel strike (radians), rolled flat over this share of the cycle. */
  heelStrike: 0.3,
  roll: 0.1,
  /** The heel rises over this last share of the stance, up to `toeOff` radians toe down, pivoting on the toes. */
  heelRise: 0.16,
  toeOff: 0.6,
  /** Ankle to the ball of the foot (px). */
  toe: 8,
  /** Extra lift of the swinging foot at its highest (px): it barely clears the ground. */
  clearance: 6,
  /** Hip rise and fall (px, peak to peak) and its middle (px below the hip's rest: the legs reach the ground in the step). */
  hipBob: 4.4,
  hipDrop: 0.8,
  /** Arm swing (radians each way) and elbow bend (radians; more as the arm comes forward). */
  arm: 0.32,
  elbow: 0.3,
  elbowForward: 0.3,
} as const;

/** A foot: its ankle `x` (relative to the hip), `lift` above the ground and `pitch` (radians, + = toe up). */
export interface WalkFoot {
  x: number;
  lift: number;
  pitch: number;
}

/** One moment of the natural walk: both feet, the hip's height (+ = down) and the arms' swing. */
export interface WalkFrame {
  front: WalkFoot;
  rear: WalkFoot;
  hipY: number;
  /** The rear arm's angle (radians, + = forward; it swings with the front leg); the front arm's is the opposite. */
  rearArm: number;
  /** Elbow bend of an arm swung to `angle` (more bent coming forward). */
  elbowBend: (angle: number) => number;
}

const wrap = (p: number): number => ((p % 1) + 1) % 1;
const smooth = (u: number): number => u * u * (3 - 2 * u);
const STEP = WALK_CYCLE_PX * WALK.stance;

/** One foot `u` cycles after its heel struck the ground. */
export const walkFoot = (u: number): WalkFoot => {
  const t = wrap(u);
  const { stance, heelStrike, roll, heelRise, toeOff, toe, clearance } = WALK;
  if (t < stance) {
    // Planted: the ground slides back under it at the walk's speed.
    const x = STEP / 2 - (t / stance) * STEP;
    if (t < roll) {
      return { x, lift: 0, pitch: heelStrike * (1 - smooth(t / roll)) };
    }
    const rise = (t - (stance - heelRise)) / heelRise;
    if (rise <= 0) {
      return { x, lift: 0, pitch: 0 };
    }
    // Up on the toes: the ankle turns about the ball of the foot.
    const pitch = -toeOff * smooth(rise);
    return { x: x + toe * (1 - Math.cos(pitch)), lift: toe * Math.sin(-pitch), pitch };
  }
  // Swinging through, low, from the toe-off to the next heel strike.
  const v = (t - stance) / (1 - stance);
  const start = { x: -STEP / 2 + toe * (1 - Math.cos(toeOff)), lift: toe * Math.sin(toeOff) };
  return {
    x: start.x + (STEP / 2 - start.x) * smooth(v),
    lift: start.lift * (1 - v) + clearance * Math.sin(Math.PI * v) * (1 - 0.3 * v),
    pitch: -toeOff + (toeOff + heelStrike) * smooth(v),
  };
};

/** The natural walk at `p` (cycles). */
export const walkFrame = (p: number): WalkFrame => {
  // Lowest just after each heel strike (both feet down), highest over the planted foot.
  const doubleSupport = (WALK.stance - 0.5) / 2;
  return {
    front: walkFoot(p + 0.5),
    rear: walkFoot(p),
    hipY: WALK.hipDrop + (WALK.hipBob / 2) * Math.cos(Math.PI * 4 * (p - doubleSupport)),
    rearArm: -WALK.arm * Math.cos(Math.PI * 2 * p),
    elbowBend: (angle) => WALK.elbow + WALK.elbowForward * Math.max(0, angle / WALK.arm),
  };
};

/**
 * The march's knee bend for one leg, in drawStickman's IK convention: negative pushes the knee forward,
 * positive pushes it backwards (hyperextension), so marching never goes above zero.
 *
 * `progress` is 0..1 through the current half cycle; `swinging` says whether this leg is in the air.
 * Both phases meet at MARCH_KNEE_MIN_BEND so the knee never pops at the stance/swing boundary.
 */
export const MARCH_KNEE_MIN_BEND = -0.15;
/** Extra soft flex while the leg takes the body's weight (peaks mid-stance). */
const STANCE_FLEX = 0.2;
/** Extra flex while the leg swings through (peaks mid-swing). */
const SWING_FLEX = 0.8;

export const marchKneeBend = (progress: number, swinging: boolean): number =>
  MARCH_KNEE_MIN_BEND - Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI) * (swinging ? SWING_FLEX : STANCE_FLEX);
