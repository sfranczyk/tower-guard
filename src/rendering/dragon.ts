import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import { STICKMAN_HEAD } from './stickman';
import { drawBow, getArcherRig, type ArcherRig } from './archer';
import { drawJointPose, drawRearLeg, type JointPose } from './stickmanPose';

/**
 * A flying dragon with a stickman rider, in the flat landscape style. `getDragonPose` is pure (tested):
 * the wings beat in a loop (the far wing a little behind), the body bobs up on every downstroke, the
 * neck and tail undulate, and the rider sits in the saddle, holding the reins and a raised spear.
 *
 * Sprite space like drawStickman: the saddle sits around the origin, facing +x; y grows downward.
 */

export const DRAGON_FLAP_MS = 900;
/** Archer rider: one draw-and-release cycle. */
export const DRAGON_ARCHER_SHOT_MS = 1600;

/** What the rider holds: a raised spear, or a bow aimed down ahead of the dragon. */
export type DragonRider = 'spear' | 'archer';

const DRAGON = {
  body: 0xb5473a,
  bodyDark: 0x8e3a33,
  belly: 0xf0c38a,
  wingNear: 0x9c3d35,
  wingFar: 0x6e2a26,
  bone: 0x5a221e,
  horn: 0xeadfc6,
  eye: 0xffd35a,
  spear: 0x7a5a38,
  spearTip: 0xd7dde3,
} as const;

export interface WingPose {
  shoulder: Vec2;
  wrist: Vec2;
  tip: Vec2;
  /** Trailing edge of the membrane, back towards the body. */
  trail: Vec2[];
}

export interface DragonPose {
  /** Vertical bob of the whole body (− = up). */
  bob: number;
  /** Spine from the tail tip to the head, used for tail, body and neck. */
  tail: Vec2[];
  neck: Vec2[];
  head: Vec2;
  /** Head tilt in radians (+ = nose down). */
  headTilt: number;
  nearWing: WingPose;
  farWing: WingPose;
  /** Where the rider's hip sits. */
  saddle: Vec2;
  rider: JointPose;
  /** Spear rider: from the raised hand to its point. */
  spear?: { butt: Vec2; tip: Vec2 };
  /** Archer rider: the bow rig in sprite space, and the nocked arrow while the string is drawn. */
  bow?: { rig: ArcherRig; tension: number; arrow?: { nock: Vec2; tip: Vec2 } };
}

const rotate = (point: Vec2, angle: number): Vec2 => ({
  x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
  y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
});
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
const limb = (from: Vec2, angle: number, length: number): Vec2 => ({ x: from.x + Math.sin(angle) * length, y: from.y + Math.cos(angle) * length });

/**
 * Wing for a flap value (+1 = top of the upstroke, −1 = bottom of the downstroke). Seen from the side
 * the wing swings from straight up, back over the spine, to down behind the belly; mid-stroke it points
 * at the viewer, so it's drawn shorter there (foreshortening).
 */
const wing = (shoulder: Vec2, flap: number, size: number): WingPose => {
  const angle = -Math.PI + flap * 1.35;
  const length = size * (0.5 + 0.5 * Math.abs(flap));
  const direction = (offset: number): Vec2 => ({ x: Math.cos(angle + offset), y: Math.sin(angle + offset) });
  const along = (from: Vec2, offset: number, distance: number): Vec2 => {
    const d = direction(offset);
    return { x: from.x + d.x * distance, y: from.y + d.y * distance };
  };
  // The arm bends back from the wrist (smoothly through mid-stroke), so the tip trails behind the wrist.
  const backward = -0.35 * flap;
  const wrist = along(shoulder, 0, 62 * length);
  const tip = along(wrist, backward, 92 * length);
  const trail = [
    along(wrist, backward - 0.9 * flap, 58 * length),
    { x: shoulder.x - 58, y: shoulder.y + 10 },
    { x: shoulder.x - 22, y: shoulder.y + 10 },
  ];
  return { shoulder, wrist, tip, trail };
};

/** Two-bone arm (21 + 21) reaching for `target` with a natural (forward) elbow bend. */
const reach = (shoulder: Vec2, target: Vec2): { elbow: Vec2; hand: Vec2 } => {
  const length = 21;
  const distance = Math.max(1, Math.min(41.9, Math.hypot(target.x - shoulder.x, target.y - shoulder.y)));
  const base = Math.atan2(target.x - shoulder.x, target.y - shoulder.y);
  const elbow = limb(shoulder, base - Math.acos(distance / (length * 2)), length);
  return { elbow, hand: limb(elbow, Math.atan2(target.x - elbow.x, target.y - elbow.y), length) };
};

/** Archer rider's aim: down and ahead of the dragon (radians, + = below horizontal). */
const ARCHER_AIM = 0.55;

/** Archer rig placed on the rider: rotated by the torso lean about the hip, then moved to the saddle. */
const placeRig = (rig: ArcherRig, hip: Vec2, lean: number): ArcherRig => {
  const place = (point: Vec2): Vec2 => add(hip, rotate(point, lean));
  return {
    woodHand: place(rig.woodHand),
    woodElbow: place(rig.woodElbow),
    stringHand: place(rig.stringHand),
    stringElbow: place(rig.stringElbow),
    stringNock: place(rig.stringNock),
    bowTop: place(rig.bowTop),
    bowBottom: place(rig.bowBottom),
    bowControl: place(rig.bowControl),
  };
};

/** Draw then release: tension rises over most of the cycle and snaps back at the shot. */
const archerTension = (timeMs: number): number => {
  const t = ((timeMs % DRAGON_ARCHER_SHOT_MS) + DRAGON_ARCHER_SHOT_MS) % DRAGON_ARCHER_SHOT_MS / DRAGON_ARCHER_SHOT_MS;
  if (t < 0.15) {
    return 0;
  }
  if (t < 0.8) {
    const p = (t - 0.15) / 0.65;
    return p * p * (3 - 2 * p);
  }
  // Released: the string springs back quickly.
  return Math.max(0, 1 - (t - 0.8) / 0.06);
};

/** Game control of the archer rider: aim (local radians, + = down) and draw (0..1), instead of the lab loop. */
export interface ArcherControl {
  aim: number;
  tension: number;
}

/** Pose at `timeMs` (wings loop every DRAGON_FLAP_MS). */
export const getDragonPose = (timeMs: number, riderKind: DragonRider = 'spear', archer?: ArcherControl): DragonPose => {
  const phase = ((timeMs % DRAGON_FLAP_MS) + DRAGON_FLAP_MS) % DRAGON_FLAP_MS / DRAGON_FLAP_MS * Math.PI * 2;
  const flap = Math.sin(phase);
  // The body rises on the downstroke (a quarter period after the wings peak).
  const bob = -Math.cos(phase) * 7;
  const wave = (offset: number): number => Math.sin(phase - offset);

  const tail: Vec2[] = Array.from({ length: 9 }, (_, index) => {
    const t = index / 8;
    return { x: -150 + t * 120, y: 18 - t * 10 + bob + wave(1.6 - t * 1.2) * (1 - t) * 12 };
  });
  const neck: Vec2[] = Array.from({ length: 6 }, (_, index) => {
    const t = index / 5;
    return { x: 40 + t * 46, y: -4 - t * 40 + bob + wave(0.9 - t * 0.5) * t * 5 };
  });
  const head = neck[neck.length - 1];
  const saddle = { x: -4, y: -24 + bob };

  // Rider: sits on the saddle, rocks slightly behind the dragon's bob.
  const lean = 0.12 + Math.sin(phase - 0.6) * 0.05;
  const hip = saddle;
  const shoulder = { x: hip.x + Math.sin(lean) * 35, y: hip.y - Math.cos(lean) * 35 };
  const headUp = { x: Math.sin(lean), y: -Math.cos(lean) };
  // Astride: the near leg hangs along the flank with the foot back under the belly; the far leg mirrors it
  // on the other side, hidden behind the body.
  const frontKnee = limb(hip, 0.8, 30);
  const frontFoot = limb(frontKnee, -0.35, 30);
  const rearKnee = limb({ x: hip.x + 3, y: hip.y }, 0.7, 30);
  const rearFoot = limb(rearKnee, -0.45, 30);
  // Spear rider: front hand on the reins, rear hand holds the spear up. Archer: both hands on the bow.
  const reins = reach(shoulder, { x: neck[1].x - 4, y: neck[1].y - 6 });
  const spearArm = reach(shoulder, { x: shoulder.x - 2, y: shoulder.y - 34 + Math.sin(phase) * 2 });
  const spearAngle = -1.05 + Math.sin(phase - 0.6) * 0.04;
  const spearDirection = { x: Math.cos(spearAngle), y: Math.sin(spearAngle) };
  const tension = riderKind === 'archer' ? (archer?.tension ?? archerTension(timeMs)) : 0;
  const aim = archer?.aim ?? ARCHER_AIM;
  const rig = riderKind === 'archer' ? placeRig(getArcherRig(aim - lean, tension, 1), hip, lean) : undefined;
  const rider: JointPose = {
    hip,
    shoulder,
    neckTop: { x: shoulder.x + headUp.x * 8, y: shoulder.y + headUp.y * 8 },
    head: { x: shoulder.x + headUp.x * (-STICKMAN_HEAD.y - 35), y: shoulder.y + headUp.y * (-STICKMAN_HEAD.y - 35) },
    frontKnee,
    frontFoot,
    rearKnee,
    rearFoot,
    // Like drawStickman's archer: the rear arm holds the bow, the front arm draws the string.
    frontElbow: rig ? rig.stringElbow : reins.elbow,
    frontHand: rig ? rig.stringHand : reins.hand,
    rearElbow: rig ? rig.woodElbow : spearArm.elbow,
    rearHand: rig ? rig.woodHand : spearArm.hand,
    frontShinAngle: 0.15,
    rearShinAngle: 0.05,
  };

  return {
    bob,
    tail,
    neck,
    head,
    headTilt: 0.15 + wave(0.4) * 0.06,
    nearWing: wing({ x: 8, y: -16 + bob }, flap, 1),
    farWing: wing({ x: 20, y: -20 + bob }, Math.sin(phase - 0.35), 0.85),
    saddle,
    rider,
    spear: rig ? undefined : {
      butt: { x: spearArm.hand.x - spearDirection.x * 26, y: spearArm.hand.y - spearDirection.y * 26 },
      tip: { x: spearArm.hand.x + spearDirection.x * 74, y: spearArm.hand.y + spearDirection.y * 74 },
    },
    bow: rig ? {
      rig,
      tension,
      arrow: tension > 0.05
        ? { nock: rig.stringNock, tip: add(rig.stringNock, rotate({ x: 36, y: 0 }, aim)) }
        : undefined,
    } : undefined,
  };
};

/** One hit zone in the dragon's sprite space: the box around `points`, padded by `padding`. */
export interface DragonHitZone {
  points: Vec2[];
  padding: number;
  headshot: boolean;
  part: 'rider' | 'head' | 'neck' | 'body' | 'tail';
}

/** Body box up to the back ridge (the rider above it is a zone of his own). */
const BODY_BOX = { left: -66, right: 66, top: -28, bottom: 28 };
/** Head zone: from the skull centre to this far along the snout, padded. */
const HEAD_ZONE = { snout: 26, radius: 11 };
/** Neck and tail thickness (as drawn), for padding their zones. */
const NECK_WIDTH = { base: 26, head: 13 };
const TAIL_WIDTH = { tip: 4, base: 22 };
/** Tail zones cover this many spine points each. */
const TAIL_STEP = 2;

/**
 * Every hit zone of a pose, in sprite space: the rider and the dragon's head are headshots; the body, the
 * neck (one zone per segment, from the chest to the head) and the curved tail are normal hits. Neighbouring
 * zones overlap, so there's no gap an arrow can slip through.
 */
export const dragonHitZones = (pose: DragonPose): DragonHitZone[] => {
  const { bob, head, headTilt, neck, tail, rider } = pose;
  const zones: DragonHitZone[] = [
    { part: 'rider', points: [rider.head, rider.shoulder], padding: STICKMAN_HEAD.radius, headshot: true },
    {
      part: 'head',
      points: [head, { x: head.x + Math.cos(headTilt) * HEAD_ZONE.snout, y: head.y + Math.sin(headTilt) * HEAD_ZONE.snout }],
      padding: HEAD_ZONE.radius,
      headshot: true,
    },
    {
      part: 'body',
      points: [
        { x: BODY_BOX.left, y: BODY_BOX.top + bob }, { x: BODY_BOX.right, y: BODY_BOX.top + bob },
        { x: BODY_BOX.left, y: BODY_BOX.bottom + bob }, { x: BODY_BOX.right, y: BODY_BOX.bottom + bob },
      ],
      padding: 0,
      headshot: false,
    },
  ];
  // The neck as drawn: from the chest (inside the body box) through every neck point to the head.
  const neckSpine = [{ x: 30, y: -2 + bob }, ...neck];
  for (let index = 1; index < neckSpine.length; index += 1) {
    const width = NECK_WIDTH.base + (NECK_WIDTH.head - NECK_WIDTH.base) * (index / (neckSpine.length - 1));
    zones.push({ part: 'neck', points: [neckSpine[index - 1], neckSpine[index]], padding: width / 2, headshot: false });
  }
  for (let index = 0; index + TAIL_STEP < tail.length; index += TAIL_STEP) {
    const width = TAIL_WIDTH.tip + (TAIL_WIDTH.base - TAIL_WIDTH.tip) * ((index + TAIL_STEP) / (tail.length - 1));
    zones.push({ part: 'tail', points: [tail[index], tail[index + TAIL_STEP]], padding: width / 2, headshot: false });
  }
  return zones;
};

const drawWing = (g: Graphics, wingPose: WingPose, membrane: number): void => {
  const { shoulder, wrist, tip, trail } = wingPose;
  g.poly([shoulder, wrist, tip, ...trail].flatMap((point) => [point.x, point.y])).fill({ color: membrane });
  g.moveTo(shoulder.x, shoulder.y).lineTo(wrist.x, wrist.y).lineTo(tip.x, tip.y)
    .stroke({ width: 4, color: DRAGON.bone, cap: 'round', join: 'round' });
  // Finger bones fanning from the wrist to the trailing edge.
  trail.slice(0, 2).forEach((point) => g.moveTo(wrist.x, wrist.y).lineTo(point.x, point.y).stroke({ width: 2, color: DRAGON.bone, cap: 'round' }));
};

/** Thick tapering stroke through `points` (width from `from` to `to`). */
const tapered = (g: Graphics, points: Vec2[], from: number, to: number, color: number): void => {
  for (let index = 1; index < points.length; index += 1) {
    const t = index / (points.length - 1);
    g.moveTo(points[index - 1].x, points[index - 1].y).lineTo(points[index].x, points[index].y)
      .stroke({ width: from + (to - from) * t, color, cap: 'round' });
  }
};

/** Draws the dragon and its rider (spear or bow), at `timeMs`. */
export const drawDragonRider = (g: Graphics, timeMs: number, riderKind: DragonRider = 'spear', archer?: ArcherControl): DragonPose => {
  const pose = getDragonPose(timeMs, riderKind, archer);
  g.clear();
  drawWing(g, pose.farWing, DRAGON.wingFar);
  // The rider's far leg is on the other side of the dragon: drawn before the body so it's hidden.
  drawRearLeg(g, pose.rider);

  // Tail: tapering from the body to a spade tip.
  tapered(g, pose.tail, 4, 22, DRAGON.body);
  const tip = pose.tail[0];
  const back = pose.tail[1];
  const angle = Math.atan2(tip.y - back.y, tip.x - back.x);
  const spade = [{ x: 14, y: 0 }, { x: -2, y: -8 }, { x: 2, y: 0 }, { x: -2, y: 8 }].map((point) => add(tip, rotate(point, angle)));
  g.poly(spade.flatMap((point) => [point.x, point.y])).fill({ color: DRAGON.bodyDark });

  // Legs tucked under the body.
  const y = pose.bob;
  [[-30, 0.5], [30, 0.3]].forEach(([x, bend]) => {
    const hipJoint = { x, y: 12 + y };
    const knee = limb(hipJoint, 0.8 + bend, 14);
    const foot = limb(knee, -0.6, 12);
    g.moveTo(hipJoint.x, hipJoint.y).lineTo(knee.x, knee.y).lineTo(foot.x, foot.y).stroke({ width: 7, color: DRAGON.bodyDark, cap: 'round', join: 'round' });
  });

  // Body with a pale belly and back ridge spikes.
  g.ellipse(0, 4 + y, 66, 24).fill({ color: DRAGON.body });
  g.ellipse(6, 14 + y, 52, 11).fill({ color: DRAGON.belly });
  [-44, -28, -12, 20].forEach((x) => g.poly([x - 6, -16 + y, x, -28 + y, x + 6, -16 + y]).fill({ color: DRAGON.bodyDark }));

  // Neck and head.
  tapered(g, [{ x: 30, y: -2 + y }, ...pose.neck], 26, 13, DRAGON.body);
  const head = pose.head;
  const nose = rotate({ x: 1, y: 0 }, pose.headTilt);
  const along = (distance: number, side = 0): Vec2 => ({ x: head.x + nose.x * distance - nose.y * side, y: head.y + nose.y * distance + nose.x * side });
  g.ellipse(head.x + nose.x * 4, head.y + nose.y * 4, 15, 10).fill({ color: DRAGON.body });
  g.poly([along(6, -7), along(30, -2), along(31, 3), along(6, 8)].flatMap((point) => [point.x, point.y])).fill({ color: DRAGON.body });
  g.poly([along(10, 5), along(29, 4), along(10, 9)].flatMap((point) => [point.x, point.y])).fill({ color: DRAGON.belly });
  [[-4, -8], [-9, -6]].forEach(([distance, side]) => {
    const base = along(distance, side);
    const end = along(distance - 16, side - 9);
    g.moveTo(base.x, base.y).quadraticCurveTo(along(distance - 6, side - 10).x, along(distance - 6, side - 10).y, end.x, end.y)
      .stroke({ width: 3.5, color: DRAGON.horn, cap: 'round' });
  });
  const eye = along(10, -4);
  g.circle(eye.x, eye.y, 2.6).fill({ color: DRAGON.eye });
  g.circle(eye.x + 0.6, eye.y, 1.1).fill({ color: 0x2b1a14 });

  drawWing(g, pose.nearWing, DRAGON.wingNear);

  // The rider (skeleton look, near leg over the flank) and the weapon, on top of the dragon.
  drawJointPose(g, pose.rider, 0, { append: true, hideRearLeg: true });
  if (pose.bow) {
    drawBow(g, pose.bow.rig);
    const { arrow } = pose.bow;
    if (arrow) {
      g.moveTo(arrow.nock.x, arrow.nock.y).lineTo(arrow.tip.x, arrow.tip.y).stroke({ width: 1.6, color: DRAGON.spear, cap: 'round' });
      g.circle(arrow.tip.x, arrow.tip.y, 1.8).fill({ color: DRAGON.spearTip });
    }
    return pose;
  }
  if (!pose.spear) {
    return pose;
  }
  const rider = g;
  rider.moveTo(pose.spear.butt.x, pose.spear.butt.y).lineTo(pose.spear.tip.x, pose.spear.tip.y).stroke({ width: 3, color: DRAGON.spear, cap: 'round' });
  const direction = { x: pose.spear.tip.x - pose.spear.butt.x, y: pose.spear.tip.y - pose.spear.butt.y };
  const length = Math.hypot(direction.x, direction.y) || 1;
  const unit = { x: direction.x / length, y: direction.y / length };
  const point = pose.spear.tip;
  rider.poly([point.x + unit.x * 10, point.y + unit.y * 10, point.x - unit.y * 4, point.y + unit.x * 4, point.x + unit.y * 4, point.y - unit.x * 4])
    .fill({ color: DRAGON.spearTip });
  return pose;
};
