import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../../types';
import { getDragonPose, type ArcherControl, type BreathControl, type DragonPalette, type DragonPose } from '../dragon';
import { drawDragon } from '../dragonArt';
import type { BodyPose } from './bodyPoses';
import { limb, shape } from './designShapes';
import { banditArcherLook } from './enemySkins';
import { at, drawHumanoid, ellipseIn, shapeIn, torsoFrame, type HumanoidLook, type LimbLook } from './skinKit';

/** New looks for the brute (an ogre), the zombie (a rotting peasant) and the dragon riders. */

const xy = (point: Vec2): [number, number] => [point.x, point.y];
const limbs = (upper: number, lower: number, upperWidth: [number, number], lowerWidth: [number, number]): LimbLook =>
  ({ upper, lower, upperWidth, lowerWidth });

/** Brute: the ogre. A huge belly, a small bald head sunk between the shoulders, a spiked log. */
export const ogreLook = (): HumanoidLook => {
  const SKIN = 0xb59a6a, DARK = 0x8f784f, BELLY = 0xcbb183, HIDE = 0x7a5a3a;
  return {
    arm: limbs(SKIN, SKIN, [12, 10], [10, 9]),
    armFar: limbs(DARK, DARK, [12, 10], [10, 9]),
    leg: limbs(SKIN, SKIN, [14, 12], [12, 10]),
    legFar: limbs(DARK, DARK, [14, 12], [12, 10]),
    hand: SKIN, handFar: DARK, handRadius: 6.5,
    foot: { color: SKIN, colorFar: DARK, length: 17, height: 8 },
    torso: (g, pose, frame) => {
      shapeIn(g, pose.hip, frame, [[-8, -15], [18, -19], [36, -14], [43, -2], [41, 8], [31, 17], [12, 22], [-4, 16]], SKIN);
      ellipseIn(g, at(pose.hip, frame, 10, 10), frame, 12, 13, BELLY);
      g.circle(...xy(at(pose.hip, frame, 8, 15)), 1.4).fill({ color: DARK });
    },
    overLegs: (g, pose, frame) => {
      shapeIn(g, pose.hip, frame, [[2, -15], [2, 17], [-14, 14], [-10, 7], [-15, 1], [-10, -6], [-14, -13]], HIDE);
      for (const [u, f] of [[-3, -8], [-8, 4], [-2, 10]] as const) {
        ellipseIn(g, at(pose.hip, frame, u, f), frame, 2.4, 1.8, 0x5a3f28);
      }
      limb(g, at(pose.hip, frame, 1, -15), at(pose.hip, frame, 1, 17), 3, 3, 0x4e3824);
    },
    head: (g, pose, frame) => {
      // Sunk between the shoulders.
      const head = at(pose.head, frame, -6, 4);
      ellipseIn(g, at(head, frame, -1, -8), frame, 2.5, 3.5, DARK);
      g.circle(head.x, head.y, 9.5).fill({ color: SKIN });
      ellipseIn(g, at(head, frame, 5, -2), frame, 4, 2, 0xd8c08f, 0.7);
      limb(g, at(head, frame, 3, -1), at(head, frame, 3.5, 8), 3, 3, 0x4e3e28);
      g.circle(...xy(at(head, frame, 0.5, 5.5)), 1.5).fill({ color: 0x1b1a12 });
      ellipseIn(g, at(head, frame, -1.5, 10), frame, 2.8, 2.6, DARK);
      shapeIn(g, head, frame, [[-3, 1], [-3, 12], [-10, 11], [-11, 1]], SKIN);
      shapeIn(g, head, frame, [[-4, 5], [0, 6], [-4, 7.5]], 0xf1ead0);
      shapeIn(g, head, frame, [[-4, 9], [0, 10], [-4, 11]], 0xf1ead0);
    },
    club: (g, butt, tip) => {
      const length = Math.hypot(tip.x - butt.x, tip.y - butt.y) || 1;
      const d = { x: (tip.x - butt.x) / length, y: (tip.y - butt.y) / length };
      const point = (distance: number, side = 0): Vec2 => ({ x: butt.x + d.x * distance - d.y * side, y: butt.y + d.y * distance + d.x * side });
      limb(g, butt, tip, 6, 14, 0x5a3a20);
      limb(g, butt, point(length - 1), 4.5, 12, 0x7a5232);
      [[0.55, -1], [0.7, 1], [0.85, -1], [0.95, 1]].forEach(([at, side]) => {
        const base = point(length * at, side * 5.5);
        shape(g, [point(length * at - 1.5, side * 5), point(length * at + 1.5, side * 5), point(length * at, side * 10)], 0x9aa3ab);
        g.circle(base.x, base.y, 1.2).fill({ color: 0x9aa3ab });
      });
    },
  };
};

/** Zombie: a rotting peasant in rags, ribs showing, the jaw hanging, one shoe lost. */
export const zombieLook = (timeMs: number): HumanoidLook => {
  const SKIN = 0x9fb38a, DARK = 0x7a8c68, SHIRT = 0x5b6b7a, ROT = 0x4a5a40;
  return {
    arm: limbs(SHIRT, SKIN, [7, 6], [5.5, 4.5]),
    armFar: limbs(0x45525e, DARK, [7, 6], [5.5, 4.5]),
    leg: limbs(0x5e4a3a, SKIN, [10, 8], [6, 5]),
    legFar: limbs(0x47382c, 0x3a302a, [10, 8], [7, 6]),
    hand: SKIN, handFar: DARK, handRadius: 3.4,
    foot: { color: SKIN, colorFar: 0x2e2620, length: 14, height: 6 },
    torso: (g, pose, frame) => {
      shapeIn(g, pose.hip, frame, [[37, -8], [37, 8], [4, 10], [-4, 7], [-9, 10], [-6, 2], [-11, -3], [-6, -9]], SHIRT);
      ellipseIn(g, at(pose.hip, frame, 20, 3), frame, 5, 8, ROT);
      [16, 20, 24].forEach((u) => limb(g, at(pose.hip, frame, u, -1), at(pose.hip, frame, u + 1, 7), 1.6, 1.4, 0xe8e4d4));
      ellipseIn(g, at(pose.hip, frame, 6, -3), frame, 4, 3, 0x72c43c, 0.55);
    },
    overLegs: (g, pose) => {
      // Torn trouser leg: frayed edge at the knee, bare shin below.
      const knee = pose.frontKnee;
      shape(g, [{ x: knee.x - 5, y: knee.y - 1 }, { x: knee.x + 5, y: knee.y - 1 }, { x: knee.x + 3, y: knee.y + 4 }, { x: knee.x, y: knee.y + 2 }, { x: knee.x - 3, y: knee.y + 5 }], 0x5e4a3a);
    },
    head: (g, pose, frame) => {
      const head = pose.head;
      limb(g, pose.shoulder, pose.neckTop, 5.5, 5, SKIN);
      g.circle(head.x, head.y, 10).fill({ color: SKIN });
      for (const [f, length] of [[-6, 10], [-3, 13], [-8, 7]] as const) {
        limb(g, at(head, frame, 9, f), at(head, frame, 9 - length, f - 4 + Math.sin(timeMs / 300 + f) * 0.8), 1.2, 0.8, 0x3a3428);
      }
      ellipseIn(g, at(head, frame, 1, 5), frame, 3, 3.3, 0x2f3a27);
      g.circle(...xy(at(head, frame, 1, 5.5)), 1.2).fill({ color: 0xe8f5a0 });
      // The jaw hangs open.
      shapeIn(g, head, frame, [[-3, 3], [-3, 10], [-12, 9], [-11, 3]], 0x2a1f1f);
      shapeIn(g, head, frame, [[-10, 3], [-11, 9.5], [-14, 8], [-13, 3]], SKIN);
      limb(g, at(head, frame, -3, 5), at(head, frame, -3, 8.5), 1.4, 1.4, 0xd8d0b8);
      const drip = (timeMs % 1600) / 1600;
      limb(g, at(head, frame, -11, 7), at(head, frame, -11 - drip * 9, 7), 1.6, 1, 0x72c43c);
    },
  };
};

/** Fire dragon rider: a knight in dark iron with a horned helm and a red cape, both hands on the reins. */
export const dragonKnightLook = (timeMs: number): HumanoidLook => {
  const IRON = 0x4a4e58, IRON_DARK = 0x33363e, IRON_LIGHT = 0x6d7380, CAPE = 0xa8343a;
  return {
    arm: limbs(IRON, IRON_LIGHT, [8, 7], [7, 6]),
    armFar: limbs(IRON_DARK, IRON_DARK, [8, 7], [7, 6]),
    leg: limbs(IRON, IRON, [10, 8], [8, 7]),
    legFar: limbs(IRON_DARK, IRON_DARK, [10, 8], [8, 7]),
    hand: 0x2b2420, handFar: 0x1d1815, handRadius: 3.8,
    foot: { color: IRON_DARK, colorFar: 0x22242a, length: 14, height: 7 },
    hideFarLeg: true,
    back: (g, pose) => {
      const frame = torsoFrame(pose);
      const wave = (k: number): number => Math.sin(timeMs / 140 - k) * 4;
      shapeIn(g, pose.hip, frame, [[38, -4], [36, -10], [26, -26 + wave(0)], [14, -38 + wave(1)], [6, -32 + wave(2)], [10, -14], [20, -6]], CAPE);
    },
    torso: (g, pose, frame) => {
      shapeIn(g, pose.hip, frame, [[38, -9], [38, 10], [-6, 11], [-6, -10]], IRON);
      ellipseIn(g, at(pose.hip, frame, 25, 3), frame, 10, 11, IRON_LIGHT);
      limb(g, at(pose.hip, frame, 0, -10), at(pose.hip, frame, 0, 11), 4, 4, 0x2b2420);
      ellipseIn(g, at(pose.hip, frame, 35, 2), frame, 9, 6, IRON_LIGHT);
    },
    head: (g, pose, frame) => {
      const head = pose.head;
      for (const side of [-1, 1]) {
        g.moveTo(...xy(at(head, frame, 7, side * 3 - 2))).quadraticCurveTo(...xy(at(head, frame, 18, side * 4 - 6)), ...xy(at(head, frame, 22, side * 2 - 12)))
          .stroke({ width: 3, color: side < 0 ? 0xbfb59a : 0xe9e1c8, cap: 'round' });
      }
      g.circle(head.x, head.y, 11).fill({ color: IRON });
      shapeIn(g, head, frame, [[3, 2], [3, 12], [-8, 11], [-9, 3]], IRON_DARK);
      limb(g, at(head, frame, 1, 4), at(head, frame, 1, 11), 2.4, 2.4, 0xff8a3a);
    },
  };
};

/** A dragon with a new-look rider: the rider in `look` instead of the stickman (under the near wing). */
export const drawDragonWithRider = (
  g: Graphics, timeMs: number, kind: 'archer' | 'unarmed', look: HumanoidLook, palette: DragonPalette,
  archer?: ArcherControl, breath?: BreathControl,
): DragonPose => {
  const pose = getDragonPose(timeMs, kind, archer, breath);
  g.clear();
  const rider: BodyPose = { ...pose.rider, bow: pose.bow ? { rig: pose.bow.rig, tension: pose.bow.tension } : undefined };
  drawDragon(g, pose, (target) => {
    drawHumanoid(target, rider, look);
    if (kind === 'unarmed') {
      // Reins from both fists to the dragon's neck.
      const bit = pose.neck[pose.neck.length - 2] ?? pose.head;
      for (const hand of [rider.rearHand, rider.frontHand]) {
        target.moveTo(hand.x, hand.y).lineTo(bit.x, bit.y).stroke({ width: 1.2, color: 0x2b2420 });
      }
    }
  }, palette);
  return pose;
};

/** The dragon archer's rider: the bandit archer in a darker hood, matching the near-black dragon. */
export const dragonArcherLook = (): HumanoidLook => ({ ...banditArcherLook(0x5a4a6a, 0x3a2f46), hideFarLeg: true });
