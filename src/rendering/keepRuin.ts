import type { Graphics } from 'pixi.js';
import { mixColor } from './clouds';
import { KEEP_BASE, drawKeep, type KeepLook } from './keep';
import { collapseDust, collapseFrame, collapseStones, heapOutline } from './keepCollapse';

/**
 * Draws a keep `timeMs` into its fall (keepCollapse.ts; the lasting ruin once it's over) into `g`, in the keep's
 * drawing space: what still stands (shaking, leaning, crumbling down into itself), the stones flying off, the rubble
 * heap and the dust. `side` 1 falls to the right; `seed` picks the stones and the heap's shape. `place` (the lab) puts
 * the keep's base at its x, y at its scale.
 */
export const drawKeepRuin = (
  g: Graphics, look: Omit<KeepLook, 'damage' | 'append'>, timeMs: number, side: 1 | -1, seed: number,
  place?: { x: number; y: number; scale: number },
): void => {
  const frame = collapseFrame(timeMs, side);
  const { tones } = look;
  // Pixi applies transform steps to the points in the order they're called: `place` comes last.
  const placed = (): void => {
    if (place) {
      g.translateTransform(-KEEP_BASE.x, -KEEP_BASE.y).scaleTransform(place.scale).translateTransform(place.x, place.y);
    }
  };
  g.clear();
  if (!frame.done) {
    // About the base: squashed to what still stands, leaned, shaken.
    g.translateTransform(-KEEP_BASE.x, -KEEP_BASE.y)
      .scaleTransform(1, frame.standing)
      .rotateTransform(frame.lean)
      .translateTransform(KEEP_BASE.x + frame.shake, KEEP_BASE.y);
    placed();
    drawKeep(g, { ...look, damage: 3, append: true });
    g.resetTransform();
  }
  placed();
  collapseStones(timeMs, seed, side).forEach((stone) => {
    const cos = Math.cos(stone.angle) * stone.size;
    const sin = Math.sin(stone.angle) * stone.size;
    g.poly([stone.x + cos, stone.y + sin, stone.x - sin * 0.8, stone.y + cos * 0.8, stone.x - cos, stone.y - sin, stone.x + sin * 0.7, stone.y - cos * 0.7])
      .fill({ color: stone.landed ? tones.shade : tones.base });
  });
  if (frame.heap > 0) {
    const outline = heapOutline(frame.heap, seed);
    g.poly(outline).fill({ color: tones.shade });
    // Blocks on the heap, lit from the left.
    for (let index = 2; index < outline.length - 4; index += 4) {
      const x = outline[index];
      const top = outline[index + 1];
      const height = KEEP_BASE.y - top;
      if (height < 8) {
        continue;
      }
      g.roundRect(x - 7, top + 3, 14, Math.min(11, height * 0.4), 2).fill({ color: index % 8 === 2 ? tones.light : tones.base });
      g.roundRect(x + 2, top + height * 0.5, 12, Math.min(9, height * 0.3), 2).fill({ color: tones.deep });
    }
  }
  const dustColor = mixColor(tones.light, 0xd8cbb4, 0.5);
  collapseDust(timeMs, seed).forEach((puff) => {
    g.circle(puff.x, puff.y, puff.radius).fill({ color: dustColor, alpha: puff.alpha });
  });
};
