import { MEADOW, PLAYER_TOWER_X } from '../config';
import { createRandom } from '../utils/math';

/**
 * Where the Green Meadow's trees, rocks, flowers, fence and haystack stand (pure, seeded: the same map always looks
 * the same, for both co-op players). rendering/meadowArt.ts draws them.
 */

export type MeadowTreeKind = 'oak' | 'poplar' | 'bush';

export interface MeadowTree {
  x: number;
  kind: MeadowTreeKind;
  /** Foot to top of the crown, px. */
  height: number;
  /** Crown width, px. */
  width: number;
  /** −1 (darker) .. 1 (lighter) shift of the leaf colours. */
  shade: number;
  /** Horizontal drift of the crown over the foot, px (a slightly leaning tree). */
  lean: number;
  /** Back row: smaller and hazier. */
  far: boolean;
  /** Seed of the crown's blobs. */
  seed: number;
}

export interface MeadowRock {
  x: number;
  size: number;
}

export interface MeadowFlower {
  x: number;
  /** How far below the ground line it grows. */
  depth: number;
  /** Index into the map's flower colours. */
  color: number;
}

export interface MeadowLayout {
  /** Back row first, then the front row (drawing order). */
  trees: MeadowTree[];
  rocks: MeadowRock[];
  flowers: MeadowFlower[];
  /** A short fence and a haystack near the player's keep. */
  fence: { from: number; to: number };
  haystack: number;
}

/** Species mix (weights) and size ranges. */
const KINDS: ReadonlyArray<{ kind: MeadowTreeKind; weight: number; height: [number, number]; width: [number, number] }> = [
  { kind: 'oak', weight: 0.65, height: [48, 70], width: [48, 62] },
  { kind: 'poplar', weight: 0.22, height: [66, 88], width: [20, 26] },
  { kind: 'bush', weight: 0.13, height: [15, 20], width: [28, 38] },
];

/** Grass strip depth the flowers grow in, below the ground line. */
const FLOWER_DEPTH: [number, number] = [9, 44];

const between = (random: () => number, [min, max]: readonly [number, number]): number => min + (max - min) * random();

const pickKind = (random: () => number): (typeof KINDS)[number] => {
  let roll = random() * KINDS.reduce((sum, { weight }) => sum + weight, 0);
  for (const entry of KINDS) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry;
    }
  }
  return KINDS[0];
};

const growRow = (random: () => number, left: number, right: number, far: boolean): MeadowTree[] => {
  const trees: MeadowTree[] = [];
  const scale = far ? MEADOW.farScale : 1;
  const gap = far ? [MEADOW.farGapMin, MEADOW.farGapMax] as const : [MEADOW.gapMin, MEADOW.gapMax] as const;
  for (let x = left + between(random, [0, gap[1]]); x < right; ) {
    const { kind, height, width } = pickKind(random);
    const treeHeight = between(random, height) * scale;
    trees.push({
      x,
      kind,
      height: treeHeight,
      width: between(random, width) * scale,
      shade: random() * 2 - 1,
      lean: (random() * 2 - 1) * treeHeight * 0.03,
      far,
      seed: Math.floor(random() * 2 ** 31),
    });
    const roll = random();
    if (!far && roll < MEADOW.clumpChance) {
      x += between(random, [16, 32]);
    } else if (!far && roll < MEADOW.clumpChance + MEADOW.clearingChance) {
      x += between(random, gap) + between(random, [90, 160]);
    } else {
      x += between(random, gap);
    }
  }
  return trees;
};

export const layoutMeadow = (left: number, right: number, seed: number): MeadowLayout => {
  const random = createRandom(seed);
  const trees = [...growRow(random, left, right, true), ...growRow(random, left, right, false)];
  const rocks: MeadowRock[] = [];
  for (let x = left + between(random, [0, MEADOW.rockEvery]); x < right; x += between(random, [0.4, 1.6]) * MEADOW.rockEvery) {
    rocks.push({ x, size: between(random, [5, 11]) });
  }
  const flowers: MeadowFlower[] = Array.from({ length: Math.round(((right - left) / 100) * MEADOW.flowers) }, () => ({
    x: between(random, [left, right]),
    depth: between(random, FLOWER_DEPTH),
    color: Math.floor(random() * 1e6),
  }));
  return {
    trees,
    rocks,
    flowers,
    fence: { from: PLAYER_TOWER_X + 150, to: PLAYER_TOWER_X + 235 },
    haystack: PLAYER_TOWER_X + 330,
  };
};
