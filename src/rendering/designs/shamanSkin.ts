import type { Vec2 } from '../../types';
import { limb, shape } from './designShapes';
import { goblinLook } from './enemySkins';
import { at, ellipseIn, shapeIn, type HumanoidLook } from './skinKit';

/**
 * Goblin shaman: the goblin's body with white war paint, a fur cape, a necklace of teeth, a bone mask with a crest of
 * feathers, and a crooked staff with a horned skull and a green flame; `cast` 0..1 brightens the flame while it casts.
 */

const xy = (point: Vec2): [number, number] => [point.x, point.y];

const FUR = 0x6b4a32;
const FUR_DARK = 0x4a3222;
const BONE = 0xe8e0cc;
const PAINT = 0xf1ead0;
const FLAME = 0x7cff6a;
const FEATHERS = [0xc0392b, 0x2e86c1, 0xf1c40f] as const;

export const shamanLook = (timeMs: number, cast = 0): HumanoidLook => {
  const goblin = goblinLook(timeMs);
  return {
    ...goblin,
    back: (g, pose) => {
      // The fur cape hangs from the shoulders behind it.
      const sway = Math.sin(timeMs / 210) * 2;
      shape(g, [pose.shoulder, { x: pose.shoulder.x + 8, y: pose.shoulder.y + 4 },
        { x: pose.hip.x + 12 + sway, y: pose.hip.y + 6 }, { x: pose.hip.x + 2 + sway, y: pose.hip.y + 10 }], FUR_DARK);
    },
    torso: (g, pose, frame) => {
      goblin.torso?.(g, pose, frame);
      // White stripes of war paint over the chest and a necklace of teeth.
      limb(g, at(pose.hip, frame, 30, -6), at(pose.hip, frame, 22, 4), 1.4, 1.4, PAINT, 0.85);
      limb(g, at(pose.hip, frame, 24, -8), at(pose.hip, frame, 16, 2), 1.4, 1.4, PAINT, 0.85);
      [[35, -6], [33, -1], [33, 4], [35, 8]].forEach(([u, f]) =>
        shapeIn(g, pose.hip, frame, [[u, f - 1.2], [u, f + 1.2], [u - 4, f]], BONE));
      shapeIn(g, pose.hip, frame, [[40, -10], [40, 9], [33, 11], [33, -12]], FUR);
    },
    overLegs: (g, pose, frame) => {
      goblin.overLegs?.(g, pose, frame);
      // Feathers hang from its belt.
      limb(g, at(pose.hip, frame, -1, 7), at(pose.hip, frame, -12, 9), 2, 1, FEATHERS[0]);
      limb(g, at(pose.hip, frame, -1, 4), at(pose.hip, frame, -11, 5), 2, 1, FEATHERS[2]);
    },
    head: (g, pose, frame) => {
      goblin.head?.(g, pose, frame);
      const head = at(pose.head, frame, -4, 5);
      // A crest of feathers over the head, swaying.
      const sway = Math.sin(timeMs / 170) * 1.5;
      FEATHERS.forEach((color, i) => {
        const tip = at(head, frame, 22 - i * 2, -8 + i * 5 + sway);
        limb(g, at(head, frame, 9, -6 + i * 4), tip, 3.2, 1, color);
      });
      // The bone mask over the face: eye holes glowing green, fangs at the bottom.
      shapeIn(g, head, frame, [[10, -1], [10, 13], [2, 15], [-7, 12], [-8, 3], [-2, -2]], BONE);
      const glowAlpha = 0.55 + 0.45 * Math.max(cast, (Math.sin(timeMs / 240) + 1) / 4);
      g.circle(...xy(at(head, frame, 4, 6)), 2.6).fill({ color: 0x1b1a12 });
      g.circle(...xy(at(head, frame, 4, 6)), 1.4).fill({ color: FLAME, alpha: glowAlpha });
      shapeIn(g, head, frame, [[-6, 5], [-10, 7], [-6, 9]], BONE);
      limb(g, at(head, frame, 8, 2), at(head, frame, 1, 11), 1, 1, 0xb33a2a, 0.8);
    },
    // A crooked staff, held where the game holds a club: a horned skull at the top and a green flame over it.
    club: (g, butt, tip) => {
      const length = Math.hypot(tip.x - butt.x, tip.y - butt.y) || 1;
      const d = { x: (tip.x - butt.x) / length, y: (tip.y - butt.y) / length };
      const point = (distance: number, side = 0): Vec2 => ({ x: butt.x + d.x * distance - d.y * side, y: butt.y + d.y * distance + d.x * side });
      limb(g, point(-4), point(length * 0.5, 1.5), 2.6, 2.4, 0x5a3a20);
      limb(g, point(length * 0.5, 1.5), point(length - 2), 2.4, 2.2, 0x5a3a20);
      limb(g, point(length * 0.4), point(length * 0.46), 3.4, 3.4, FEATHERS[0]);
      const skull = point(length + 2);
      limb(g, skull, point(length + 7, -7), 2, 0.8, BONE);
      limb(g, skull, point(length + 7, 7), 2, 0.8, BONE);
      g.circle(skull.x, skull.y, 4).fill({ color: BONE });
      g.circle(...xy(point(length + 3, -1.5)), 0.9).fill({ color: 0x1b1a12 });
      g.circle(...xy(point(length + 3, 1.5)), 0.9).fill({ color: 0x1b1a12 });
      const flame = point(length + 9);
      const flicker = 0.5 + 0.5 * Math.sin(timeMs / 120);
      g.circle(flame.x, flame.y, 6 + 6 * cast + flicker * 1.5).fill({ color: FLAME, alpha: 0.16 + 0.3 * cast });
      ellipseIn(g, flame, { up: d, fwd: { x: -d.y, y: d.x } }, 4.5 + flicker, 2.6, 0x3fcf3a);
      g.circle(flame.x, flame.y, 1.6).fill({ color: 0xd8ffd0 });
    },
  };
};
