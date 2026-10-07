import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import { drawBow } from './archer';
import {
  DRAGON_GEAR,
  DRAGON_PALETTES,
  JAW_HINGE,
  JAW_OPEN,
  add,
  getDragonPose,
  limb,
  rotate,
  type ArcherControl,
  type BreathControl,
  type DragonPalette,
  type DragonPose,
  type DragonRider,
  type WingPose,
} from './dragon';
import { drawJointPose, drawRearLeg } from './stickmanPose';

/** Drawing of the dragon poses from rendering/dragon.ts, in the flat landscape style, in a palette. */

const drawWing = (g: Graphics, wingPose: WingPose, membrane: number, bone: number): void => {
  const { shoulder, wrist, tip, trail } = wingPose;
  g.poly([shoulder, wrist, tip, ...trail].flatMap((point) => [point.x, point.y])).fill({ color: membrane });
  g.moveTo(shoulder.x, shoulder.y).lineTo(wrist.x, wrist.y).lineTo(tip.x, tip.y)
    .stroke({ width: 4, color: bone, cap: 'round', join: 'round' });
  // Finger bones fanning from the wrist to the trailing edge.
  trail.slice(0, 2).forEach((point) => g.moveTo(wrist.x, wrist.y).lineTo(point.x, point.y).stroke({ width: 2, color: bone, cap: 'round' }));
};

/** Thick tapering stroke through `points` (width from `from` to `to`). */
const tapered = (g: Graphics, points: Vec2[], from: number, to: number, color: number): void => {
  for (let index = 1; index < points.length; index += 1) {
    const t = index / (points.length - 1);
    g.moveTo(points[index - 1].x, points[index - 1].y).lineTo(points[index].x, points[index].y)
      .stroke({ width: from + (to - from) * t, color, cap: 'round' });
  }
};

/** Draws the dragon and its rider (spear, bow or bare hands), at `timeMs`. */
export const drawDragonRider = (
  g: Graphics,
  timeMs: number,
  riderKind: DragonRider = 'spear',
  archer?: ArcherControl,
  palette: DragonPalette = DRAGON_PALETTES.red,
  breath?: BreathControl,
): DragonPose => {
  const pose = getDragonPose(timeMs, riderKind, archer, breath);
  g.clear();
  drawDragon(g, pose, true, palette);
  return pose;
};

const flat = (points: Vec2[]): number[] => points.flatMap((point) => [point.x, point.y]);

/** Head with horns and eye; the lower jaw swings down about its hinge as `pose.jaw` opens. */
const drawHead = (g: Graphics, pose: DragonPose, palette: DragonPalette): void => {
  const { head, headTilt, jaw } = pose;
  const pointAt = (angle: number) => (distance: number, side = 0): Vec2 => ({
    x: head.x + Math.cos(angle) * distance - Math.sin(angle) * side,
    y: head.y + Math.sin(angle) * distance + Math.cos(angle) * side,
  });
  const along = pointAt(headTilt);
  // Lower jaw: rotated about the hinge by the opening (drawn first, under the upper snout).
  const hinge = along(JAW_HINGE.along, JAW_HINGE.side);
  const open = jaw * JAW_OPEN;
  const lower = (distance: number, side: number): Vec2 => {
    const point = along(distance, side);
    const dx = point.x - hinge.x;
    const dy = point.y - hinge.y;
    return { x: hinge.x + dx * Math.cos(open) - dy * Math.sin(open), y: hinge.y + dx * Math.sin(open) + dy * Math.cos(open) };
  };
  if (jaw > 0.02) {
    // Inside of the mouth, between the jaws.
    g.poly(flat([along(8, 2), along(30, 1), lower(28, 3), lower(8, 3)])).fill({ color: palette.mouth });
  }
  g.ellipse(head.x + Math.cos(headTilt) * 4, head.y + Math.sin(headTilt) * 4, 15, 10).fill({ color: palette.body });
  g.poly(flat([lower(6, 2), lower(29, 2), lower(30, 4), lower(6, 8)])).fill({ color: palette.body });
  g.poly(flat([lower(10, 5), lower(29, 4), lower(10, 9)])).fill({ color: palette.belly });
  if (jaw > 0.02) {
    // Teeth along both jaws.
    [14, 20, 26].forEach((distance) => {
      const top = along(distance, 2);
      g.poly(flat([top, along(distance + 2.5, 2), along(distance + 1.2, 5)])).fill({ color: palette.horn });
      const bottom = lower(distance - 2, 3);
      g.poly(flat([bottom, lower(distance + 0.5, 3), lower(distance - 0.8, 0)])).fill({ color: palette.horn });
    });
  }
  g.poly(flat([along(6, -7), along(30, -2), along(31, jaw > 0.02 ? 2 : 3), along(6, jaw > 0.02 ? 3 : 8)])).fill({ color: palette.body });
  [[-4, -8], [-9, -6]].forEach(([distance, side]) => {
    const base = along(distance, side);
    const end = along(distance - 16, side - 9);
    const bend = along(distance - 6, side - 10);
    g.moveTo(base.x, base.y).quadraticCurveTo(bend.x, bend.y, end.x, end.y).stroke({ width: 3.5, color: palette.horn, cap: 'round' });
  });
  const eye = along(10, -4);
  g.circle(eye.x, eye.y, 2.6).fill({ color: palette.eye });
  g.circle(eye.x + 0.6, eye.y, 1.1).fill({ color: 0x2b1a14 });
};

/** Draws a dragon pose on top of what's in `g` (in its current transform), with or without the rider. */
export const drawDragon = (g: Graphics, pose: DragonPose, withRider: boolean, palette: DragonPalette = DRAGON_PALETTES.red): void => {
  drawWing(g, pose.farWing, palette.wingFar, palette.bone);
  // The rider's far leg is on the other side of the dragon: drawn before the body so it's hidden.
  if (withRider) {
    drawRearLeg(g, pose.rider);
  }

  // Tail: tapering from the body to a spade tip.
  tapered(g, pose.tail, 4, 22, palette.body);
  const tip = pose.tail[0];
  const back = pose.tail[1];
  const angle = Math.atan2(tip.y - back.y, tip.x - back.x);
  const spade = [{ x: 14, y: 0 }, { x: -2, y: -8 }, { x: 2, y: 0 }, { x: -2, y: 8 }].map((point) => add(tip, rotate(point, angle)));
  g.poly(flat(spade)).fill({ color: palette.bodyDark });

  // Legs tucked under the body.
  const y = pose.bob;
  [[-30, 0.5], [30, 0.3]].forEach(([x, bend]) => {
    const hipJoint = { x, y: 12 + y };
    const knee = limb(hipJoint, 0.8 + bend, 14);
    const foot = limb(knee, -0.6, 12);
    g.moveTo(hipJoint.x, hipJoint.y).lineTo(knee.x, knee.y).lineTo(foot.x, foot.y).stroke({ width: 7, color: palette.bodyDark, cap: 'round', join: 'round' });
  });

  // Body with a pale belly and back ridge spikes.
  g.ellipse(0, 4 + y, 66, 24).fill({ color: palette.body });
  g.ellipse(6, 14 + y, 52, 11).fill({ color: palette.belly });
  [-44, -28, -12, 20].forEach((x) => g.poly([x - 6, -16 + y, x, -28 + y, x + 6, -16 + y]).fill({ color: palette.bodyDark }));

  // Neck and head.
  tapered(g, [{ x: 30, y: -2 + y }, ...pose.neck], 26, 13, palette.body);
  drawHead(g, pose, palette);

  drawWing(g, pose.nearWing, palette.wingNear, palette.bone);
  if (withRider) {
    drawDragonRiderOnly(g, pose);
  }
};

/** The rider (skeleton look, near leg over the flank, far leg left out) and his weapon. */
export const drawDragonRiderOnly = (g: Graphics, pose: DragonPose): void => {
  drawJointPose(g, pose.rider, 0, { append: true, hideRearLeg: true });
  if (pose.bow) {
    drawBow(g, pose.bow.rig);
    const { arrow } = pose.bow;
    if (arrow) {
      g.moveTo(arrow.nock.x, arrow.nock.y).lineTo(arrow.tip.x, arrow.tip.y).stroke({ width: 1.6, color: DRAGON_GEAR.spear, cap: 'round' });
      g.circle(arrow.tip.x, arrow.tip.y, 1.8).fill({ color: DRAGON_GEAR.spearTip });
    }
    return;
  }
  if (!pose.spear) {
    return;
  }
  const { butt, tip } = pose.spear;
  g.moveTo(butt.x, butt.y).lineTo(tip.x, tip.y).stroke({ width: 3, color: DRAGON_GEAR.spear, cap: 'round' });
  const length = Math.hypot(tip.x - butt.x, tip.y - butt.y) || 1;
  const unit = { x: (tip.x - butt.x) / length, y: (tip.y - butt.y) / length };
  g.poly([tip.x + unit.x * 10, tip.y + unit.y * 10, tip.x - unit.y * 4, tip.y + unit.x * 4, tip.x + unit.y * 4, tip.y - unit.x * 4])
    .fill({ color: DRAGON_GEAR.spearTip });
};
