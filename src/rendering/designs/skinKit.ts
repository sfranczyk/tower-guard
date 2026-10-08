import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../../types';
import type { BodyPose } from './bodyPoses';
import { limb, shape } from './designShapes';

/**
 * Drawing a look ("skin") over a BodyPose. Everything is placed in the body's own frames, so the same
 * skin works standing, running, swinging, lying on its back or face down.
 */

/** A frame: `up` along the torso (hip → shoulder) or the neck, `fwd` the way the chest faces. */
export interface Frame {
  up: Vec2;
  fwd: Vec2;
}

const unit = (from: Vec2, to: Vec2): Vec2 => {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
};

/** Turning `up` a quarter turn gives the chest's direction (+x when upright, facing right). */
const frameOf = (up: Vec2): Frame => ({ up, fwd: { x: -up.y, y: up.x } });

export const torsoFrame = (pose: BodyPose): Frame => frameOf(unit(pose.hip, pose.shoulder));
export const headFrame = (pose: BodyPose): Frame => frameOf(unit(pose.neckTop, pose.head));

/** The point `u` along up and `f` along forward from `base`. */
export const at = (base: Vec2, frame: Frame, u: number, f: number): Vec2 => ({
  x: base.x + frame.up.x * u + frame.fwd.x * f,
  y: base.y + frame.up.y * u + frame.fwd.y * f,
});

/** A polygon given in (u, f) pairs around `base`. */
export const shapeIn = (g: Graphics, base: Vec2, frame: Frame, points: ReadonlyArray<readonly [number, number]>, color: number, alpha = 1): void =>
  shape(g, points.map(([u, f]) => at(base, frame, u, f)), color, alpha);

/** An ellipse in a frame (rx along forward, ry along up). */
export const ellipseIn = (g: Graphics, center: Vec2, frame: Frame, rx: number, ry: number, color: number, alpha = 1): void => {
  const points = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    return at(center, frame, Math.sin(a) * ry, Math.cos(a) * rx);
  });
  shape(g, points, color, alpha);
};

/** Toe direction of a foot, as drawJointPose points it (from the shin angle). */
export const toeOf = (shinAngle: number): Vec2 => ({ x: Math.cos(shinAngle), y: -Math.sin(shinAngle) });

/** A shoe or bare foot under the ankle, sole along the toe direction. */
export const footShape = (g: Graphics, foot: Vec2, shinAngle: number, length: number, height: number, color: number): void => {
  const toe = toeOf(shinAngle);
  // Up from the sole, towards the ankle.
  const lift = { x: toe.y, y: -toe.x };
  // The sole sits about a pixel below the ankle joint (the ground).
  const sole = { x: foot.x + lift.x * (height / 2 - 1), y: foot.y + lift.y * (height / 2 - 1) };
  limb(g, { x: sole.x - toe.x * 3, y: sole.y - toe.y * 3 }, { x: sole.x + toe.x * (length - 3), y: sole.y + toe.y * (length - 3) }, height, height * 0.85, color);
};

export interface LimbLook {
  /** Upper arm / thigh colour and widths at the joint ends. */
  upper: number;
  lower: number;
  upperWidth: [number, number];
  lowerWidth: [number, number];
}

export interface HumanoidLook {
  arm: LimbLook;
  armFar: LimbLook;
  leg: LimbLook;
  legFar: LimbLook;
  hand: number;
  handFar: number;
  handRadius: number;
  foot: { color: number; colorFar: number; length: number; height: number };
  /** Behind everything (a cape, a quiver). */
  back?: (g: Graphics, pose: BodyPose) => void;
  torso: (g: Graphics, pose: BodyPose, frame: Frame) => void;
  /** Over the near leg (an apron, a loincloth, a bomb). */
  overLegs?: (g: Graphics, pose: BodyPose, frame: Frame) => void;
  head: (g: Graphics, pose: BodyPose, frame: Frame) => void;
  /** The club, drawn under the near fist. */
  club?: (g: Graphics, butt: Vec2, tip: Vec2) => void;
  /** Something held in the far or near fist (drawn over the forearm, under the fist). */
  heldFar?: (g: Graphics, elbow: Vec2, hand: Vec2) => void;
  heldNear?: (g: Graphics, elbow: Vec2, hand: Vec2) => void;
  /**
   * The bow, in two layers: `'back'` (limbs and string) with the far hand that holds it, behind the body, so the
   * near arm swings in front of it; `'front'` (the nocked arrow) over everything but the string hand.
   */
  bow?: (g: Graphics, pose: BodyPose, layer: BowLayer) => void;
  /** Leave out the far leg (a rider's, hidden behind the mount). */
  hideFarLeg?: boolean;
}

export type BowLayer = 'back' | 'front';

const drawLimb = (g: Graphics, root: Vec2, joint: Vec2, end: Vec2, look: LimbLook): void => {
  limb(g, root, joint, look.upperWidth[0], look.upperWidth[1], look.upper);
  limb(g, joint, end, look.lowerWidth[0], look.lowerWidth[1], look.lower);
};

/**
 * Back to front: far arm, far leg, back gear, torso, near leg, head, club, near arm. An archer's bow
 * arm is the far one (as in drawStickman) with the bow in it, behind the body; the arrow goes over the
 * body and the string hand last.
 */
export const drawHumanoid = (g: Graphics, pose: BodyPose, look: HumanoidLook): void => {
  const frame = torsoFrame(pose);
  look.back?.(g, pose);
  drawLimb(g, pose.shoulder, pose.rearElbow, pose.rearHand, look.armFar);
  look.heldFar?.(g, pose.rearElbow, pose.rearHand);
  g.circle(pose.rearHand.x, pose.rearHand.y, look.handRadius).fill({ color: look.handFar });
  if (pose.bow && look.bow) {
    look.bow(g, pose, 'back');
  }
  if (!look.hideFarLeg) {
    drawLimb(g, pose.hip, pose.rearKnee, pose.rearFoot, look.legFar);
    footShape(g, pose.rearFoot, pose.rearShinAngle, look.foot.length, look.foot.height, look.foot.colorFar);
  }
  look.torso(g, pose, frame);
  drawLimb(g, pose.hip, pose.frontKnee, pose.frontFoot, look.leg);
  footShape(g, pose.frontFoot, pose.frontShinAngle, look.foot.length, look.foot.height, look.foot.color);
  look.overLegs?.(g, pose, frame);
  look.head(g, pose, headFrame(pose));
  if (pose.club && look.club) {
    look.club(g, pose.club.butt, pose.club.tip);
  }
  if (pose.bow && look.bow) {
    look.bow(g, pose, 'front');
  }
  drawLimb(g, pose.shoulder, pose.frontElbow, pose.frontHand, look.arm);
  look.heldNear?.(g, pose.frontElbow, pose.frontHand);
  g.circle(pose.frontHand.x, pose.frontHand.y, look.handRadius).fill({ color: look.hand });
};

/** A wooden club, thicker at the striking end, with a leather grip and an iron band. */
export const woodenClub = (wood: number, dark: number, grip: number, width: number) => (g: Graphics, butt: Vec2, tip: Vec2): void => {
  const length = Math.hypot(tip.x - butt.x, tip.y - butt.y) || 1;
  const d = { x: (tip.x - butt.x) / length, y: (tip.y - butt.y) / length };
  const point = (distance: number): Vec2 => ({ x: butt.x + d.x * distance, y: butt.y + d.y * distance });
  limb(g, butt, tip, width * 0.75, width * 1.9, dark);
  limb(g, butt, point(length - 0.6), width * 0.55, width * 1.65, wood);
  limb(g, point(1), point(Math.min(length * 0.35, 12)), width * 0.85, width * 0.9, grip);
  limb(g, point(length * 0.72), point(length * 0.78), width * 1.6, width * 1.65, dark);
};

/** Bow limbs bent through the grip and the string to the nock (`'back'`) and, while drawn, the arrow (`'front'`). */
export const drawBowWith = (wood: number, woodDark: number, string: number, arrow: number) => (g: Graphics, pose: BodyPose, layer: BowLayer): void => {
  if (!pose.bow) {
    return;
  }
  const { rig, tension } = pose.bow;
  if (layer === 'front') {
    if (tension > 0.05) {
      const aim = unit(rig.stringNock, rig.woodHand);
      const tip = { x: rig.woodHand.x + aim.x * 8, y: rig.woodHand.y + aim.y * 8 };
      g.moveTo(rig.stringNock.x, rig.stringNock.y).lineTo(tip.x, tip.y).stroke({ width: 1.6, color: arrow, cap: 'round' });
      shape(g, [tip, { x: tip.x - aim.x * 5 - aim.y * 2.5, y: tip.y - aim.y * 5 + aim.x * 2.5 }, { x: tip.x - aim.x * 5 + aim.y * 2.5, y: tip.y - aim.y * 5 - aim.x * 2.5 }], 0xc9ced4);
    }
    return;
  }
  const curve = (width: number, color: number): void => {
    g.moveTo(rig.bowTop.x, rig.bowTop.y).quadraticCurveTo(rig.bowControl.x, rig.bowControl.y, rig.bowBottom.x, rig.bowBottom.y)
      .stroke({ width, color, cap: 'round', join: 'round' });
  };
  curve(5, woodDark);
  curve(3, wood);
  g.moveTo(rig.bowTop.x, rig.bowTop.y).lineTo(rig.stringNock.x, rig.stringNock.y).lineTo(rig.bowBottom.x, rig.bowBottom.y)
    .stroke({ width: 1, color: string });
};

/** Arrows sticking out of a quiver on the back, between `bottom` and `top`. */
export const quiver = (g: Graphics, bottom: Vec2, top: Vec2, color: number, strap: number, fletching: number): void => {
  limb(g, bottom, top, 8, 9, color);
  const d = unit(bottom, top);
  [-2.5, 0, 2.5].forEach((offset, i) => {
    const base = { x: top.x - d.y * offset, y: top.y + d.x * offset };
    const end = { x: base.x + d.x * (7 + i), y: base.y + d.y * (7 + i) };
    limb(g, base, end, 2.4, 3.2, fletching);
  });
  limb(g, { x: bottom.x + d.x * 4, y: bottom.y + d.y * 4 }, { x: bottom.x + d.x * 7, y: bottom.y + d.y * 7 }, 9.5, 9.5, strap);
};
