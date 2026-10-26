import type { Graphics } from 'pixi.js';

/** The battle view is mirrored (core/keepSide.ts): bars fill from their right end so they still read the normal way. */
let mirroredBars = false;

/** Sets whether the battle view is mirrored (GameScene); true when it changed, so the bars drawn so far need a redraw. */
export const setBarsMirrored = (mirrored: boolean): boolean => {
  const changed = mirrored !== mirroredBars;
  mirroredBars = mirrored;
  return changed;
};

/** Where a bar's fill `filled` px wide starts in a bar `width` wide centred on 0 (its left end, the right one when mirrored). */
export const barFillX = (width: number, filled: number): number => (mirroredBars ? width / 2 - filled : -width / 2);

/**
 * A health bar (enemies, dragons, keeps), centred on the graphic's origin: a dark track and a fill from green (full)
 * through yellow to red (low), or (`fixedColor`) one colour throughout (a mounted knight's horse). `ratio` is clamped to 0..1.
 */
export const drawHealthBar = (g: Graphics, ratio: number, width: number, height: number, fixedColor?: number): void => {
  const fill = Math.max(0, Math.min(1, ratio));
  const color = fixedColor ?? (fill > 0.6 ? 0x6fd36b : fill > 0.3 ? 0xf2c94c : 0xe5534b);
  g.clear()
    .rect(-width / 2 - 1, -height / 2 - 1, width + 2, height + 2).fill({ color: 0x1b1a20, alpha: 0.85 })
    .rect(barFillX(width, width * fill), -height / 2, width * fill, height).fill({ color });
};

/** The points of a five-pointed star of outer radius `r` at (`x`, `y`), point up. */
export const starPoints = (x: number, y: number, r: number): number[] => Array.from({ length: 10 }, (_, i) => {
  const angle = -Math.PI / 2 + (i * Math.PI) / 5;
  const radius = i % 2 === 0 ? r : r * 0.45;
  return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
}).flat();

/** MOBA: a minion's level as gold stars in a row centred under its health bar (`top`: their centre's y); none at level 1. */
export const drawLevelStars = (g: Graphics, count: number, top: number): void => {
  g.clear();
  const r = 3.2;
  const gap = 7.5;
  for (let i = 0; i < count; i += 1) {
    const x = (i - (count - 1) / 2) * gap;
    g.poly(starPoints(x, top, r)).fill({ color: 0xffc93c }).stroke({ width: 0.8, color: 0x1b1a20 });
  }
};
