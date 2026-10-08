import type { Vec2 } from '../../types';
import type { ArmorPalette } from '../armor';
import { limb } from './designShapes';
import { at, drawBowWith, ellipseIn, quiver, shapeIn, torsoFrame, type HumanoidLook, type LimbLook } from './skinKit';

/** Two proposals for a new player look, over the same archer rig and animations as the armored archer. */

const xy = (point: Vec2): [number, number] => [point.x, point.y];
/** A colour scaled towards black (factor < 1) or white (> 1). */
const shade = (color: number, factor: number): number => {
  const channel = (shift: number): number => {
    const value = (color >> shift) & 0xff;
    const scaled = factor <= 1 ? value * factor : value + (255 - value) * (factor - 1);
    return Math.max(0, Math.min(255, Math.round(scaled))) << shift;
  };
  return channel(16) | channel(8) | channel(0);
};

const limbs = (upper: number, lower: number, upperWidth: [number, number], lowerWidth: [number, number]): LimbLook =>
  ({ upper, lower, upperWidth, lowerWidth });

/**
 * A: the ranger. Green hood and a cloak that streams behind him, leather jerkin and bracers,
 * a quiver of white-fletched arrows and a pale longbow.
 */
export const rangerLook = (timeMs: number, moving = 0, palette?: ArmorPalette): HumanoidLook => {
  // In the game the hood, cloak and sleeves take the battleground's player cloth, picked to stand out there.
  const HOOD = palette?.limb ?? 0x3f6b3a, HOOD_DARK = palette?.limbRear ?? 0x2c4d29, JERKIN = 0x7a5432, LEATHER = 0x5a3d26, SKIN = 0xe0b48c;
  const SLEEVE = palette ? shade(palette.limb, 0.82) : 0x55704a;
  return {
    arm: limbs(SLEEVE, LEATHER, [7, 6], [6, 5.5]),
    armFar: limbs(shade(SLEEVE, 0.75), 0x45301e, [7, 6], [6, 5.5]),
    leg: limbs(0x5b5040, 0x4a3322, [10, 8], [8.5, 7.5]),
    legFar: limbs(0x433b2f, 0x352416, [10, 8], [8.5, 7.5]),
    hand: SKIN, handFar: 0xb98d68, handRadius: 3.5,
    foot: { color: 0x4a3322, colorFar: 0x352416, length: 15, height: 7.5 },
    back: (g, pose) => {
      const frame = torsoFrame(pose);
      const wave = (k: number): number => Math.sin(timeMs / 260 - k) * (1.5 + moving * 2);
      const trail = 4 + moving * 8;
      shapeIn(g, pose.hip, frame, [
        [39, -4], [38, -11], [10, -15 - trail * 0.5 + wave(0)], [-24, -14 - trail + wave(1)], [-30, -8 - trail + wave(2)], [-26, -2], [0, -6],
      ], HOOD_DARK);
      quiver(g, at(pose.hip, frame, 10, -8), at(pose.hip, frame, 42, -13), LEATHER, 0x3b2a1e, 0xf4f0e6);
    },
    torso: (g, pose, frame) => {
      shapeIn(g, pose.hip, frame, [[37, -9], [37, 9], [-9, 11], [-9, -10]], JERKIN);
      limb(g, at(pose.hip, frame, 36, -5), at(pose.hip, frame, 4, 9), 3, 3, 0x3b2a1e);
      limb(g, at(pose.hip, frame, 0, -10), at(pose.hip, frame, 0, 11), 4, 4, 0x3b2a1e);
      g.roundRect(...xy(at(pose.hip, frame, -1, 3)), 6, 6, 1.5).fill({ color: LEATHER });
      // Hood falling over the shoulders like a short cape.
      shapeIn(g, pose.hip, frame, [[42, -11], [42, 9], [31, 11], [27, -13]], HOOD);
    },
    head: (g, pose, frame) => {
      const head = pose.head;
      shapeIn(g, head, frame, [[14, -3], [10, -13], [-1, -16], [-10, -10], [-13, 3], [-7, 10], [7, 11]], HOOD);
      ellipseIn(g, at(head, frame, -0.5, 5), frame, 5.8, 8, SKIN);
      ellipseIn(g, at(head, frame, 5.5, 5), frame, 6, 3, HOOD_DARK, 0.65);
      g.circle(...xy(at(head, frame, 1, 7)), 1.5).fill({ color: 0x2c2420 });
      limb(g, at(head, frame, 3.5, 5), at(head, frame, 3.8, 9), 1.5, 1.5, 0x5a3d26);
      shapeIn(g, head, frame, [[0, 10], [-2, 13], [-3, 10]], SKIN);
      limb(g, at(head, frame, -5, 6), at(head, frame, -5, 9), 1.3, 1.3, 0x9a6a50);
    },
    bow: drawBowWith(0xd9ae6a, 0x6b4a2a, 0xf4f0e6, 0x8a5a32),
  };
};

/**
 * B: the keep warden. Steel kettle helm over a mail coif, a blue tabard with the keep's gold tower,
 * padded sleeves and a dark recurve bow.
 */
export const wardenLook = (palette?: ArmorPalette): HumanoidLook => {
  // In the game the helm is the palette's plate (bronze for the co-op second player), the tabard its cloth
  // and the tower its trim.
  const STEEL = palette?.plate ?? 0xaeb8c2, STEEL_DARK = shade(STEEL, 0.72), MAIL = 0x8d96a0;
  const TABARD = palette?.limb ?? 0x2f5d8a, GOLD = palette?.gold ?? 0xd9b44a, GAMBESON = 0xd8ccb0;
  return {
    arm: limbs(GAMBESON, 0x6b4a2f, [8, 7], [7, 6]),
    armFar: limbs(0xb0a58c, 0x4a3322, [8, 7], [7, 6]),
    leg: limbs(0x3f4756, 0x3f4756, [10, 8], [8, 7]),
    legFar: limbs(0x2e3440, 0x2e3440, [10, 8], [8, 7]),
    hand: 0x6b4a2f, handFar: 0x4a3322, handRadius: 3.8,
    foot: { color: 0x2b2420, colorFar: 0x1d1815, length: 15, height: 7.5 },
    back: (g, pose) => {
      const frame = torsoFrame(pose);
      quiver(g, at(pose.hip, frame, 8, -9), at(pose.hip, frame, 40, -14), 0x5a3d26, 0x3b2a1e, 0xf4f0e6);
    },
    torso: (g, pose, frame) => {
      shapeIn(g, pose.hip, frame, [[37, -9], [37, 9], [-12, 11], [-12, -10]], MAIL);
      shapeIn(g, pose.hip, frame, [[37, -7], [37, 8], [-14, 9], [-14, -8]], TABARD);
      shapeIn(g, pose.hip, frame, [[37, 7], [37, 8.5], [-14, 9.5], [-14, 8]], GOLD);
      // The keep: a gold tower with merlons.
      const c = at(pose.hip, frame, 18, 1);
      shapeIn(g, c, frame, [[-7, -4], [6, -4], [6, -5], [9, -5], [9, -3], [10, -3], [10, -1], [9, -1], [9, 1], [10, 1], [10, 3], [9, 3], [9, 5], [6, 5], [6, 4], [-7, 4]], GOLD);
      limb(g, at(pose.hip, frame, 0, -10), at(pose.hip, frame, 0, 10), 4, 4, 0x3b2a1e);
    },
    head: (g, pose, frame) => {
      const head = pose.head;
      g.circle(head.x, head.y, 11).fill({ color: MAIL });
      ellipseIn(g, at(head, frame, -0.5, 5), frame, 5.5, 7, 0xe0b48c);
      g.circle(...xy(at(head, frame, 1, 6.5)), 1.5).fill({ color: 0x2c2420 });
      shapeIn(g, head, frame, [[0, 9.5], [-2.5, 12.5], [-3, 9.5]], 0xe0b48c);
      // Kettle helm: dome and a wide brim.
      shapeIn(g, head, frame, Array.from({ length: 11 }, (_, i) => {
        const a = (i / 10) * Math.PI;
        return [3 + Math.sin(a) * 10, Math.cos(a) * 10 - 0.5] as const;
      }), STEEL);
      limb(g, at(head, frame, 3, -16), at(head, frame, 3, 15), 3.4, 3.4, STEEL_DARK);
      g.circle(...xy(at(head, frame, 12.5, -0.5)), 1.4).fill({ color: STEEL_DARK });
    },
    bow: drawBowWith(0x5a3a22, 0x2b1c10, 0xf4f0e6, 0x8a5a32),
  };
};
