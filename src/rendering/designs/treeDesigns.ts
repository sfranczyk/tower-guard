import type { Graphics } from 'pixi.js';
import { mixColor } from '../clouds';

/**
 * Trees for the Green Meadow: variations on the map's round tree (three circles on a
 * trunk), in its colours. Those named in MEADOW_TREES stand on the map (rendering/landscape.ts, meadowTrees.ts).
 */

const MAIN = 0x2d594f;
const LIGHT = 0x35695a;
const DARK = 0x264e4b;
const TRUNK = 0x584d42;

/** Draws one tree with its foot at (x, ground); `height` as on the map (38, 52 or 66), `index` its place in the row. */
export type TreeDrawer = (g: Graphics, x: number, ground: number, height: number, index: number) => void;

export interface TreeDesign {
  id: string;
  name: string;
  tagline: string;
  description: string;
  draw: TreeDrawer;
}

/** The map's tree, with the trunk ending at the ground. */
const roundCrown = (g: Graphics, x: number, top: number, size = 1, colors = [MAIN, LIGHT, DARK]): void => {
  g.circle(x, top, 18 * size).fill({ color: colors[0] });
  g.circle(x - 14 * size, top + 12 * size, 15 * size).fill({ color: colors[1] });
  g.circle(x + 15 * size, top + 12 * size, 15 * size).fill({ color: colors[2] });
};
const trunk = (g: Graphics, x: number, ground: number, from: number, width = 6, color = TRUNK): void => {
  g.rect(x - width / 2, from, width, ground - from).fill({ color });
};
const current: TreeDrawer = (g, x, ground, height) => {
  const top = ground - height;
  roundCrown(g, x, top);
  trunk(g, x, ground, top + 16);
};

/** Small steady per-tree differences (the same every frame). */
const wobble = (index: number, salt: number): number => Math.sin(index * 12.9898 + salt * 78.233) * 0.5 + 0.5;

const designs: TreeDesign[] = [
  {
    id: 'current',
    name: 'Current',
    tagline: 'The map as it is',
    description: 'The round tree on the map today: three circles (middle, lighter left, darker right) on a straight trunk, heights cycling 38/52/66 every 92 px. For comparison.',
    draw: current,
  },
  {
    id: 'tall',
    name: 'Tall crown',
    tagline: 'A fourth circle on top',
    description: 'The same three circles, a little narrower, with a fourth one on top: an upright, taller tree that breaks the row\'s even outline.',
    draw: (g, x, ground, height) => {
      const top = ground - height;
      g.circle(x, top - 16, 13).fill({ color: MAIN });
      roundCrown(g, x, top, 0.85);
      trunk(g, x, ground, top + 14);
    },
  },
  {
    id: 'wide',
    name: 'Wide crown',
    tagline: 'Broad and low',
    description: 'Five circles side by side on a shorter, thicker trunk: a spreading tree like an old oak.',
    draw: (g, x, ground, height) => {
      const top = ground - height * 0.85;
      g.circle(x - 25, top + 18, 12).fill({ color: LIGHT });
      g.circle(x + 26, top + 18, 12).fill({ color: DARK });
      roundCrown(g, x, top);
      trunk(g, x, ground, top + 16, 8);
    },
  },
  {
    id: 'lopsided',
    name: 'Lopsided',
    tagline: 'Grown towards the light',
    description: 'The crown sits off the trunk and its side circles differ in size, as if one side got more sun. Each tree in the row leans its crown a different way.',
    draw: (g, x, ground, height, index) => {
      const top = ground - height;
      const side = index % 2 === 0 ? 1 : -1;
      const cx = x + side * 5;
      g.circle(cx, top, 18).fill({ color: MAIN });
      g.circle(cx - 14 - (side < 0 ? 3 : 0), top + 12, side < 0 ? 17 : 12).fill({ color: LIGHT });
      g.circle(cx + 15 + (side > 0 ? 3 : 0), top + 12, side > 0 ? 17 : 12).fill({ color: DARK });
      trunk(g, x, ground, top + 16);
    },
  },
  {
    id: 'leaning',
    name: 'Leaning',
    tagline: 'A slanted trunk',
    description: 'The map\'s tree with its trunk slightly slanted, so the crown stands a few pixels to one side of the foot; how far and which way changes from tree to tree.',
    draw: (g, x, ground, height, index) => {
      const top = ground - height;
      const lean = (wobble(index, 1) * 2 - 1) * 9;
      roundCrown(g, x + lean, top);
      g.poly([x - 3.5, ground, x + 3.5, ground, x + lean + 2.5, top + 16, x + lean - 2.5, top + 16]).fill({ color: TRUNK });
    },
  },
  {
    id: 'forked',
    name: 'Forked',
    tagline: 'Two crowns on one trunk',
    description: 'The trunk splits halfway into two branches, each carrying a smaller three-circle crown, one a little higher than the other.',
    draw: (g, x, ground, height) => {
      const top = ground - height;
      const fork = ground - height * 0.45;
      [[-11, top + 6], [12, top - 2]].forEach(([dx, y]) => {
        g.moveTo(x, fork).lineTo(x + dx, y + 10).stroke({ width: 4, color: TRUNK, cap: 'round' });
      });
      roundCrown(g, x - 11, top + 6, 0.68);
      roundCrown(g, x + 12, top - 2, 0.72);
      trunk(g, x, ground, fork, 6);
    },
  },
  {
    id: 'young',
    name: 'Young',
    tagline: 'Thin and small',
    description: 'A sapling: a thin trunk and the three circles at two thirds of their size. Mixed in, it makes the row look grown rather than planted.',
    draw: (g, x, ground, height) => {
      const top = ground - height * 0.8;
      roundCrown(g, x, top, 0.68);
      trunk(g, x, ground, top + 11, 4);
    },
  },
  {
    id: 'shaded',
    name: 'Shaded',
    tagline: 'Light and shadow on the crown',
    description: 'The map\'s tree with a small sunlit patch at the top left and a shadow under the crown, so it reads as a ball rather than three flat discs.',
    draw: (g, x, ground, height) => {
      const top = ground - height;
      g.circle(x + 3, top + 17, 16).fill({ color: mixColor(DARK, 0x000000, 0.2) });
      roundCrown(g, x, top);
      g.circle(x - 7, top - 7, 7).fill({ color: mixColor(LIGHT, 0xc9e39a, 0.25) });
      trunk(g, x, ground, top + 24);
    },
  },
  {
    id: 'undergrowth',
    name: 'Bush at its foot',
    tagline: 'Undergrowth',
    description: 'The map\'s tree with a low bush at its foot (two dark circles), on one side or the other.',
    draw: (g, x, ground, height, index) => {
      current(g, x, ground, height, index);
      const side = index % 2 === 0 ? 1 : -1;
      g.circle(x + side * 9, ground - 4, 9).fill({ color: DARK });
      g.circle(x + side * 19, ground - 2, 7).fill({ color: LIGHT });
    },
  },
  {
    id: 'clump',
    name: 'Clump',
    tagline: 'Two trees together',
    description: 'A smaller, darker tree just behind and beside the map\'s tree, so they stand as a pair instead of one by one.',
    draw: (g, x, ground, height, index) => {
      const behind = ground - height * 0.75;
      const shade = (color: number): number => mixColor(color, 0x10241f, 0.25);
      roundCrown(g, x - 17, behind, 0.75, [shade(MAIN), shade(LIGHT), shade(DARK)]);
      trunk(g, x - 17, ground, behind + 12, 4, shade(TRUNK));
      current(g, x + 6, ground, height, index);
    },
  },
];

export const TREE_DESIGNS: readonly TreeDesign[] = designs;

export const treeDesign = (id: string): TreeDesign => designs.find((design) => design.id === id) ?? designs[0];
