import type { Vec2 } from '../types';
import { STICKMAN_HEAD } from './stickman';
import { getArcherRig, type ArcherRig } from './archer';
import type { JointPose } from './stickmanPose';

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

/** What the rider holds: a raised spear, a bow aimed down ahead of the dragon, or just the reins (fire dragon). */
export type DragonRider = 'spear' | 'archer' | 'unarmed';

/** A dragon's hide: body, belly, wing membranes, bones, horns and eye. */
export interface DragonPalette {
  body: number;
  bodyDark: number;
  belly: number;
  wingNear: number;
  wingFar: number;
  bone: number;
  horn: number;
  eye: number;
  /** Inside of the open mouth. */
  mouth: number;
}

/** Red (the fire dragon) and dark brown, nearly black (the dragon archer). */
export const DRAGON_PALETTES = {
  red: {
    body: 0xb5473a,
    bodyDark: 0x8e3a33,
    belly: 0xf0c38a,
    wingNear: 0x9c3d35,
    wingFar: 0x6e2a26,
    bone: 0x5a221e,
    horn: 0xeadfc6,
    eye: 0xffd35a,
    mouth: 0x3a1210,
  },
  dark: {
    body: 0x3b2a22,
    bodyDark: 0x261a15,
    belly: 0x7a6250,
    wingNear: 0x33241d,
    wingFar: 0x1d1411,
    bone: 0x120c0a,
    horn: 0xd8ccb2,
    eye: 0xff9a3c,
    mouth: 0x5a1a12,
  },
} as const satisfies Record<string, DragonPalette>;

/** The rider's gear (spear shaft and point, arrow), the same on every dragon. */
export const DRAGON_GEAR = { spear: 0x7a5a38, spearTip: 0xd7dde3 } as const;

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
  /** How far the jaw hangs open (0 = shut, 1 = wide open, breathing fire). */
  jaw: number;
  /** Where fire leaves the mouth and its direction (radians, + = down), in sprite space. */
  mouth: { point: Vec2; angle: number };
}

/**
 * Fire breath control (rendering/dragonFire.ts schedules it): `rear` pulls the head back and up to draw
 * breath, `thrust` stretches the neck forward with the jaw wide open and the head turned to `aim`.
 */
export interface BreathControl {
  rear: number;
  thrust: number;
  /** Direction of the fire (local radians, + = down). */
  aim: number;
}

/** Jaw hinge and snout tip along the head (sprite units from the skull centre, and to the side). */
export const JAW_HINGE = { along: 4, side: 4 };
export const JAW_OPEN = 0.6;
const MOUTH_AT = { along: 30, side: 3 };

export const rotate = (point: Vec2, angle: number): Vec2 => ({
  x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
  y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
});
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const limb = (from: Vec2, angle: number, length: number): Vec2 => ({ x: from.x + Math.sin(angle) * length, y: from.y + Math.cos(angle) * length });

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
export const getDragonPose = (timeMs: number, riderKind: DragonRider = 'spear', archer?: ArcherControl, breath?: BreathControl): DragonPose => {
  const phase = ((timeMs % DRAGON_FLAP_MS) + DRAGON_FLAP_MS) % DRAGON_FLAP_MS / DRAGON_FLAP_MS * Math.PI * 2;
  const flap = Math.sin(phase);
  // The body rises on the downstroke (a quarter period after the wings peak).
  const bob = -Math.cos(phase) * 7;
  const wave = (offset: number): number => Math.sin(phase - offset);

  const tail: Vec2[] = Array.from({ length: 9 }, (_, index) => {
    const t = index / 8;
    return { x: -150 + t * 120, y: 18 - t * 10 + bob + wave(1.6 - t * 1.2) * (1 - t) * 12 };
  });
  const rear = breath?.rear ?? 0;
  const thrust = breath?.thrust ?? 0;
  // Drawing breath the neck curls back and up; breathing fire it stretches forward and down the aim.
  const neck: Vec2[] = Array.from({ length: 6 }, (_, index) => {
    const t = index / 5;
    return {
      x: 40 + t * 46 - rear * t * 16 + thrust * t * 12,
      y: -4 - t * 40 + bob + wave(0.9 - t * 0.5) * t * 5 * (1 - thrust) - rear * t * 10 + thrust * t * 8,
    };
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
  // Unarmed: both hands on the reins, the rear one a little lower.
  const reins = reach(shoulder, { x: neck[1].x - 4, y: neck[1].y - 6 });
  const rearReins = reach(shoulder, { x: neck[1].x - 10, y: neck[1].y - 1 });
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
    rearElbow: rig ? rig.woodElbow : riderKind === 'unarmed' ? rearReins.elbow : spearArm.elbow,
    rearHand: rig ? rig.woodHand : riderKind === 'unarmed' ? rearReins.hand : spearArm.hand,
    frontShinAngle: 0.15,
    rearShinAngle: 0.05,
  };

  const restTilt = 0.15 + wave(0.4) * 0.06;
  const jaw = Math.min(1, rear * 0.35 + thrust);
  // The fire leaves between the jaws, half the opening below the snout: tilt the head that much less,
  // so the stream itself goes along the aim.
  const aimTilt = (breath?.aim ?? restTilt) - jaw * JAW_OPEN * 0.5;
  const headTilt = restTilt - rear * 0.55 + thrust * (aimTilt - restTilt);
  const nose = { x: Math.cos(headTilt), y: Math.sin(headTilt) };
  // The fire comes out between the jaws: halfway between the upper snout and the dropped lower jaw.
  const mouthAngle = headTilt + jaw * JAW_OPEN * 0.5;
  const mouth = {
    point: {
      x: head.x + nose.x * MOUTH_AT.along - nose.y * MOUTH_AT.side,
      y: head.y + nose.y * MOUTH_AT.along + nose.x * MOUTH_AT.side,
    },
    angle: mouthAngle,
  };

  return {
    bob,
    tail,
    neck,
    head,
    headTilt,
    jaw,
    mouth,
    nearWing: wing({ x: 8, y: -16 + bob }, flap, 1),
    farWing: wing({ x: 20, y: -20 + bob }, Math.sin(phase - 0.35), 0.85),
    saddle,
    rider,
    spear: rig || riderKind === 'unarmed' ? undefined : {
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

/**
 * The hit zones of a pose, in sprite space (seven in all): the rider and the dragon's head are headshots;
 * the body, the neck (two halves, chest to head) and the tail (two halves) are normal hits. Neighbouring
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
  // Neck and tail: two zones each (the halves share their middle point, so they always touch), padded by
  // the drawn thickness at the thicker end of each half.
  const neckSpine = [{ x: 30, y: -2 + bob }, ...neck];
  const neckMiddle = Math.floor(neckSpine.length / 2);
  zones.push(
    { part: 'neck', points: neckSpine.slice(0, neckMiddle + 1), padding: NECK_WIDTH.base / 2, headshot: false },
    { part: 'neck', points: neckSpine.slice(neckMiddle), padding: (NECK_WIDTH.base + NECK_WIDTH.head) / 4, headshot: false },
  );
  const tailMiddle = Math.floor(tail.length / 2);
  zones.push(
    { part: 'tail', points: tail.slice(0, tailMiddle + 1), padding: (TAIL_WIDTH.tip + TAIL_WIDTH.base) / 4, headshot: false },
    { part: 'tail', points: tail.slice(tailMiddle), padding: TAIL_WIDTH.base / 2, headshot: false },
  );
  return zones;
};
