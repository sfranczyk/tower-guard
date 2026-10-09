import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../../types';
import { limb, shape } from './designShapes';
import { at, ellipseIn, shapeIn, torsoFrame, type Frame, type HumanoidLook, type LimbLook } from './skinKit';
import type { BodyPose } from './bodyPoses';

/**
 * The black knights and the dark priest: the black knight (sword), the hammer knight (a head taller, a war hammer in
 * both hands), both in black plate with ember eyes behind the visor, and the hooded priest with a skull scepter.
 */

const xy = (point: Vec2): [number, number] => [point.x, point.y];
const limbs = (upper: number, lower: number, upperWidth: [number, number], lowerWidth: [number, number]): LimbLook =>
  ({ upper, lower, upperWidth, lowerWidth });

const PLATE = 0x2a2c33;
const PLATE_DARK = 0x18191e;
const PLATE_EDGE = 0x50545f;
const EMBER = 0xff5a3c;
const CAPE = 0x6e1a1f;

/** Along the line from `from` to `to`: `distance` along it and `side` square to it. */
const onLine = (from: Vec2, to: Vec2) => {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const d = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  return { length, point: (distance: number, side = 0): Vec2 => ({ x: from.x + d.x * distance - d.y * side, y: from.y + d.y * distance + d.x * side }) };
};

/** A torn cape hanging from the shoulders, streaming back. */
const tornCape = (timeMs: number, length: number) => (g: Graphics, pose: BodyPose): void => {
  const frame = torsoFrame(pose);
  const wave = (k: number): number => Math.sin(timeMs / 180 - k) * 2.5;
  shapeIn(g, pose.hip, frame, [
    [38, -4], [37, -12], [10, -17 + wave(0)], [-length, -15 + wave(1)], [-length + 5, -11 + wave(2)], [-length - 2, -7 + wave(2)], [-length + 4, -3], [0, -6],
  ], CAPE);
};

/** Black breastplate with a ridge, a belt and, over the legs, the tassets. */
const breastplate = (g: Graphics, pose: BodyPose, frame: Frame, width: number): void => {
  shapeIn(g, pose.hip, frame, [[38, -width], [39, width - 1], [20, width + 2], [-7, width], [-7, -width]], PLATE);
  shapeIn(g, pose.hip, frame, [[35, 2], [36, width - 2], [22, width], [10, width - 2], [16, 4]], PLATE_EDGE, 0.55);
  limb(g, at(pose.hip, frame, 0, -width), at(pose.hip, frame, 0, width + 1), 4, 4, PLATE_DARK);
};

const tassets = (g: Graphics, pose: BodyPose, frame: Frame, width: number): void => {
  shapeIn(g, pose.hip, frame, [[1, -width], [1, width + 1], [-15, width + 2], [-15, 1], [-12, -1], [-15, -width]], PLATE_DARK);
  limb(g, at(pose.hip, frame, -7, -width + 1), at(pose.hip, frame, -7, width + 1), 1.4, 1.4, PLATE_EDGE);
};

/** A spiked pauldron over the near shoulder. */
const pauldron = (g: Graphics, pose: BodyPose, frame: Frame, size: number): void => {
  const centre = at(pose.hip, frame, 33, 0);
  [-0.6, 0.2].forEach((f) => shapeIn(g, centre, frame, [[size * 0.5, f * size - 2], [size * 1.45, f * size], [size * 0.5, f * size + 2.5]], PLATE_EDGE));
  ellipseIn(g, centre, frame, size, size * 0.72, PLATE);
  ellipseIn(g, at(centre, frame, 2, 2), frame, size * 0.6, size * 0.35, PLATE_EDGE, 0.5);
};

/** A closed helm with a visor slit and two embers for eyes. */
const greatHelm = (g: Graphics, head: Vec2, frame: Frame, timeMs: number): void => {
  shapeIn(g, head, frame, [[11, -8], [12, 5], [7, 11], [-6, 12], [-11, 9], [-11, -9], [2, -12]], PLATE);
  shapeIn(g, head, frame, [[10, 2], [11, 6], [6, 11], [0, 11.5], [4, 4]], PLATE_EDGE, 0.5);
  limb(g, at(head, frame, 1.5, 1), at(head, frame, 1.5, 12), 2.6, 2.6, 0x0b0b0e);
  limb(g, at(head, frame, 8, 0), at(head, frame, -10, 0), 1.6, 1.6, PLATE_EDGE, 0.7);
  const glow = 0.75 + 0.25 * Math.sin(timeMs / 210);
  g.circle(...xy(at(head, frame, 1.5, 8)), 2.6).fill({ color: EMBER, alpha: 0.35 * glow });
  g.circle(...xy(at(head, frame, 1.5, 8)), 1.3).fill({ color: 0xffc07a });
  [-4, -7].forEach((u) => [5, 8, 11].forEach((f) => g.circle(...xy(at(head, frame, u, f)), 0.8).fill({ color: 0x0b0b0e })));
};

/** The knights' common body: plate limbs, gauntlets and sabatons; `bulk` thickens them for the hammer knight. */
const plateLook = (bulk: number): Pick<HumanoidLook, 'arm' | 'armFar' | 'leg' | 'legFar' | 'hand' | 'handFar' | 'handRadius' | 'foot'> => ({
  arm: limbs(PLATE, PLATE_EDGE, [8.5 * bulk, 7 * bulk], [7 * bulk, 6.5 * bulk]),
  armFar: limbs(PLATE_DARK, PLATE_DARK, [8.5 * bulk, 7 * bulk], [7 * bulk, 6.5 * bulk]),
  leg: limbs(PLATE, PLATE_EDGE, [11 * bulk, 9 * bulk], [9 * bulk, 8 * bulk]),
  legFar: limbs(PLATE_DARK, PLATE_DARK, [11 * bulk, 9 * bulk], [9 * bulk, 8 * bulk]),
  hand: 0x3a3d46, handFar: PLATE_DARK, handRadius: 4.2 * bulk,
  foot: { color: 0x3a3d46, colorFar: PLATE_DARK, length: 16, height: 7.5 },
});

/** A longsword: leather grip, a crossguard at the fist, a blade with a bright edge. */
const longsword = (g: Graphics, butt: Vec2, tip: Vec2): void => {
  const { length, point } = onLine(butt, tip);
  // The fist sits CLUBS.overhead.butt (8) up the line; the blade reaches a little past the club's tip.
  const guard = 10;
  const end = length + 8;
  limb(g, point(-1), point(guard), 3, 3, 0x3b2a20);
  g.circle(...xy(point(-1.5)), 2.4).fill({ color: 0x8a8f99 });
  shape(g, [point(guard, -3), point(end - 6, -2.2), point(end, 0), point(end - 6, 2.2), point(guard, 3)], 0xa9b0ba);
  limb(g, point(guard + 1), point(end - 5), 1, 0.6, 0xe4e8ee);
  limb(g, point(guard, -6), point(guard, 6), 2.4, 2.4, 0x5c616c);
};

/** A war hammer: a long haft with a square iron head and a spike behind it. */
const warHammer = (g: Graphics, butt: Vec2, tip: Vec2): void => {
  const { length, point } = onLine(butt, tip);
  limb(g, point(0), point(length - 2), 3.2, 3.6, 0x3a2a20);
  limb(g, point(length * 0.3), point(length * 0.45), 4, 4, 0x1e1a18);
  shape(g, [point(length - 6, -7), point(length + 3, -7), point(length + 3, 9), point(length - 6, 9)], 0x3d4048);
  shape(g, [point(length - 5, 5), point(length + 2, 5), point(length + 2, 9), point(length - 5, 9)], PLATE_EDGE);
  shape(g, [point(length - 5, -7), point(length - 1.5, -16), point(length + 2, -7)], 0x5c616c);
  shape(g, [point(length + 3, -2), point(length + 8, 1), point(length + 3, 4)], 0x5c616c);
};

/** Black knight: black plate, a spiked pauldron, a dark red plume and a torn cape; a longsword. */
export const blackKnightLook = (timeMs: number): HumanoidLook => ({
  ...plateLook(1),
  back: tornCape(timeMs, 14),
  torso: (g, pose, frame) => {
    breastplate(g, pose, frame, 10);
  },
  overLegs: (g, pose, frame) => {
    tassets(g, pose, frame, 10);
    pauldron(g, pose, frame, 8);
  },
  head: (g, pose, frame) => {
    const head = pose.head;
    limb(g, pose.shoulder, pose.neckTop, 8, 7, PLATE_DARK);
    const sway = Math.sin(timeMs / 160) * 1.5;
    shapeIn(g, head, frame, [[9, -4], [16, -5], [17 + sway, -13], [11 + sway, -20], [7, -15], [6, -8]], CAPE);
    greatHelm(g, head, frame, timeMs);
    shapeIn(g, head, frame, [[10, -5], [16, -1], [10, 3]], PLATE_EDGE);
  },
  club: longsword,
});

/** Hammer knight: heavier plate, broad spiked pauldrons, a horned helm; a war hammer in both hands. */
export const hammerKnightLook = (timeMs: number): HumanoidLook => ({
  ...plateLook(1.15),
  back: tornCape(timeMs, 22),
  torso: (g, pose, frame) => {
    breastplate(g, pose, frame, 12);
    // Rivets down the plate.
    [8, 18, 28].forEach((u) => g.circle(...xy(at(pose.hip, frame, u, 9)), 1.1).fill({ color: PLATE_EDGE }));
  },
  overLegs: (g, pose, frame) => {
    tassets(g, pose, frame, 12);
    pauldron(g, pose, frame, 10.5);
  },
  head: (g, pose, frame) => {
    const head = pose.head;
    limb(g, pose.shoulder, pose.neckTop, 10, 8, PLATE_DARK);
    // Two bull's horns: the far one behind the helm, the near one sweeping forward over the visor.
    const horn = (start: [number, number], bend: [number, number], tip: [number, number], color: number): void => {
      g.moveTo(...xy(at(head, frame, ...start))).quadraticCurveTo(...xy(at(head, frame, ...bend)), ...xy(at(head, frame, ...tip)))
        .stroke({ width: 3.6, color, cap: 'round' });
    };
    horn([6, -4], [15, -11], [21, -6], 0x8f877a);
    greatHelm(g, head, frame, timeMs);
    horn([6, 2], [14, 9], [20, 4], 0xc9c0ad);
  },
  club: warHammer,
});

const ROBE = 0x2b1d2e;
const ROBE_DARK = 0x1a1120;
const TRIM = 0x9b1f2a;
const GOLD = 0xb08d3a;
const PALE = 0xcfc4b0;

/**
 * Dark priest: a deep hood over a gaunt face with red eyes, a black-purple robe with a crimson trim and sash, a bone
 * pendant, and a skull scepter whose red orb glows; `cast` 0..1 brightens it while he heals.
 */
export const darkPriestLook = (timeMs: number, cast = 0): HumanoidLook => ({
  // Wide bell sleeves; the legs barely show under the robe.
  arm: limbs(ROBE, ROBE, [8, 9], [9, 11]),
  armFar: limbs(ROBE_DARK, ROBE_DARK, [8, 9], [9, 11]),
  leg: limbs(ROBE_DARK, 0x241a22, [9, 7], [6, 5]),
  legFar: limbs(0x140d18, 0x140d18, [9, 7], [6, 5]),
  hand: PALE, handFar: 0x9e9484, handRadius: 3.3,
  foot: { color: 0x241a22, colorFar: 0x140d18, length: 13, height: 6 },
  torso: (g, pose, frame) => {
    shapeIn(g, pose.hip, frame, [[38, -9], [38, 10], [-6, 12], [-6, -10]], ROBE);
  },
  overLegs: (g, pose, frame) => {
    // The robe falls to the shins, flaring as he walks; a crimson stripe down the front.
    const flare = Math.abs(pose.frontFoot.x - pose.rearFoot.x) * 0.45;
    shapeIn(g, pose.hip, frame, [[6, -11], [6, 12], [-44, 16 + flare], [-46, 4], [-44, -15 - flare * 0.6]], ROBE);
    shapeIn(g, pose.hip, frame, [[6, 6], [6, 10], [-45, 14 + flare], [-45, 9 + flare]], TRIM);
    limb(g, at(pose.hip, frame, 37, -7), at(pose.hip, frame, 2, 10), 3.2, 3.2, TRIM);
    limb(g, at(pose.hip, frame, 1, -11), at(pose.hip, frame, 1, 12), 3, 3, 0x120b14);
    // A bone pendant on a cord.
    limb(g, at(pose.hip, frame, 36, 4), at(pose.hip, frame, 25, 9), 0.9, 0.9, GOLD);
    ellipseIn(g, at(pose.hip, frame, 23, 9.5), frame, 2.6, 3, 0xe8e0cc);
    g.circle(...xy(at(pose.hip, frame, 23.5, 10.5)), 0.7).fill({ color: 0x2a2020 });
  },
  head: (g, pose, frame) => {
    const head = pose.head;
    shapeIn(g, head, frame, [[14, -2], [11, -13], [-1, -16], [-12, -11], [-15, 3], [-8, 11], [8, 12]], ROBE_DARK);
    ellipseIn(g, at(head, frame, -1, 5), frame, 5.4, 7.6, PALE);
    // Sunken cheeks and the hood's shadow over the eyes.
    ellipseIn(g, at(head, frame, 5, 5.5), frame, 5.8, 3.4, ROBE_DARK, 0.75);
    ellipseIn(g, at(head, frame, -3, 3.5), frame, 1.4, 2.6, 0x8a7f70, 0.6);
    const glow = 0.6 + 0.4 * Math.max(cast, (Math.sin(timeMs / 260) + 1) / 2 * 0.5);
    g.circle(...xy(at(head, frame, 2, 7.5)), 2.4).fill({ color: EMBER, alpha: 0.35 * glow });
    g.circle(...xy(at(head, frame, 2, 7.5)), 1.1).fill({ color: 0xff2a2a });
    limb(g, at(head, frame, -5.5, 4), at(head, frame, -5.5, 8.5), 1.2, 1.2, 0x3a2626);
  },
  // The scepter, held where the game holds a club: a dark shaft, a little skull and a glowing red orb.
  club: (g, butt, tip) => {
    const { length, point } = onLine(butt, tip);
    limb(g, point(-2), point(length - 3), 2.6, 3, 0x2a1d18);
    limb(g, point(length * 0.55), point(length * 0.62), 3.8, 3.8, GOLD);
    const skull = point(length + 1);
    g.circle(skull.x, skull.y, 4.4).fill({ color: 0xe8e0cc });
    g.circle(...xy(point(length + 2, -1.6)), 1).fill({ color: 0x2a2020 });
    g.circle(...xy(point(length + 2, 1.6)), 1).fill({ color: 0x2a2020 });
    const orb = point(length + 8);
    const pulse = 0.5 + 0.5 * Math.sin(timeMs / 180);
    g.circle(orb.x, orb.y, 6 + 6 * cast + pulse * 1.5).fill({ color: 0xff2a3a, alpha: 0.18 + 0.3 * cast });
    g.circle(orb.x, orb.y, 3.6).fill({ color: 0xc4182a });
    g.circle(orb.x - 1, orb.y - 1, 1.3).fill({ color: 0xffb0b0 });
  },
});
