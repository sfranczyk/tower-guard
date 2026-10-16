import type { Graphics } from 'pixi.js';
import { MEADOW } from '../config';
import type { Battleground } from '../data/battlegrounds';
import { groundAt } from '../systems/terrain';
import { createRandom } from '../utils/math';
import { mixColor } from './clouds';
import type { MeadowFlower, MeadowLayout, MeadowTree } from './meadowLayout';

/** Green Meadow scenery from a `layoutMeadow` plan: oaks, poplars, birches and bushes, rocks, a fence and a haystack. */

type Leaves = { main: number; light: number; dark: number };

const BIRCH_BARK = 0xe9e6dc;
const BIRCH_MARK = 0x3d3a36;
const ROCK = { main: 0x8a8f86, light: 0xaab0a5, dark: 0x6a7068 };
const HAY = { main: 0xd8b65c, light: 0xe9cf84, dark: 0xb08c3e };

const treeLeaves = ({ trees: { colors }, hills }: Battleground, tree: MeadowTree): Leaves => {
  const [main, light, dark] = colors;
  // Birches have airier, yellower leaves.
  const birch = tree.kind === 'birch' ? 0.3 : 0;
  const tone = (color: number): number => {
    let toned = mixColor(color, 0x9cc46e, birch);
    toned = tree.shade > 0 ? mixColor(toned, 0xc9e39a, tree.shade * 0.14) : mixColor(toned, 0x10241f, -tree.shade * 0.18);
    return tree.far ? mixColor(toned, hills[0], MEADOW.farHaze) : toned;
  };
  return { main: tone(main), light: tone(light), dark: tone(dark) };
};

/** Overlapping round blobs: shadow side down-right, highlight up-left. */
const drawBlobs = (g: Graphics, blobs: ReadonlyArray<[number, number, number]>, leaves: Leaves): void => {
  blobs.forEach(([x, y, r]) => g.circle(x + r * 0.18, y + r * 0.22, r).fill({ color: leaves.dark }));
  blobs.forEach(([x, y, r]) => g.circle(x - r * 0.06, y - r * 0.04, r * 0.86).fill({ color: leaves.main }));
  blobs.filter(([, y], index) => index === 0 || y < blobs[0][1]).forEach(([x, y, r]) => {
    g.circle(x - r * 0.32, y - r * 0.36, r * 0.42).fill({ color: leaves.light });
  });
};

/** A trunk tapering from the foot to `top`, bending with the lean. */
const drawTrunk = (g: Graphics, x: number, ground: number, top: number, lean: number, base: number, color: number): void => {
  g.poly([x - base, ground + 3, x + base, ground + 3, x + lean + base * 0.45, top, x + lean - base * 0.45, top]).fill({ color });
};

const drawTree = (g: Graphics, tree: MeadowTree, leaves: Leaves, trunk: number): void => {
  const { x, height, width, lean } = tree;
  const ground = groundAt(x);
  const random = createRandom(tree.seed);
  const cx = x + lean;
  const scale = tree.far ? MEADOW.farScale : 1;
  if (tree.kind === 'bush') {
    const blobs: Array<[number, number, number]> = [[cx, ground - height * 0.75, height * 0.75]];
    blobs.push([cx - width * 0.3, ground - height * 0.4, height * 0.6], [cx + width * 0.3, ground - height * 0.35, height * 0.55]);
    drawBlobs(g, blobs, leaves);
    return;
  }
  if (tree.kind === 'poplar') {
    const cy = ground - height * 0.56;
    const rx = width / 2;
    const ry = height * 0.44;
    drawTrunk(g, x, ground, cy, lean * 0.5, 2.4 * scale, trunk);
    g.ellipse(cx + rx * 0.12, cy + 2, rx, ry).fill({ color: leaves.dark });
    g.ellipse(cx - rx * 0.12, cy - 1, rx * 0.82, ry * 0.94).fill({ color: leaves.main });
    g.ellipse(cx - rx * 0.4, cy - ry * 0.25, rx * 0.3, ry * 0.5).fill({ color: leaves.light });
    return;
  }
  if (tree.kind === 'birch') {
    const top = ground - height * 0.72;
    drawTrunk(g, x, ground, top, lean, 2.6 * scale, tree.far ? mixColor(BIRCH_BARK, leaves.dark, 0.35) : BIRCH_BARK);
    for (let y = ground - 6; y > top + 4; y -= 6 + random() * 7) {
      const along = (ground - y) / (ground - top);
      g.rect(x + lean * along - 2 * scale + random() * 2, y, (1.5 + random() * 2) * scale, 1.4 * scale).fill({ color: BIRCH_MARK });
    }
    const r = width * 0.24;
    const blobs = Array.from({ length: 4 }, (_, index): [number, number, number] => [
      cx + (index - 1.5) * width * 0.2 + (random() - 0.5) * 6 * scale,
      ground - height + r + (index % 2) * r * 0.9 + random() * 4 * scale,
      r * (0.8 + random() * 0.35),
    ]);
    drawBlobs(g, blobs.sort((a, b) => a[1] - b[1]), leaves);
    return;
  }
  // Oak: a stout trunk under a broad crown of 4–5 blobs.
  const r = width * 0.27;
  const crownY = ground - height + r * 1.3;
  drawTrunk(g, x, ground, crownY, lean, 3.6 * scale, trunk);
  const count = 4 + Math.floor(random() * 2);
  const blobs = Array.from({ length: count }, (_, index): [number, number, number] => {
    const angle = Math.PI * (0.15 + (0.7 * index) / (count - 1)) + (random() - 0.5) * 0.4;
    return [cx - Math.cos(angle) * width * 0.3, crownY - Math.sin(angle) * r * 0.75 + r * 0.3, r * (0.78 + random() * 0.35)];
  });
  blobs.unshift([cx, crownY - r * 0.35, r * 1.05]);
  drawBlobs(g, blobs, leaves);
};

const drawRock = (g: Graphics, x: number, size: number): void => {
  const ground = groundAt(x) + 2;
  g.ellipse(x, ground - size * 0.35, size * 1.3, size * 0.8).fill({ color: ROCK.dark });
  g.ellipse(x - size * 0.15, ground - size * 0.5, size * 1.05, size * 0.6).fill({ color: ROCK.main });
  g.ellipse(x - size * 0.45, ground - size * 0.75, size * 0.45, size * 0.22).fill({ color: ROCK.light });
};

const drawFence = (g: Graphics, from: number, to: number, wood: number): void => {
  const dark = mixColor(wood, 0x000000, 0.25);
  const posts = Math.max(2, Math.round((to - from) / 28) + 1);
  const xs = Array.from({ length: posts }, (_, index) => from + ((to - from) * index) / (posts - 1));
  [9, 17].forEach((lift) => {
    xs.slice(1).forEach((x, index) => {
      const x0 = xs[index];
      g.poly([x0, groundAt(x0) - lift - 1.5, x, groundAt(x) - lift - 1.5, x, groundAt(x) - lift + 1.5, x0, groundAt(x0) - lift + 1.5]).fill({ color: wood });
    });
  });
  xs.forEach((x, index) => {
    const ground = groundAt(x);
    const height = 22 + (index % 2) * 3;
    g.rect(x - 2, ground - height, 4, height + 3).fill({ color: dark });
    g.rect(x - 2, ground - height, 1.5, height + 3).fill({ color: wood });
  });
};

const drawHaystack = (g: Graphics, x: number): void => {
  const ground = groundAt(x) + 2;
  g.moveTo(x - 28, ground).bezierCurveTo(x - 30, ground - 30, x + 30, ground - 30, x + 28, ground).closePath().fill({ color: HAY.dark });
  g.moveTo(x - 25, ground).bezierCurveTo(x - 27, ground - 27, x + 22, ground - 29, x + 20, ground).closePath().fill({ color: HAY.main });
  g.ellipse(x - 8, ground - 16, 8, 4).fill({ color: HAY.light });
  // Straw strands.
  [-16, -7, 3, 12].forEach((dx, index) => {
    g.moveTo(x + dx, ground - 2).lineTo(x + dx + 3, ground - 14 - (index % 2) * 4).stroke({ width: 1.2, color: HAY.dark, alpha: 0.7 });
  });
};

/** Trees (back row first), rocks, fence and haystack, standing on the ground line. */
export const drawMeadow = (g: Graphics, battleground: Battleground, layout: MeadowLayout): void => {
  const { trunk } = battleground.trees;
  layout.trees.forEach((tree) => {
    const leaves = treeLeaves(battleground, tree);
    drawTree(g, tree, leaves, tree.far ? mixColor(trunk, battleground.hills[0], MEADOW.farHaze) : trunk);
  });
  layout.rocks.forEach(({ x, size }) => drawRock(g, x, size));
  drawFence(g, layout.fence.from, layout.fence.to, mixColor(trunk, 0xc8b89a, 0.3));
  drawHaystack(g, layout.haystack);
};

/** Small flowers scattered in the grass strip. */
export const drawFlowers = (g: Graphics, flowers: readonly MeadowFlower[], colors: readonly number[]): void => {
  flowers.forEach(({ x, depth, color }) => {
    const y = groundAt(x) + depth;
    const size = 1.4 + depth / 40;
    g.circle(x, y, size).fill({ color: colors[color % colors.length] });
    g.circle(x, y, size * 0.4).fill({ color: 0xfff1a8 });
  });
};
