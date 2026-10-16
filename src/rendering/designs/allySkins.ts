import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../../types';
import { limb, shape } from './designShapes';
import { capPoints } from './enemySkins';
import { longsword } from './knightSkins';
import type { BodyPose } from './bodyPoses';
import { at, ellipseIn, shapeIn, type Frame, type HumanoidLook, type LimbLook } from './skinKit';

/**
 * The player's soldiers (scenes/BattleAllies.ts), in the bowman's blue and silver so they read as his side: the squire
 * (blue tunic, leather cap, short sword), the knight (the footman idea in blue: closed helm, tabard, kite shield) and the medic
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
const BLUE_DARK = 0x21416c;

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

const MAIL = 0x8d96a0;
const MAIL_DARK = 0x666e78;
const CREAM = 0xf1ead0;

/**
 * A kite shield on the far fist, in front of the body: steel rim, blue face, a cream cross. Strapped to the forearm, it
 * stands square to it (its long axis across the forearm, like a sword in the fist), so it turns with the arm.
 */
const kiteShield = (g: Graphics, pose: BodyPose): void => {
  const dx = pose.rearHand.x - pose.rearElbow.x;
  const dy = pose.rearHand.y - pose.rearElbow.y;
  const length = Math.hypot(dx, dy) || 1;
  // `up` square to the forearm (the shield's top), `fwd` along it.
  const frame: Frame = { up: { x: dy / length, y: -dx / length }, fwd: { x: dx / length, y: dy / length } };
  const c = at(pose.rearHand, frame, 2, -3);
  const kite = (grow: number): Array<[number, number]> => [[16 + grow, -11 - grow], [16 + grow, 11 + grow], [-2, 11 + grow], [-22 - grow * 1.5, 0], [-2, -11 - grow]];
  shapeIn(g, c, frame, kite(2), STEEL_DARK);
  shapeIn(g, c, frame, kite(0), BLUE);
  shapeIn(g, c, frame, [[15, 1], [15, 10], [-2, 10], [-12, 4]], 0x3d72b8, 0.7);
  limb(g, at(c, frame, 12, 0), at(c, frame, -14, 0), 3, 3, CREAM);
  limb(g, at(c, frame, 5, -8), at(c, frame, 5, 8), 3, 3, CREAM);
};

/**
 * Knight (after the design lab's footman idea): a closed helm with a visor slit and a blue plume streaming back, a
 * breastplate over a blue tabard, mail on the limbs, a kite shield carried in front; the longsword in the far hand,
 * behind him (`armsSwapped`: the swinging arm is drawn behind the body, the shield arm in front).
 */
export const allyKnightLook = (timeMs: number): HumanoidLook => ({
  // The sword arm (the pose's near arm) is behind the body, so it is the darker one.
  arm: limbs(MAIL_DARK, MAIL_DARK, [8, 7], [7, 6]),
  armFar: limbs(MAIL, MAIL, [8, 7], [7, 6]),
  leg: limbs(MAIL, MAIL, [10, 8], [8, 7]),
  legFar: limbs(MAIL_DARK, MAIL_DARK, [10, 8], [8, 7]),
  hand: MAIL_DARK, handFar: STEEL_DARK, handRadius: 4,
  armsSwapped: true,
  foot: { color: 0x3a3433, colorFar: 0x262120, length: 16, height: 8 },
  torso: (g, pose, frame) => {
    // The tabard from the shoulders to the thighs, the breastplate over it, a belt.
    shapeIn(g, pose.hip, frame, [[38, -11], [38, 11], [-14, 12], [-14, -12]], BLUE);
    shapeIn(g, pose.hip, frame, [[-4, -11], [-4, 11], [-14, 12], [-14, -12]], BLUE_DARK);
    ellipseIn(g, at(pose.hip, frame, 24, 1), frame, 12, 13, STEEL);
    ellipseIn(g, at(pose.hip, frame, 28, 5), frame, 4, 6, STEEL_EDGE, 0.8);
    limb(g, at(pose.hip, frame, -1, -11), at(pose.hip, frame, -1, 12), 4, 4, LEATHER);
  },
  overLegs: (g, pose, frame) => {
    // A round knee guard and the shoulder plate.
    g.circle(pose.frontKnee.x, pose.frontKnee.y, 5).fill({ color: STEEL });
    ellipseIn(g, at(pose.hip, frame, 34, 1), frame, 9, 7, STEEL);
  },
  // The shield over everything, on the front fist.
  front: kiteShield,
  head: (g, pose, frame) => {
    const head = pose.head;
    // The plume streaming back from the crest.
    for (let i = 0; i < 4; i++) {
      const wave = Math.sin(timeMs / 140 - i * 0.9) * (1 + i * 0.6);
      ellipseIn(g, at(head, frame, 11 - i * 1.5 + wave, -2 - i * 5), frame, 5 - i * 0.6, 3.4 - i * 0.4, BLUE);
    }
    limb(g, pose.shoulder, pose.neckTop, 9, 9, STEEL_DARK);
    g.circle(head.x, head.y, 11).fill({ color: STEEL });
    // The visor over the face, a slit across it, a rivet at the temple.
    shapeIn(g, head, frame, [[4, 3], [3, 12], [-8, 12], [-10, 4]], STEEL_DARK);
    limb(g, at(head, frame, 1, 4), at(head, frame, 1, 11), 2.5, 2.5, 0x1d2329);
    g.circle(...xy(at(head, frame, -2, -5)), 1.2).fill({ color: STEEL_DARK });
    ellipseIn(g, at(head, frame, 5, -3), frame, 3, 4, STEEL_EDGE, 0.6);
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
