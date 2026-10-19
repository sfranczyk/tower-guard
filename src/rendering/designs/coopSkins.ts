import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../../types';
import type { ArmorPalette } from '../armor';
import type { BodyPose } from './bodyPoses';
import { limb } from './designShapes';
import { limbs, shade } from './playerSkins';
import { at, drawBowWith, ellipseIn, quiver, shapeIn, torsoFrame, type BowLayer, type HumanoidLook } from './skinKit';

/**
 * The looks for co-op players 3 and 4, over the same archer rig and animations as the ranger and the warden. Like
 * theirs, the main cloth takes the battleground's player colour; each has its own silhouette (a pointed fur cap,
 * a wolf's head with ears) so four bowmen in the same colour still tell apart at a glance.
 */

const xy = (point: Vec2): [number, number] => [point.x, point.y];
const unit = (from: Vec2, to: Vec2): Vec2 => {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
};

/** A reflex bow: the plain bow with horn tips (siyahs) bent forward, away from the archer. */
const reflexBow = (wood: number, woodDark: number, string: number, arrow: number, tip: number) => {
  const plain = drawBowWith(wood, woodDark, string, arrow);
  return (g: Graphics, pose: BodyPose, layer: BowLayer): void => {
    plain(g, pose, layer);
    if (!pose.bow || layer !== 'back') {
      return;
    }
    const { rig } = pose.bow;
    const belly = unit(rig.stringNock, rig.woodHand);
    [rig.bowTop, rig.bowBottom].forEach((end) => {
      const along = unit(rig.woodHand, end);
      const out = { x: end.x + belly.x * 4.5 + along.x * 3, y: end.y + belly.y * 4.5 + along.y * 3 };
      limb(g, end, out, 3.4, 2.2, tip);
    });
  };
};

/**
 * Player 3, the steppe archer: a pointed cap with a fur brim and a long braid, a kaftan to mid-thigh with a fur
 * hem and a sash, red riding boots, a quiver at the hip and a short reflex bow with horn tips.
 */
export const steppeLook = (timeMs: number, moving = 0, palette?: ArmorPalette): HumanoidLook => {
  const CLOTH = palette?.limb ?? 0x9a3a2c, CLOTH_DARK = shade(CLOTH, 0.72), SASH = palette?.gold ?? 0xd9a33a;
  const FUR = 0x6b4a30, FUR_LIGHT = 0x8c6a48, SKIN = 0xd2a07a, HAIR = 0x2a201a, BOOT = 0x7a2e22;
  const SLEEVE = shade(CLOTH, 0.86);
  // The braid and the sash's ends swing as he walks.
  const swing = Math.sin(timeMs / 230) * (0.6 + moving * 1.6);
  return {
    arm: limbs(SLEEVE, SLEEVE, [8, 7], [7, 6.5]),
    armFar: limbs(shade(SLEEVE, 0.75), shade(SLEEVE, 0.75), [8, 7], [7, 6.5]),
    leg: limbs(0x4f453a, 0x4f453a, [10, 8], [8.5, 7.5]),
    legFar: limbs(0x3a3229, 0x3a3229, [10, 8], [8.5, 7.5]),
    hand: SKIN, handFar: 0xa97c5c, handRadius: 3.5,
    foot: { color: BOOT, colorFar: 0x58201a, length: 15, height: 8 },
    back: (g, pose) => {
      const frame = torsoFrame(pose);
      // Quiver slung low at the hip, the arrows leaning back.
      quiver(g, at(pose.hip, frame, -14, -11), at(pose.hip, frame, 10, -17), 0x6b4128, 0x3b2a1e, 0xe8d8b0);
      limb(g, at(pose.hip, frame, 2, -10), at(pose.hip, frame, -12 - moving * 2, -14 + swing), 3, 2.4, shade(SASH, 0.8));
    },
    torso: (g, pose, frame) => {
      shapeIn(g, pose.hip, frame, [[38, -10], [38, 10], [0, 12], [0, -11]], CLOTH);
      // The kaftan's crossover, edged in fur.
      limb(g, at(pose.hip, frame, 37, -1), at(pose.hip, frame, 18, 10.5), 3, 3, FUR_LIGHT);
      shapeIn(g, pose.hip, frame, [[38, -10], [38, -4], [8, -6], [8, -11]], CLOTH_DARK, 0.5);
    },
    overLegs: (g, pose, frame) => {
      // Skirt of the kaftan to mid-thigh, flaring a little, a fur hem and the sash over its top.
      shapeIn(g, pose.hip, frame, [[3, -11], [3, 12], [-23, 16], [-23, -13]], CLOTH);
      limb(g, at(pose.hip, frame, 2, 10.5), at(pose.hip, frame, -22, 14), 3, 3, FUR_LIGHT);
      limb(g, at(pose.hip, frame, -23, -12), at(pose.hip, frame, -23, 15), 4.5, 4.5, FUR);
      shapeIn(g, pose.hip, frame, [[6, -11.5], [6, 12.5], [0, 12.5], [0, -11.5]], SASH);
      g.roundRect(...xy(at(pose.hip, frame, 0, 4)), 5, 5, 1.5).fill({ color: shade(SASH, 0.7) });
    },
    head: (g, pose, frame) => {
      const head = pose.head;
      // Braid down the back of the neck.
      limb(g, at(head, frame, -2, -8), at(head, frame, -16, -12 + swing), 3, 2.2, HAIR);
      g.circle(...xy(at(head, frame, -16, -12 + swing)), 1.8).fill({ color: SASH });
      ellipseIn(g, at(head, frame, -1, 1), frame, 9, 9.5, SKIN);
      shapeIn(g, head, frame, [[6, -10], [-4, -10], [-7, -5], [2, -2]], HAIR);
      // Pointed cap: the cloth cone leaning back, over a thick fur brim.
      shapeIn(g, head, frame, [[7, -9], [7, 8], [16, 3], [26, -7], [22, -9.5]], CLOTH);
      shapeIn(g, head, frame, [[16, 3], [26, -7], [24, -8], [14, 0]], CLOTH_DARK, 0.6);
      limb(g, at(head, frame, 6, -10.5), at(head, frame, 6, 10.5), 5.5, 5.5, FUR);
      limb(g, at(head, frame, 7.5, -9), at(head, frame, 7.5, 9), 1.6, 1.6, FUR_LIGHT);
      g.circle(...xy(at(head, frame, 1.5, 6.5)), 1.5).fill({ color: 0x2c2420 });
      limb(g, at(head, frame, 3.8, 4.5), at(head, frame, 3.5, 8.8), 1.4, 1.4, HAIR);
      shapeIn(g, head, frame, [[0, 9.5], [-2, 12.5], [-3, 9.5]], SKIN);
      // A drooping moustache.
      limb(g, at(head, frame, -3.5, 10), at(head, frame, -7.5, 7), 2, 1.3, HAIR);
    },
    bow: reflexBow(0xc79a5c, 0x4a2a18, 0xf4f0e6, 0x8a5a32, 0xe8dcc0),
  };
};

/**
 * Player 4, the huntsman: a wolf pelt over the head and shoulders (the wolf's head with its ears and snout for a
 * hood, its paws on his chest, the hide trailing down his back), a short tunic, a belt with a hunting horn, bare
 * arms in leather bracers, fur-wrapped shins, a birch-bark quiver and a plain yew longbow.
 */
export const huntsmanLook = (timeMs: number, moving = 0, palette?: ArmorPalette): HumanoidLook => {
  const TUNIC = palette?.limb ?? 0x5c6b2e, PELT = 0x8d8781, PELT_DARK = 0x67615c, PELT_LIGHT = 0xb5afa6;
  const SKIN = 0xd9a77e, BEARD = 0x6b4528, LEATHER = 0x6b4a2f;
  return {
    arm: limbs(shade(TUNIC, 0.85), LEATHER, [8, 6.5], [6.5, 5.5]),
    armFar: limbs(shade(TUNIC, 0.64), 0x4a3322, [8, 6.5], [6.5, 5.5]),
    leg: limbs(0x5c5446, 0x7d6c58, [10, 8], [9, 8.5]),
    legFar: limbs(0x433d33, 0x5c5042, [10, 8], [9, 8.5]),
    hand: SKIN, handFar: 0xb3876a, handRadius: 3.6,
    foot: { color: 0x54443a, colorFar: 0x3a2f28, length: 15, height: 8 },
    back: (g, pose) => {
      const frame = torsoFrame(pose);
      const wave = (k: number): number => Math.sin(timeMs / 300 - k) * (1 + moving * 1.5);
      const trail = 2 + moving * 6;
      // The hide down his back, ragged at the end where the tail hangs.
      shapeIn(g, pose.hip, frame, [
        [41, -5], [39, -12], [16, -15 - trail * 0.4 + wave(0)], [-6, -14 - trail + wave(1)], [-14, -10 - trail + wave(2)],
        [-8, -7], [-12, -3], [0, -6],
      ], PELT_DARK);
      limb(g, at(pose.hip, frame, -6, -12 - trail + wave(1)), at(pose.hip, frame, -22, -15 - trail + wave(2.5)), 6, 3, PELT);
      // Birch-bark quiver, grey goose fletching.
      quiver(g, at(pose.hip, frame, 8, -9), at(pose.hip, frame, 40, -15), 0xd8d0bc, 0x4a3a2c, 0xb8b8b0);
      limb(g, at(pose.hip, frame, 18, -11.5), at(pose.hip, frame, 20, -12.5), 6, 6, 0x3a3530);
    },
    torso: (g, pose, frame) => {
      shapeIn(g, pose.hip, frame, [[37, -9], [37, 9], [-15, 12], [-15, -11]], TUNIC);
      shapeIn(g, pose.hip, frame, [[-11, -11], [-11, 12], [-15, 12], [-15, -11]], shade(TUNIC, 0.75));
      // Belt and the hunting horn at the front hip.
      shapeIn(g, pose.hip, frame, [[3, -10], [3, 10.5], [-2, 11], [-2, -10.5]], LEATHER);
      limb(g, at(pose.hip, frame, -1, 8), at(pose.hip, frame, -9, 15), 5, 2.4, 0xe6dcc4);
      limb(g, at(pose.hip, frame, -1, 8), at(pose.hip, frame, 0.5, 6.5), 5.5, 5.5, 0x8a6a40);
      // The pelt over the shoulders, the forepaws hanging on his chest.
      shapeIn(g, pose.hip, frame, [[45, -12], [45, 9], [33, 12], [27, -14]], PELT);
      limb(g, at(pose.hip, frame, 34, 9), at(pose.hip, frame, 21, 11.5), 4.5, 3.5, PELT);
      limb(g, at(pose.hip, frame, 21.5, 11.5), at(pose.hip, frame, 19.5, 12.5), 4, 4, PELT_DARK);
    },
    head: (g, pose, frame) => {
      const head = pose.head;
      ellipseIn(g, at(head, frame, -1, 3.5), frame, 6.5, 8, SKIN);
      shapeIn(g, head, frame, [[5, -12], [-6, -11], [-9, -5], [0, -2]], BEARD);
      // A full beard under the chin.
      shapeIn(g, head, frame, [[-1, 1], [-1, 10.5], [-6, 10], [-11, 6], [-12, 0], [-6, -3]], BEARD);
      g.circle(...xy(at(head, frame, 1.5, 6.8)), 1.5).fill({ color: 0x2c2420 });
      shapeIn(g, head, frame, [[1, 9.8], [-1.6, 12.8], [-2.6, 9.8]], SKIN);
      // The wolf's head for a hood: skull, ears, the snout over his brow.
      shapeIn(g, head, frame, [[14, -7], [23, -5], [16, -1]], PELT_DARK);
      shapeIn(g, head, frame, [[15, 0], [23, 3], [14, 5]], PELT);
      shapeIn(g, head, frame, [[16.5, 1.5], [21, 3], [15.5, 4]], 0xc79a8a);
      shapeIn(g, head, frame, [[3, -13], [12, -12], [16.5, -4], [16, 4], [12.5, 8], [11.5, 17], [7.5, 19], [5.5, 10], [3, 7.5], [5, -2]], PELT);
      shapeIn(g, head, frame, [[7.5, 10], [7.5, 19], [5.5, 10]], PELT_LIGHT);
      g.circle(...xy(at(head, frame, 9.5, 19)), 1.9).fill({ color: 0x1d1a18 });
      g.circle(...xy(at(head, frame, 12.6, 9)), 1.1).fill({ color: 0xd9a33a });
    },
    bow: drawBowWith(0xa0662e, 0x5a3418, 0xe8e2d4, 0x7a5030),
  };
};
