import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../../types';
import { limb, shape } from './designShapes';
import { capPoints } from './enemySkins';
import { longsword } from './knightSkins';
import { at, ellipseIn, shapeIn, type HumanoidLook, type LimbLook } from './skinKit';

/**
 * The player's soldiers (scenes/BattleAllies.ts), in the bowman's blue and silver so they read as his side: the squire
 * (blue tunic, leather cap, short sword), the knight (bright plate, blue tabard, plumed helm, longsword) and the medic
 * (white robe with a red cross, a satchel, a wooden staff).
 */

const xy = (point: Vec2): [number, number] => [point.x, point.y];
const limbs = (upper: number, lower: number, upperWidth: [number, number], lowerWidth: [number, number]): LimbLook =>
  ({ upper, lower, upperWidth, lowerWidth });

const SKIN = 0xe0b48c;
const SKIN_DARK = 0xb08560;
const BLUE = 0x2f5d9a;
const LEATHER = 0x5a3a20;
const STEEL = 0xc9d0da;
const STEEL_DARK = 0x8a93a0;
const STEEL_EDGE = 0xeef2f6;
const GOLD = 0xd8b54a;

/** A plain face: an eye, a nose. */
const face = (g: Graphics, head: Vec2, frame: Parameters<typeof at>[1]): void => {
  g.circle(...xy(at(head, frame, 0, 5)), 1.6).fill({ color: 0x2c2420 });
  shapeIn(g, head, frame, [[1, 9], [-3, 13], [-4, 9]], SKIN);
};

/** A short sword: a stubby blade with a brass guard. */
const shortSword = (g: Graphics, butt: Vec2, tip: Vec2): void => {
  const length = Math.hypot(tip.x - butt.x, tip.y - butt.y) || 1;
  const d = { x: (tip.x - butt.x) / length, y: (tip.y - butt.y) / length };
  const point = (distance: number, side = 0): Vec2 => ({ x: butt.x + d.x * distance - d.y * side, y: butt.y + d.y * distance + d.x * side });
  const guard = 9;
  const end = length - 2;
  limb(g, point(-1), point(guard), 3, 3, LEATHER);
  shape(g, [point(guard, -2.6), point(end - 5, -2), point(end, 0), point(end - 5, 2), point(guard, 2.6)], STEEL);
  limb(g, point(guard + 1), point(end - 4), 0.9, 0.6, STEEL_EDGE);
  limb(g, point(guard, -5), point(guard, 5), 2.2, 2.2, GOLD);
};

/** Squire: a blue tunic over a white shirt, a belt, a leather cap; a short sword. */
export const squireLook = (): HumanoidLook => ({
  arm: limbs(0xe8e4da, SKIN, [7, 6], [6, 5]),
  armFar: limbs(0xbcb7ab, SKIN_DARK, [7, 6], [6, 5]),
  leg: limbs(0x6b5a48, 0x6b5a48, [10, 8], [8, 6.5]),
  legFar: limbs(0x4f4235, 0x4f4235, [10, 8], [8, 6.5]),
  hand: SKIN, handFar: SKIN_DARK, handRadius: 3.7,
  foot: { color: LEATHER, colorFar: 0x3a2616, length: 14, height: 7 },
  torso: (g, pose, frame) => {
    shapeIn(g, pose.hip, frame, [[38, -8], [38, 9], [-12, 12], [-12, -11]], BLUE);
    shapeIn(g, pose.hip, frame, [[38, 1], [38, 9], [26, 10], [22, 3]], 0x3d72b8);
    limb(g, at(pose.hip, frame, 0, -10), at(pose.hip, frame, 0, 11), 4, 4, LEATHER);
    g.circle(...xy(at(pose.hip, frame, 0, 7)), 2).fill({ color: GOLD });
  },
  head: (g, pose, frame) => {
    const head = pose.head;
    limb(g, pose.shoulder, pose.neckTop, 6, 6, SKIN);
    g.circle(head.x, head.y, 10).fill({ color: SKIN });
    shapeIn(g, head, frame, capPoints(10.8, 2), 0x7a5230);
    limb(g, at(head, frame, 2.5, -10), at(head, frame, 2.5, 10.5), 2.4, 2.4, 0x5a3a20);
    face(g, head, frame);
  },
  club: shortSword,
});

/** Knight: bright plate, a blue tabard with a gold cross, a plumed helm with an open face; a longsword. */
export const allyKnightLook = (timeMs: number): HumanoidLook => ({
  arm: limbs(STEEL, STEEL_DARK, [8.5, 7], [7, 6.5]),
  armFar: limbs(STEEL_DARK, STEEL_DARK, [8.5, 7], [7, 6.5]),
  leg: limbs(STEEL, STEEL_DARK, [11, 9], [9, 8]),
  legFar: limbs(STEEL_DARK, 0x6f7784, [11, 9], [9, 8]),
  hand: STEEL_DARK, handFar: 0x6f7784, handRadius: 4.2,
  foot: { color: STEEL_DARK, colorFar: 0x6f7784, length: 16, height: 7.5 },
  torso: (g, pose, frame) => {
    shapeIn(g, pose.hip, frame, [[38, -10], [39, 9], [20, 12], [-7, 10], [-7, -10]], STEEL);
    // The tabard over the plate, down to the thighs, with a gold cross.
    shapeIn(g, pose.hip, frame, [[34, -8], [34, 9], [-16, 10], [-16, -8]], BLUE);
    limb(g, at(pose.hip, frame, 28, 1), at(pose.hip, frame, 8, 1), 2.6, 2.6, GOLD);
    limb(g, at(pose.hip, frame, 21, -5), at(pose.hip, frame, 21, 7), 2.6, 2.6, GOLD);
    limb(g, at(pose.hip, frame, 0, -10), at(pose.hip, frame, 0, 11), 3.4, 3.4, LEATHER);
  },
  overLegs: (g, pose, frame) => {
    const centre = at(pose.hip, frame, 33, 0);
    ellipseIn(g, centre, frame, 8, 5.8, STEEL);
    ellipseIn(g, at(centre, frame, 2, 2), frame, 4.8, 2.6, STEEL_EDGE, 0.6);
  },
  head: (g, pose, frame) => {
    const head = pose.head;
    limb(g, pose.shoulder, pose.neckTop, 8, 7, STEEL_DARK);
    const sway = Math.sin(timeMs / 160) * 1.5;
    shapeIn(g, head, frame, [[9, -4], [16, -6], [18 + sway, -14], [12 + sway, -20], [7, -14], [6, -8]], BLUE);
    // An open-faced helm: the face shows between the cheek guards.
    shapeIn(g, head, frame, [[11, -8], [12, 6], [4, 10], [-10, 11], [-11, -9], [2, -12]], STEEL);
    ellipseIn(g, at(head, frame, -0.5, 5), frame, 4.6, 6.4, SKIN);
    limb(g, at(head, frame, 8, -6), at(head, frame, 8, 9), 2, 2, STEEL_EDGE, 0.8);
    limb(g, at(head, frame, 8, 5), at(head, frame, -6, 5.5), 2.2, 2.2, STEEL_DARK);
    g.circle(...xy(at(head, frame, 1.5, 6.5)), 1.4).fill({ color: 0x2c2420 });
  },
  club: longsword,
});

/** A plain wooden staff (the medic never strikes; held where a club would be). */
const staff = (g: Graphics, butt: Vec2, tip: Vec2): void => {
  limb(g, butt, tip, 2.8, 2.4, 0x8a5a30);
  g.circle(...xy(tip), 3).fill({ color: 0x6b4423 });
};

/** Medic: a white robe with a red cross on the chest, a satchel on a strap, a white coif; a staff. `cast` 0..1 while healing. */
export const medicLook = (timeMs: number, cast = 0): HumanoidLook => ({
  arm: limbs(0xf2efe6, 0xf2efe6, [7.5, 8], [7.5, 8.5]),
  armFar: limbs(0xc9c5ba, 0xc9c5ba, [7.5, 8], [7.5, 8.5]),
  leg: limbs(0x8a8478, 0x8a8478, [9, 7], [6.5, 5.5]),
  legFar: limbs(0x6b665c, 0x6b665c, [9, 7], [6.5, 5.5]),
  hand: SKIN, handFar: SKIN_DARK, handRadius: 3.4,
  foot: { color: LEATHER, colorFar: 0x3a2616, length: 13, height: 6 },
  torso: (g, pose, frame) => {
    shapeIn(g, pose.hip, frame, [[38, -9], [38, 10], [-6, 12], [-6, -10]], 0xf2efe6);
  },
  overLegs: (g, pose, frame) => {
    const flare = Math.abs(pose.frontFoot.x - pose.rearFoot.x) * 0.4;
    shapeIn(g, pose.hip, frame, [[6, -11], [6, 12], [-40, 15 + flare], [-42, 4], [-40, -14 - flare * 0.6]], 0xf2efe6);
    shapeIn(g, pose.hip, frame, [[-34, 14 + flare * 0.9], [-40, 15 + flare], [-42, 4], [-40, -14 - flare * 0.6], [-34, -13 - flare * 0.5]], 0xd8d2c4);
    // The red cross, glowing a little while she heals.
    const glow = 0.85 + 0.15 * Math.max(cast, (Math.sin(timeMs / 300) + 1) / 2 * 0.4);
    limb(g, at(pose.hip, frame, 31, 2), at(pose.hip, frame, 17, 2), 3.4, 3.4, 0xc0392b, glow);
    limb(g, at(pose.hip, frame, 25, -4), at(pose.hip, frame, 25, 8), 3.4, 3.4, 0xc0392b, glow);
    // The satchel's strap across the chest and the bag at the hip.
    limb(g, at(pose.hip, frame, 37, 7), at(pose.hip, frame, 2, -9), 2, 2, LEATHER);
    shapeIn(g, pose.hip, frame, [[4, -12], [4, -4], [-7, -4], [-7, -12]], 0x8a5a30);
    limb(g, at(pose.hip, frame, 4, -12), at(pose.hip, frame, 4, -4), 1.6, 1.6, 0x6b4423);
    limb(g, at(pose.hip, frame, 1, -11), at(pose.hip, frame, 1, 12), 2.6, 2.6, 0xb8b0a0);
  },
  head: (g, pose, frame) => {
    const head = pose.head;
    limb(g, pose.shoulder, pose.neckTop, 6, 6, SKIN);
    g.circle(head.x, head.y, 10).fill({ color: SKIN });
    // A white coif over the hair and down behind the neck.
    shapeIn(g, head, frame, [...capPoints(11, -1), [-6, -11], [-13, -9]], 0xf2efe6);
    face(g, head, frame);
  },
  club: staff,
});
