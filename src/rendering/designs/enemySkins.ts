import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../../types';
import { limb, shape } from './designShapes';
import { at, drawBowWith, ellipseIn, headFrame, quiver, shapeIn, torsoFrame, woodenClub, type HumanoidLook, type LimbLook } from './skinKit';

/**
 * New looks for the game's enemies that walk and run, drawn over the game's own poses (BodyPose):
 * fighter → raider, runner → goblin, archer → hooded bandit, kamikaze → sapper.
 */

const xy = (point: Vec2): [number, number] => [point.x, point.y];

const limbs = (upper: number, lower: number, upperWidth: [number, number], lowerWidth: [number, number]): LimbLook =>
  ({ upper, lower, upperWidth, lowerWidth });

/** Top of a head circle (a cap or bandana): the part above `from` along the head's up axis. */
const capPoints = (radius: number, from: number): Array<[number, number]> => {
  const start = Math.asin(from / radius);
  return Array.from({ length: 13 }, (_, i) => {
    const a = start + ((Math.PI - 2 * start) * i) / 12;
    return [Math.sin(a) * radius, Math.cos(a) * radius] as [number, number];
  });
};

/** Fighter: the raider. Stickman proportions with flesh, a tunic, bandana and a proper club. */
export const raiderLook = (timeMs: number): HumanoidLook => {
  const SKIN = 0xd9a074, SKIN_DARK = 0xa8754f, TUNIC = 0x7b5233, LEATHER = 0x3b2a20, BANDANA = 0xb8383b;
  return {
    arm: limbs(SKIN, SKIN, [7, 6], [6, 5]),
    armFar: limbs(SKIN_DARK, SKIN_DARK, [7, 6], [6, 5]),
    leg: limbs(0x4f5d6e, 0x4f5d6e, [10, 8], [8, 6.5]),
    legFar: limbs(0x3a4553, 0x3a4553, [10, 8], [8, 6.5]),
    hand: SKIN, handFar: SKIN_DARK, handRadius: 3.8,
    foot: { color: LEATHER, colorFar: 0x2a1e17, length: 14, height: 7 },
    torso: (g, pose, frame) => {
      shapeIn(g, pose.hip, frame, [[38, -8], [38, 9], [-11, 12], [-11, -11]], TUNIC);
      shapeIn(g, pose.hip, frame, [[38, 2], [38, 9], [24, 10], [20, 4]], 0x8d6440);
      limb(g, at(pose.hip, frame, 0, -10), at(pose.hip, frame, 0, 11), 4, 4, LEATHER);
      g.circle(...xy(at(pose.hip, frame, 0, 7)), 2.2).fill({ color: 0xc9a227 });
    },
    head: (g, pose, frame) => {
      const head = pose.head;
      limb(g, pose.shoulder, pose.neckTop, 6, 6, SKIN);
      const flap = Math.sin(timeMs / 120) * 2;
      limb(g, at(head, frame, 3, -8), at(head, frame, -1 + flap, -17), 3, 2, BANDANA);
      limb(g, at(head, frame, 2, -8), at(head, frame, -5 - flap, -15), 3, 2, BANDANA);
      g.circle(head.x, head.y, 10).fill({ color: SKIN });
      shapeIn(g, head, frame, capPoints(10.6, 1.5), BANDANA);
      ellipseIn(g, at(head, frame, -6, 4), frame, 6, 3, 0x7a4a33, 0.3);
      g.circle(...xy(at(head, frame, 0, 5)), 1.6).fill({ color: 0x2c2420 });
      shapeIn(g, head, frame, [[1, 9], [-3, 13], [-4, 9]], SKIN);
      limb(g, at(head, frame, -6, 4), at(head, frame, -6, 8), 1.5, 1.5, 0x7a4a33);
    },
    club: woodenClub(0x9a6838, 0x5a3a20, 0x3b2a20, 5),
  };
};

/** Runner: the goblin. Hunched, pot-bellied, big head with long ears; a rusty dagger. */
export const goblinLook = (timeMs: number): HumanoidLook => {
  const SKIN = 0x86b04b, DARK = 0x5f8a36, BELLY = 0x9cc463, CLOTH = 0x7a5a3a;
  const flap = Math.sin(timeMs / 90) * 1.5;
  return {
    arm: limbs(SKIN, SKIN, [5.5, 4.5], [4.5, 4]),
    armFar: limbs(DARK, DARK, [5.5, 4.5], [4.5, 4]),
    leg: limbs(SKIN, SKIN, [7, 5], [5, 4]),
    legFar: limbs(DARK, DARK, [7, 5], [5, 4]),
    hand: SKIN, handFar: DARK, handRadius: 3.3,
    foot: { color: SKIN, colorFar: DARK, length: 15, height: 6 },
    torso: (g, pose, frame) => {
      limb(g, pose.shoulder, at(pose.head, headFrame(pose), -4, 5), 6, 6, SKIN);
      shapeIn(g, pose.hip, frame, [[-4, -8], [12, -10], [28, -11], [36, -4], [37, 4], [30, 9], [14, 12], [0, 10]], SKIN);
      ellipseIn(g, at(pose.hip, frame, 12, 6), frame, 5, 8, BELLY);
    },
    overLegs: (g, pose, frame) => {
      shapeIn(g, pose.hip, frame, [[2, -9], [2, 10], [-12, 8], [-9, 3], [-13, -1], [-9, -5], [-12, -9]], CLOTH);
      limb(g, at(pose.hip, frame, 1, -9), at(pose.hip, frame, 1, 10), 2.5, 2.5, 0x4e3824);
    },
    head: (g, pose, frame) => {
      // Hunched: the big head hangs low and forward of the neck.
      const head = at(pose.head, frame, -4, 5);
      shapeIn(g, head, frame, [[6, -4], [14 + flap, -24], [-2, -6]], DARK);
      g.circle(head.x, head.y, 12).fill({ color: SKIN });
      shapeIn(g, head, frame, [[7, -2], [17 + flap, -22], [-3, -3]], SKIN);
      shapeIn(g, head, frame, [[5, -4], [12 + flap, -17], [0, -5]], 0xc98a7a);
      shapeIn(g, head, frame, [[4, 9], [-3, 20], [-3, 9]], SKIN);
      g.circle(...xy(at(head, frame, 4, 5)), 3.2).fill({ color: 0xf2d54a });
      ellipseIn(g, at(head, frame, 4, 6), frame, 0.9, 2.2, 0x1b1a12);
      limb(g, at(head, frame, 9, 1), at(head, frame, 7, 9), 2, 2, DARK);
      limb(g, at(head, frame, -6, 3), at(head, frame, -5, 11), 2.2, 2.2, 0x3a2a1e);
      shapeIn(g, head, frame, [[-5, 5], [-8, 6.5], [-5, 8]], 0xf1ead0);
    },
    // A rusty dagger, held where the game holds the short club.
    club: (g, butt, tip) => {
      const length = Math.hypot(tip.x - butt.x, tip.y - butt.y) || 1;
      const d = { x: (tip.x - butt.x) / length, y: (tip.y - butt.y) / length };
      const hand = { x: butt.x + d.x * 5, y: butt.y + d.y * 5 };
      const point = (distance: number, side = 0): Vec2 => ({ x: hand.x + d.x * distance - d.y * side, y: hand.y + d.y * distance + d.x * side });
      limb(g, point(-5), point(1), 3, 3, 0x4e3824);
      shape(g, [point(3, -2.2), point(15, -1.2), point(19, 0), point(15, 1.4), point(3, 2.2)], 0xa8afb6);
      limb(g, point(4), point(15), 1, 0.6, 0xd4d9de);
      g.circle(...xy(point(9, 1)), 1).fill({ color: 0x9a5a32, alpha: 0.7 });
      limb(g, point(2.5, -4), point(2.5, 4), 2, 2, 0x6b5a3a);
    },
  };
};


/** Archer: a hooded bandit with a scarf over the face, a quiver on the back and a plain wooden bow. */
export const banditArcherLook = (hood = 0x9a3a32, hoodDark = 0x6e2621): HumanoidLook => {
  const SKIN = 0xd2a07a, VEST = 0x6b4a2f, LEATHER = 0x5a3d26;
  return {
    arm: limbs(0x7d6b54, LEATHER, [6.5, 5.5], [5.5, 5]),
    armFar: limbs(0x5f5040, 0x45301e, [6.5, 5.5], [5.5, 5]),
    leg: limbs(0x4a4038, 0x4a4038, [9, 7], [7, 6]),
    legFar: limbs(0x37302a, 0x37302a, [9, 7], [7, 6]),
    hand: SKIN, handFar: 0xa87b58, handRadius: 3.4,
    foot: { color: 0x2f241c, colorFar: 0x211912, length: 14, height: 7 },
    back: (g, pose) => {
      const frame = torsoFrame(pose);
      quiver(g, at(pose.hip, frame, 8, -10), at(pose.hip, frame, 40, -15), LEATHER, 0x3b2a1e, 0xe8e0d0);
    },
    torso: (g, pose, frame) => {
      shapeIn(g, pose.hip, frame, [[37, -8], [37, 8], [-10, 10], [-10, -9]], VEST);
      limb(g, at(pose.hip, frame, 36, -6), at(pose.hip, frame, 6, 8), 2.5, 2.5, 0x3b2a1e);
      limb(g, at(pose.hip, frame, 0, -9), at(pose.hip, frame, 0, 10), 4, 4, 0x3b2a1e);
      shapeIn(g, pose.hip, frame, [[41, -11], [41, 8], [30, 10], [27, -12]], hood);
    },
    head: (g, pose, frame) => {
      const head = pose.head;
      shapeIn(g, head, frame, [[13, -2], [10, -12], [-2, -14], [-10, -9], [-13, 3], [-7, 10], [6, 11]], hood);
      ellipseIn(g, at(head, frame, 0, 5), frame, 5.5, 7.5, SKIN);
      ellipseIn(g, at(head, frame, 5, 5), frame, 5.5, 3, hoodDark, 0.6);
      g.circle(...xy(at(head, frame, 1, 7)), 1.4).fill({ color: 0x2c2420 });
      shapeIn(g, head, frame, [[-1, -1], [-1, 11.5], [-7, 10], [-10, 1]], 0x4a1a17);
    },
    bow: drawBowWith(0x8a5a32, 0x3b2616, 0xe8e0d0, 0x8a5a32),
  };
};


/** A stick of dynamite held in the fist, square to the forearm; `lit` adds a burning fuse. */
const dynamiteInHand = (timeMs: number, lit: boolean) => (g: Graphics, elbow: Vec2, hand: Vec2): void => {
  const length = Math.hypot(hand.x - elbow.x, hand.y - elbow.y) || 1;
  const forearm = { x: (hand.x - elbow.x) / length, y: (hand.y - elbow.y) / length };
  // Across the fist, square to the forearm (a hanging arm holds it pointing forward).
  const c = Math.cos(-Math.PI / 2), s = Math.sin(-Math.PI / 2);
  const d = { x: forearm.x * c - forearm.y * s, y: forearm.x * s + forearm.y * c };
  const point = (distance: number): Vec2 => ({ x: hand.x + d.x * distance, y: hand.y + d.y * distance });
  dynamiteStick(g, point(-5), point(12));
  const fuseEnd = { x: point(16).x + d.y * 2, y: point(16).y - d.x * 2 };
  g.moveTo(...xy(point(12))).quadraticCurveTo(...xy(point(15)), ...xy(fuseEnd)).stroke({ width: 1.3, color: 0xc9b48a, cap: 'round' });
  if (lit) {
    const flicker = 0.75 + 0.25 * Math.sin(timeMs / 37) * Math.sin(timeMs / 83 + 1);
    g.circle(fuseEnd.x, fuseEnd.y, 4 * flicker).fill({ color: 0xff7a2a, alpha: 0.75 });
    g.circle(fuseEnd.x, fuseEnd.y, 2 * flicker).fill({ color: 0xffe27a });
    for (let i = 0; i < 4; i++) {
      const a = timeMs / 60 + i * 1.7;
      const r = 4 + ((timeMs / 7 + i * 13) % 6);
      g.circle(fuseEnd.x + Math.cos(a) * r, fuseEnd.y + Math.sin(a) * r - 1, 0.8).fill({ color: 0xffd25a });
    }
  }
};

/** One red stick with paper ends. */
const dynamiteStick = (g: Graphics, from: Vec2, to: Vec2, color = 0xc0392b): void => {
  limb(g, from, to, 4.6, 4.6, color);
  g.circle(to.x, to.y, 2.1).fill({ color: 0xe8d8b0 });
};

/** Kamikaze: the sapper. Leather apron, brass goggles, singed hair, wrapped in dynamite with a stick in each hand (one lit). */
export const sapperLook = (timeMs: number): HumanoidLook => {
  const SKIN = 0xe0b48c, SKIN_DARK = 0xb98d68, APRON = 0x5a4030, TAPE = 0x3a3a40;
  return {
    arm: limbs(0xb8a58a, SKIN, [6.5, 5.5], [5, 4.5]),
    armFar: limbs(0x8f8068, SKIN_DARK, [6.5, 5.5], [5, 4.5]),
    leg: limbs(0x55524a, 0x55524a, [9, 7], [7, 6]),
    legFar: limbs(0x3f3c36, 0x3f3c36, [9, 7], [7, 6]),
    hand: SKIN, handFar: SKIN_DARK, handRadius: 3.4,
    foot: { color: 0x2b2420, colorFar: 0x1d1815, length: 14, height: 7 },
    heldFar: dynamiteInHand(timeMs, false),
    heldNear: dynamiteInHand(timeMs, true),
    back: (g, pose) => {
      // The sticks on his back show behind him.
      const frame = torsoFrame(pose);
      [-11, -8].forEach((f) => dynamiteStick(g, at(pose.hip, frame, 8, f), at(pose.hip, frame, 31, f), 0x962d22));
    },
    torso: (g, pose, frame) => {
      shapeIn(g, pose.hip, frame, [[37, -8], [37, 8], [-9, 10], [-9, -9]], 0xb8a58a);
    },
    overLegs: (g, pose, frame) => {
      shapeIn(g, pose.hip, frame, [[31, 1], [31, 10], [-15, 12], [-15, -1]], APRON);
      limb(g, at(pose.hip, frame, 31, 4), at(pose.hip, frame, 37, -5), 2.5, 2.5, APRON);
      limb(g, at(pose.hip, frame, 4, -9), at(pose.hip, frame, 4, 11), 3, 3, 0x3b2a1e);
      // Dynamite wrapped round the chest and belly, taped on, with a loose wire.
      [[5, 0xa8321f], [8.5, 0xc0392b], [12, 0xd04a36]].forEach(([f, color]) =>
        dynamiteStick(g, at(pose.hip, frame, 7, f), at(pose.hip, frame, 31, f + 1), color));
      [12, 25].forEach((u) => limb(g, at(pose.hip, frame, u, -10), at(pose.hip, frame, u + 1, 14), 2.6, 2.6, TAPE));
      const wire = at(pose.hip, frame, 31, 13);
      g.moveTo(...xy(wire)).quadraticCurveTo(...xy(at(pose.hip, frame, 37, 18)), ...xy(at(pose.hip, frame, 34, 4)))
        .stroke({ width: 1.1, color: 0x2b2420 });
    },
    head: (g, pose, frame) => {
      const head = pose.head;
      limb(g, pose.shoulder, pose.neckTop, 5.5, 5.5, SKIN);
      for (const [u, f] of [[11, -6], [13, 0], [11, 6], [7, -10], [3, -12]] as const) {
        shapeIn(g, head, frame, [[u * 0.6, f * 0.6 - 2], [u + 4 + Math.sin(timeMs / 80 + f) * 0.6, f * 1.1], [u * 0.6, f * 0.6 + 2]], 0x2a201a);
      }
      g.circle(head.x, head.y, 10).fill({ color: SKIN });
      ellipseIn(g, at(head, frame, -4, -3), frame, 4, 3, 0x6a5a4a, 0.25);
      limb(g, at(head, frame, 2, -10), at(head, frame, 2, 4), 2.5, 2.5, 0x3b2a1e);
      g.circle(...xy(at(head, frame, 2, 5.5)), 4.2).fill({ color: 0xc9a227 });
      g.circle(...xy(at(head, frame, 2, 5.5)), 2.8).fill({ color: 0x9fd3e6 });
      g.circle(...xy(at(head, frame, 3, 6.5)), 0.9).fill({ color: 0xffffff });
      shapeIn(g, head, frame, [[-4, 3], [-4, 10], [-8, 9], [-8, 4]], 0x3a1f1a);
      limb(g, at(head, frame, -4.6, 4), at(head, frame, -4.6, 9.5), 1.6, 1.6, 0xf1ead0);
    },
  };
};
