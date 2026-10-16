import type { Graphics } from 'pixi.js';

/**
 * A straw archery butt on a wooden easel, as the menu's bowman practises on it. Drawn around its bottom centre on
 * the ground (0, 0), turned a little towards the archer on the left, so the face is an upright ellipse.
 */
export const ARCHERY_TARGET = {
  /** Centre of the face above the ground. */
  centreY: -38,
  /** Half width and half height of the face. */
  radiusX: 10,
  radiusY: 19,
  /** The straw boss is this thick, behind the face (to the right). */
  depth: 5,
} as const;

const WOOD = { light: 0x9a6a3c, dark: 0x6e4826 };
const STRAW = { face: 0xe2c06a, side: 0xb8923f };
/** Rings from the outside in: white, black, blue, red, gold. */
const RINGS = [0xf4efe2, 0x3a3a3f, 0x3e74c0, 0xd8453a, 0xf2c94c];

export const drawArcheryTarget = (g: Graphics): void => {
  const { centreY: cy, radiusX: rx, radiusY: ry, depth } = ARCHERY_TARGET;
  g.clear();
  // Back leg, then the two front legs of the easel.
  g.moveTo(depth + 2, cy + 4).lineTo(depth + 14, 0).stroke({ width: 2.5, color: WOOD.dark, cap: 'round' });
  g.moveTo(-1, cy + 2).lineTo(-6, 0).stroke({ width: 3, color: WOOD.light, cap: 'round' });
  g.moveTo(3, cy + 2).lineTo(7, 0).stroke({ width: 3, color: WOOD.light, cap: 'round' });
  // The straw boss: its side, then the face with the rings.
  g.ellipse(depth, cy, rx, ry).fill({ color: STRAW.side });
  g.rect(0, cy - ry, depth, ry * 2).fill({ color: STRAW.side });
  g.ellipse(0, cy, rx, ry).fill({ color: STRAW.face });
  RINGS.forEach((color, index) => {
    const share = 0.86 - index * 0.17;
    g.ellipse(0, cy, rx * share, ry * share).fill({ color });
  });
};
