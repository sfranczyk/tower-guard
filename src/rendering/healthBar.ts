import type { Graphics } from 'pixi.js';

/**
 * A health bar (enemies, dragons, keeps), centred on the graphic's origin: a dark track and a fill from green (full)
 * through yellow to red (low), or (`fixedColor`) one colour throughout (a mounted knight's horse). `ratio` is clamped to 0..1.
 */
export const drawHealthBar = (g: Graphics, ratio: number, width: number, height: number, fixedColor?: number): void => {
  const fill = Math.max(0, Math.min(1, ratio));
  const color = fixedColor ?? (fill > 0.6 ? 0x6fd36b : fill > 0.3 ? 0xf2c94c : 0xe5534b);
  g.clear()
    .rect(-width / 2 - 1, -height / 2 - 1, width + 2, height + 2).fill({ color: 0x1b1a20, alpha: 0.85 })
    .rect(-width / 2, -height / 2, width * fill, height).fill({ color });
};
