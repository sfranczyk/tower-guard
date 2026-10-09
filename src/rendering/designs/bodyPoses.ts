import type { Vec2 } from '../../types';
import { getArcherRig, type ArcherRig } from '../archer';
import { ATTACK_REST, CLUBS, ZOMBIE_REST, getAttackPose, type AttackPose, type AttackStyle } from '../attackSwing';
import { RUN_GROUND_Y, runArmSwing, runBounce, runFoot } from '../runCycle';
import { MARCH_HALF_STRIDE, TWO_HAND_GRIP, reachArm } from '../stickman';
import { walkFrame, type WalkStyle } from '../walkCycle';
import type { JointPose } from '../stickmanPose';
import { along, solveJoint } from './designSkeleton';

/**
 * The game's stickman animations as joint positions (pure, tested), so a new look can be drawn over
 * exactly the moves, proportions and hitboxes the game already has. Same numbers as drawStickman
 * (legs 30 + 30, arms 21 + 21, shoulder 35 and head 52 above the hip), with the feet on the ground at
 * BODY_FOOT_Y like the fall and cheer poses (which are JointPoses already).
 */
export const BODY_FOOT_Y = 57;

/** A pose plus what the hands hold. */
export interface BodyPose extends JointPose {
  /** A club from its butt (behind the fist) to its tip. */
  club?: { butt: Vec2; tip: Vec2 };
  /** A bow (archer rig: the rear hand holds the wood, the front hand draws) and its draw tension. */
  bow?: { rig: ArcherRig; tension: number };
}

const THIGH = 30;
const SHIN = 30;
const ARM = 21;
const MARCH_LIFT = 20;
/** Standing feet, like drawStickman's idle stance. */
const STANCE_HALF_WIDTH = 16;

const smooth = (u: number): number => u * u * (3 - 2 * u);
const wrap = (p: number): number => ((p % 1) + 1) % 1;
const shinAngle = (knee: Vec2, foot: Vec2): number => Math.atan2(foot.x - knee.x, foot.y - knee.y);

/** Torso, neck and head leaning `lean` radians forward about the hip. */
const torso = (hip: Vec2, lean: number): Pick<JointPose, 'hip' | 'shoulder' | 'neckTop' | 'head'> => {
  const up = (distance: number): Vec2 => ({ x: hip.x + Math.sin(lean) * distance, y: hip.y - Math.cos(lean) * distance });
  return { hip, shoulder: up(35), neckTop: up(43), head: up(52) };
};

/** A foot out of the leg's reach (a long step while the hip rises) steps in just enough. */
const inReach = (hip: Vec2, foot: Vec2): Vec2 => {
  const reach = THIGH + SHIN - 0.05;
  const dy = foot.y - hip.y;
  const dx = foot.x - hip.x;
  if (dx * dx + dy * dy <= reach * reach) {
    return foot;
  }
  return { x: hip.x + Math.sign(dx) * Math.sqrt(Math.max(0, reach * reach - dy * dy)), y: foot.y };
};

const legs = (hip: Vec2, frontTarget: Vec2, rearTarget: Vec2): Pick<JointPose, 'frontKnee' | 'frontFoot' | 'rearKnee' | 'rearFoot' | 'frontShinAngle' | 'rearShinAngle'> => {
  const front = inReach(hip, frontTarget);
  const rear = inReach(hip, rearTarget);
  const frontKnee = solveJoint(hip, front, THIGH, SHIN, 1);
  const rearKnee = solveJoint(hip, rear, THIGH, SHIN, 1);
  return {
    frontKnee, frontFoot: front, rearKnee, rearFoot: rear,
    frontShinAngle: shinAngle(frontKnee, front), rearShinAngle: shinAngle(rearKnee, rear),
  };
};

/** Upper arm at `angle` (0 = hanging, π/2 = forward, π = up) with the forearm bent `bend` further. */
const arm = (shoulder: Vec2, angle: number, bend: number): { elbow: Vec2; hand: Vec2 } => {
  const elbow = along(shoulder, angle, ARM);
  return { elbow, hand: along(elbow, angle + bend, ARM) };
};

/** A club held in the fist at the end of a forearm, as drawStickman holds it (the wrist tilts it). */
const clubFrom = (hand: Vec2, forearmAngle: number, clubTilt: number, style: AttackStyle): BodyPose['club'] => {
  const shape = CLUBS[style];
  const direction = { x: Math.cos(clubTilt - forearmAngle), y: Math.sin(clubTilt - forearmAngle) };
  return {
    butt: { x: hand.x - direction.x * shape.butt, y: hand.y - direction.y * shape.butt },
    tip: { x: hand.x + direction.x * shape.reach, y: hand.y + direction.y * shape.reach },
  };
};

export interface WalkOptions {
  /** Club style carried in the front hand (none: both arms swing free). */
  club?: AttackStyle;
  /** Zombie: arms held out in front, leaning forward, dragging the feet. */
  zombie?: boolean;
  /** Torso lean (radians forward); the game leans the whole sprite instead and passes 0. */
  lean?: number;
  /** 'walk' (default) or the old high-stepping 'march' (black knights); a zombie always shuffles (the march, dragged). */
  style?: WalkStyle;
}

/**
 * Walk at progress p (cycles; one cycle is two steps, like 2π of drawStickman's phase): the natural walk
 * (rendering/walkCycle.ts) or the march.
 */
export const walkBody = (p: number, options: WalkOptions = {}): BodyPose =>
  (options.zombie || options.style === 'march' ? marchBody(p, options) : naturalWalkBody(p, options));

/** The natural walk: heel to toe, the swinging foot low, the hips bobbing, loose arms. Feet are turned by their own pitch. */
const naturalWalkBody = (p: number, options: WalkOptions): BodyPose => {
  const frame = walkFrame(p);
  const hip = { x: 0, y: frame.hipY };
  const body = torso(hip, options.lean ?? 0.06);
  const foot = ({ x, lift }: { x: number; lift: number }): Vec2 => ({ x, y: BODY_FOOT_Y - lift });
  const legPose = legs(hip, foot(frame.front), foot(frame.rear));
  const frontAngle = -frame.rearArm;
  const front = arm(body.shoulder, frontAngle, options.club ? ATTACK_REST.forearmBend : frame.elbowBend(frontAngle));
  const rear = arm(body.shoulder, frame.rearArm, frame.elbowBend(frame.rearArm));
  return {
    ...body,
    ...legPose,
    // The feet roll heel to toe rather than following the shins (footShape turns them by this angle).
    frontShinAngle: frame.front.pitch,
    rearShinAngle: frame.rear.pitch,
    frontElbow: front.elbow, frontHand: front.hand, rearElbow: rear.elbow, rearHand: rear.hand,
    club: options.club ? clubFrom(front.hand, frontAngle + ATTACK_REST.forearmBend, 0, options.club) : undefined,
  };
};

/** The march (and the zombie's shuffle on it): high-lifted feet, straight arms swinging wide. */
const marchBody = (p: number, options: WalkOptions): BodyPose => {
  const cycle = wrap(p);
  const frontSwinging = cycle < 0.5;
  const progress = frontSwinging ? cycle * 2 : (cycle - 0.5) * 2;
  const eased = smooth(progress);
  const lift = options.zombie ? MARCH_LIFT * 0.35 : MARCH_LIFT;
  const swingFoot = { x: -MARCH_HALF_STRIDE + eased * MARCH_HALF_STRIDE * 2, y: BODY_FOOT_Y - Math.sin(progress * Math.PI) * lift };
  const stanceFoot = { x: MARCH_HALF_STRIDE - eased * MARCH_HALF_STRIDE * 2, y: BODY_FOOT_Y };
  // Highest over the planted foot, lowest with both feet down (still within reach of both).
  const hip = { x: 0, y: 1.25 - 1.4 * Math.sin(progress * Math.PI) };
  const swing = (frontSwinging ? 1 : -1) * Math.sin(progress * Math.PI) * 0.58;
  const lean = options.zombie ? ZOMBIE_REST.torsoLean : options.lean ?? 0.06;
  const body = torso(hip, lean);
  let front: { elbow: Vec2; hand: Vec2 };
  let rear: { elbow: Vec2; hand: Vec2 };
  let club: BodyPose['club'];
  if (options.zombie) {
    const sway = Math.sin(p * Math.PI * 2);
    front = arm(body.shoulder, ZOMBIE_REST.armAngle + sway * 0.07, ZOMBIE_REST.forearmBend);
    rear = arm(body.shoulder, ZOMBIE_REST.rearArmAngle + Math.sin(p * Math.PI * 2 + 1.3) * 0.07, ZOMBIE_REST.forearmBend);
  } else {
    front = arm(body.shoulder, -swing, options.club ? ATTACK_REST.forearmBend : 0.2);
    rear = arm(body.shoulder, swing, 0.2);
    if (options.club) {
      club = clubFrom(front.hand, -swing + ATTACK_REST.forearmBend, 0, options.club);
    }
  }
  return {
    ...body,
    ...legs(hip, frontSwinging ? swingFoot : stanceFoot, frontSwinging ? stanceFoot : swingFoot),
    frontElbow: front.elbow, frontHand: front.hand, rearElbow: rear.elbow, rearHand: rear.hand,
    club,
  };
};

/** Run at progress p (cycles), drawStickman's run cycle: flight phases, high knees, pumping arms. */
export const runBody = (p: number, club?: AttackStyle, lean = 0.12): BodyPose => {
  const hip = { x: 0, y: BODY_FOOT_Y - RUN_GROUND_Y + runBounce(p) };
  const foot = (progress: number): Vec2 => {
    const { x, lift } = runFoot(progress);
    return { x, y: BODY_FOOT_Y - lift };
  };
  const body = torso(hip, lean);
  const swing = runArmSwing(p) * 0.9;
  const front = arm(body.shoulder, -swing, Math.PI / 2);
  const rear = arm(body.shoulder, swing, Math.PI / 2);
  return {
    ...body,
    ...legs(hip, foot(p), foot(p + 0.5)),
    frontElbow: front.elbow, frontHand: front.hand, rearElbow: rear.elbow, rearHand: rear.hand,
    club: club ? clubFrom(front.hand, -swing + Math.PI / 2, 0, club) : undefined,
  };
};

/** A club swing (or the zombie's grab) at progress 0..1, standing, as the game plays it. */
export const attackBody = (progress: number, style: AttackStyle): BodyPose => {
  const attack: AttackPose = getAttackPose(progress, style);
  const hip = { x: 0, y: BODY_FOOT_Y - 55 + attack.dip };
  const body = torso(hip, attack.torsoLean);
  const front = arm(body.shoulder, attack.armAngle, attack.forearmBend);
  const forearmAngle = attack.armAngle + attack.forearmBend;
  const club = style === 'grab' ? undefined : clubFrom(front.hand, forearmAngle, attack.clubTilt, style);
  let rear = arm(body.shoulder, attack.rearArmAngle, style === 'grab' ? attack.forearmBend : 0.2);
  if (club && CLUBS[style].twoHanded) {
    const length = Math.hypot(club.tip.x - club.butt.x, club.tip.y - club.butt.y) || 1;
    const grip = {
      x: front.hand.x - ((club.tip.x - club.butt.x) / length) * TWO_HAND_GRIP,
      y: front.hand.y - ((club.tip.y - club.butt.y) / length) * TWO_HAND_GRIP,
    };
    rear = reachArm(body.shoulder, grip);
  }
  return {
    ...body,
    ...legs(hip, { x: STANCE_HALF_WIDTH + attack.step, y: BODY_FOOT_Y }, { x: -STANCE_HALF_WIDTH, y: BODY_FOOT_Y }),
    frontElbow: front.elbow, frontHand: front.hand, rearElbow: rear.elbow, rearHand: rear.hand,
    club,
  };
};

/**
 * A spell cast at progress 0..1 (the dark priest healing): the scepter (an overhead club) comes up high, held there
 * with the free hand reaching out, then lowered. Starts and ends in the standing pose with the club.
 */
export const castBody = (progress: number): BodyPose => {
  const p = Math.max(0, Math.min(1, progress));
  const raise = smooth(Math.min(1, p / 0.3)) * (1 - smooth(Math.max(0, (p - 0.72) / 0.28)));
  const mix = (from: number, to: number): number => from + (to - from) * raise;
  const hip = { x: 0, y: BODY_FOOT_Y - 55 };
  const body = torso(hip, mix(0, -0.12));
  const armAngle = mix(ATTACK_REST.armAngle, 2.75);
  const bend = mix(ATTACK_REST.forearmBend, 0.08);
  const front = arm(body.shoulder, armAngle, bend);
  // The wrist turns the scepter from pointing forward to straight up.
  const club = clubFrom(front.hand, armAngle + bend, mix(0, 1.25), 'overhead');
  const rear = arm(body.shoulder, mix(ATTACK_REST.rearArmAngle, 1.35), mix(0.2, 0.35));
  return {
    ...body,
    ...legs(hip, { x: STANCE_HALF_WIDTH, y: BODY_FOOT_Y }, { x: -STANCE_HALF_WIDTH, y: BODY_FOOT_Y }),
    frontElbow: front.elbow, frontHand: front.hand, rearElbow: rear.elbow, rearHand: rear.hand,
    club,
  };
};

/** Standing still, arms hanging (the end of an attack, a pause in the walk). */
export const standBody = (club?: AttackStyle): BodyPose => (club ? attackBody(0, club) : { ...attackBody(0, 'overhead'), club: undefined });

/**
 * An archer (the game's archer rig): the rear hand holds the bow, the front hand draws the string.
 * `aim` is the aim angle (radians, + = down), `ready` 0 = bow lowered … 1 = raised, `walk` the walk
 * progress or undefined to stand.
 */
export const archerBody = (aim: number, tension: number, ready: number, walk?: number): BodyPose =>
  archerOn(walk === undefined ? standBody() : walkBody(walk), aim, tension, ready);

/** The archer rig on `base` (its legs and hip; its front arm swings while the bow is lowered). */
const archerOn = (base: BodyPose, aim: number, tension: number, ready: number): BodyPose => {
  // The archer rig pivots at the neck of an upright stickman with the hip at the origin.
  const body = torso(base.hip, 0);
  const shift = { x: body.hip.x, y: body.hip.y };
  const unshift = (point: Vec2): Vec2 => ({ x: point.x - shift.x, y: point.y - shift.y });
  const rig = getArcherRig(aim, tension, ready, { elbow: unshift(base.frontElbow), hand: unshift(base.frontHand) });
  const move = (point: Vec2): Vec2 => ({ x: point.x + shift.x, y: point.y + shift.y });
  const moved: ArcherRig = {
    woodHand: move(rig.woodHand), woodElbow: move(rig.woodElbow), stringHand: move(rig.stringHand),
    stringElbow: move(rig.stringElbow), stringNock: move(rig.stringNock), bowTop: move(rig.bowTop),
    bowBottom: move(rig.bowBottom), bowControl: move(rig.bowControl),
  };
  return {
    ...base,
    ...body,
    rearElbow: moved.woodElbow, rearHand: moved.woodHand, frontElbow: moved.stringElbow, frontHand: moved.stringHand,
    club: undefined,
    bow: { rig: moved, tension: tension * ready },
  };
};

const mixPoint = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/**
 * The player: drawStickman's blends of walk, sprint and standing (`phase` in walk cycles, `runningBlend`
 * 0 walk … 1 sprint, `idleBlend` 0 moving … 1 standing) under the archer rig. Hip, feet and the free arm are
 * blended, and the knees solved again, so the legs keep their length through every blend.
 */
export const bowmanBody = (
  phase: number, idleBlend: number, runningBlend: number, aim: number, tension: number, ready: number,
): BodyPose => {
  const walk = walkBody(phase, { lean: 0 });
  const run = runBody(phase + 0.4, undefined, 0);
  const stand = standBody();
  const blend = (key: 'hip' | 'frontFoot' | 'rearFoot' | 'frontElbow' | 'frontHand'): Vec2 =>
    mixPoint(mixPoint(walk[key], run[key], runningBlend), stand[key], idleBlend);
  const hip = blend('hip');
  const base: BodyPose = {
    ...torso(hip, 0),
    ...legs(hip, blend('frontFoot'), blend('rearFoot')),
    frontElbow: blend('frontElbow'), frontHand: blend('frontHand'), rearElbow: stand.rearElbow, rearHand: stand.rearHand,
  };
  return archerOn(base, aim, tension, ready);
};

/** A joint pose (cheer, pinned struggle) holding the club along the forearm, like drawJointPose's `club`. */
export const withClub = (pose: JointPose): BodyPose => {
  const { frontElbow: elbow, frontHand: hand } = pose;
  const length = Math.hypot(hand.x - elbow.x, hand.y - elbow.y) || 1;
  const d = { x: (hand.x - elbow.x) / length, y: (hand.y - elbow.y) / length };
  return { ...pose, club: { butt: { x: hand.x - d.x * 8, y: hand.y - d.y * 8 }, tip: { x: hand.x + d.x * 28, y: hand.y + d.y * 28 } } };
};
