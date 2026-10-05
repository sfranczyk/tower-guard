import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import type { ArcherRig } from './archer';

/**
 * "Armored archer" skin details drawn on top of the stickman skeleton, in stickman sprite space
 * (hip at 0,0, shoulder at 0,-35, head centre at 0,-52, facing +x).
 */
export const ARMOR_COLORS = {
  limb: 0x26272b,
  limbRear: 0x3b3d44,
  outline: 0x1d1e22,
  plate: 0x8f949c,
  plateLight: 0xc3c7cd,
  gold: 0xe0a526,
  leather: 0x5a3b28,
} as const;

/** Nocked arrow length (sprite units): at full draw the head sits 16 units past the bow grip. */
const NOCKED_ARROW_LENGTH = 72;

const OUTLINE = { width: 2.5, color: ARMOR_COLORS.outline, join: 'round', cap: 'round' } as const;

const polygon = (sprite: Graphics, points: Vec2[], fill: number): void => {
  sprite.poly(points.flatMap(({ x, y }) => [x, y])).fill({ color: fill }).stroke(OUTLINE);
};

/** Gold arc as its own path (Pixi would otherwise connect it to the previous path point). */
const goldArc = (sprite: Graphics, cx: number, cy: number, radius: number, start: number, end: number, width = 2): void => {
  sprite.moveTo(cx + Math.cos(start) * radius, cy + Math.sin(start) * radius)
    .arc(cx, cy, radius, start, end)
    .stroke({ width, color: ARMOR_COLORS.gold, cap: 'round' });
};

const goldLine = (sprite: Graphics, points: Vec2[]): void => {
  sprite.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach(({ x, y }) => sprite.lineTo(x, y));
  sprite.stroke({ width: 2, color: ARMOR_COLORS.gold, cap: 'round', join: 'round' });
};

/** Quiver slung across the back with fletchings sticking out (draw behind the torso). */
export const drawQuiver = (sprite: Graphics): void => {
  sprite.moveTo(-3, -12).lineTo(-12, -42).stroke({ width: 9, color: ARMOR_COLORS.outline, cap: 'round' });
  sprite.moveTo(-3, -12).lineTo(-12, -42).stroke({ width: 6, color: ARMOR_COLORS.leather, cap: 'round' });
  [[-16, -52], [-11, -54], [-7, -51]].forEach(([x, y]) => {
    sprite.moveTo(-11, -43).lineTo(x, y).stroke({ width: 2, color: ARMOR_COLORS.outline, cap: 'round' });
    sprite.poly([x - 2.5, y + 1, x, y - 4, x + 2.5, y + 1]).fill({ color: ARMOR_COLORS.outline });
  });
};

/** Chest plate with crossed straps, belt and hip plates (draw over the legs). */
export const drawArmor = (sprite: Graphics): void => {
  // Hip plates (tassets).
  polygon(sprite, [{ x: -12, y: -3 }, { x: -1, y: -3 }, { x: -3, y: 15 }, { x: -14, y: 12 }], ARMOR_COLORS.plate);
  polygon(sprite, [{ x: 1, y: -3 }, { x: 12, y: -3 }, { x: 14, y: 12 }, { x: 3, y: 15 }], ARMOR_COLORS.plate);
  goldLine(sprite, [{ x: -10, y: 0 }, { x: -11.5, y: 10 }]);
  goldLine(sprite, [{ x: 10, y: 0 }, { x: 11.5, y: 10 }]);

  // Chest plate.
  polygon(sprite, [
    { x: -11, y: -37 }, { x: 11, y: -37 }, { x: 12.5, y: -22 },
    { x: 9, y: -6 }, { x: -9, y: -6 }, { x: -12.5, y: -22 },
  ], ARMOR_COLORS.plate);
  sprite.poly([-8, -34, 8, -34, 9, -24, -9, -24]).fill({ color: ARMOR_COLORS.plateLight });
  goldLine(sprite, [{ x: -10, y: -35 }, { x: -4, y: -31 }, { x: 4, y: -31 }, { x: 10, y: -35 }]);
  goldLine(sprite, [{ x: -8.5, y: -9 }, { x: 8.5, y: -9 }]);
  sprite.moveTo(-10, -35).lineTo(8, -8).moveTo(10, -35).lineTo(-8, -8)
    .stroke({ width: 2.5, color: ARMOR_COLORS.outline, cap: 'round' });

  // Belt with buckle.
  sprite.roundRect(-11, -7, 22, 5, 1.5).fill({ color: ARMOR_COLORS.outline });
  sprite.rect(-2, -6.5, 4, 4).fill({ color: ARMOR_COLORS.gold });
};

/** Hood with gold trim and a shadowed face (replaces the plain head circle). */
export const drawHood = (sprite: Graphics, head: { x: number; y: number; radius: number }): void => {
  const { x, y, radius } = head;
  // Hood tail falling down the back of the neck.
  polygon(sprite, [{ x: x - radius, y: y - 2 }, { x: x - radius - 3, y: y + 14 }, { x: x + 2, y: y + 10 }], ARMOR_COLORS.plate);
  sprite.circle(x - 1, y - 1, radius + 3).fill({ color: ARMOR_COLORS.plate }).stroke(OUTLINE);
  sprite.circle(x - 3, y - 4, radius - 3).fill({ color: ARMOR_COLORS.plateLight });
  sprite.circle(x + 3, y + 1, radius - 2).fill({ color: ARMOR_COLORS.limb });
  goldArc(sprite, x + 3, y + 1, radius - 0.5, -Math.PI * 0.75, Math.PI * 0.55);
};

/** Shoulder plate over the front arm. */
export const drawPauldron = (sprite: Graphics, shoulder: Vec2): void => {
  sprite.ellipse(shoulder.x + 4, shoulder.y + 2, 8, 5.5).fill({ color: ARMOR_COLORS.plate }).stroke(OUTLINE);
  goldArc(sprite, shoulder.x + 4, shoulder.y + 2, 5.5, Math.PI * 0.1, Math.PI * 0.9, 1.8);
};

/** Thick dark recurve bow, string, and a nocked arrow while the bow is being drawn. */
export const drawArmoredBow = (sprite: Graphics, rig: ArcherRig, tension: number): void => {
  const { bowTop, bowBottom, bowControl, stringNock, woodHand } = rig;
  sprite.moveTo(bowTop.x, bowTop.y)
    .lineTo(stringNock.x, stringNock.y)
    .lineTo(bowBottom.x, bowBottom.y)
    .stroke({ width: 1.5, color: ARMOR_COLORS.limbRear, join: 'round' });
  sprite.moveTo(bowTop.x, bowTop.y)
    .quadraticCurveTo(bowControl.x, bowControl.y, bowBottom.x, bowBottom.y)
    .stroke({ width: 5.5, color: ARMOR_COLORS.limb, cap: 'round', join: 'round' });

  if (tension <= 0.02) {
    return;
  }
  const dx = woodHand.x - stringNock.x;
  const dy = woodHand.y - stringNock.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  // Fixed length: the arrow slides back with the string hand instead of stretching.
  const tip = { x: stringNock.x + ux * NOCKED_ARROW_LENGTH, y: stringNock.y + uy * NOCKED_ARROW_LENGTH };
  sprite.moveTo(stringNock.x, stringNock.y).lineTo(tip.x, tip.y)
    .stroke({ width: 2, color: ARMOR_COLORS.limb, cap: 'round' });
  // Arrowhead and fletching.
  sprite.poly([
    tip.x + ux * 7, tip.y + uy * 7,
    tip.x - uy * 3.5, tip.y + ux * 3.5,
    tip.x + uy * 3.5, tip.y - ux * 3.5,
  ]).fill({ color: ARMOR_COLORS.limb });
  sprite.poly([
    stringNock.x + ux * 7, stringNock.y + uy * 7,
    stringNock.x - uy * 3, stringNock.y + ux * 3,
    stringNock.x + uy * 3, stringNock.y - ux * 3,
  ]).fill({ color: ARMOR_COLORS.limbRear });
};
