import { createRandom } from '../utils/math';

/**
 * A keep brought down (objects/Tower.ts, lab row `keep-collapse`), in the keep's drawing space (rendering/keep.ts: 200
 * wide, its base centre at `base`): it shakes, then crumbles down into itself, leaning towards the field, while stones
 * fly off its top and a dust cloud rolls out; a heap of rubble rises at its foot and stays. Pure math, drawn by
 * keepRuin.ts.
 */
export const KEEP_COLLAPSE_MS = 3200;

/** Shares of the collapse: the shaking before it gives way, the fall, the rubble heap growing, the dust's life (ms). */
const FALL = { from: 0.12, to: 0.68, keep: 0.1 };
const HEAP = { from: 0.18, to: 0.78, height: 74, width: 190 };
const SHAKE = { px: 3.2, until: 0.8 };
const LEAN = 0.13;
const STONES = { count: 20, gravity: 1300, size: [4, 11] as const };
const DUST = { count: 14, lifeMs: 1900, radius: [18, 78] as const, rise: 46 };

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const span = (t: number, from: number, to: number): number => clamp01((t - from) / (to - from));
const smooth = (value: number): number => value * value * (3 - 2 * value);

export interface CollapseFrame {
  /** How tall the keep still stands (1 whole .. FALL.keep, by then under the rubble). */
  standing: number;
  /** Its lean (radians, + = top to the right) and sideways shake (drawing px). */
  lean: number;
  shake: number;
  /** How far the rubble heap has risen (0..1). */
  heap: number;
  /** The collapse is over (only the ruin is left). */
  done: boolean;
}

/**
 * The keep's state `timeMs` into its fall; `side` 1 leans it to the right (the player's keep falls towards the field),
 * -1 to the left.
 */
export const collapseFrame = (timeMs: number, side: 1 | -1): CollapseFrame => {
  const t = timeMs / KEEP_COLLAPSE_MS;
  const fall = span(t, FALL.from, FALL.to);
  // Gives way slowly, then faster and faster.
  const sunk = fall * fall;
  const shaking = 1 - span(t, SHAKE.until - 0.15, SHAKE.until);
  return {
    standing: 1 - (1 - FALL.keep) * sunk,
    lean: side * LEAN * sunk,
    shake: shaking * SHAKE.px * (Math.sin(timeMs / 21) * 0.7 + Math.sin(timeMs / 9) * 0.3),
    heap: smooth(span(t, HEAP.from, HEAP.to)),
    done: t >= 1,
  };
};

export interface Stone {
  x: number;
  y: number;
  size: number;
  angle: number;
  /** Lies still on the ground. */
  landed: boolean;
}

export interface DustPuff {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

interface StoneFlight {
  at: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spin: number;
}

/** The stones knocked off the keep, the same for one `seed` (a keep's own). */
const stoneFlights = (seed: number, side: 1 | -1): StoneFlight[] => {
  const random = createRandom(seed >>> 0);
  return Array.from({ length: STONES.count }, () => {
    const at = (FALL.from + random() * (FALL.to - FALL.from) * 0.85) * KEEP_COLLAPSE_MS;
    const height = 406 * (1 - (1 - FALL.keep) * span(at / KEEP_COLLAPSE_MS, FALL.from, FALL.to) ** 2);
    // Most go the way it leans.
    const way = random() < 0.75 ? side : -side;
    return {
      at,
      x: 40 + random() * 120,
      y: 404 - height * (0.55 + random() * 0.45),
      vx: way * (40 + random() * 200),
      vy: -(random() * 180),
      size: STONES.size[0] + random() * (STONES.size[1] - STONES.size[0]),
      spin: (random() - 0.5) * 14,
    };
  });
};

/** Where the stones are `timeMs` into the fall (those not off yet are left out); they land on the ground at y 404. */
export const collapseStones = (timeMs: number, seed: number, side: 1 | -1): Stone[] =>
  stoneFlights(seed, side)
    .filter((stone) => timeMs >= stone.at)
    .map((stone) => {
      const ground = 404 - stone.size * 0.5;
      // Time (s) it takes to reach the ground: y + vy·s + g·s²/2 = ground.
      const { gravity } = STONES;
      const landS = (-stone.vy + Math.sqrt(stone.vy ** 2 + 2 * gravity * (ground - stone.y))) / gravity;
      const s = Math.min((timeMs - stone.at) / 1000, landS);
      return {
        x: stone.x + stone.vx * s,
        y: Math.min(ground, stone.y + stone.vy * s + (gravity * s * s) / 2),
        size: stone.size,
        angle: stone.spin * s,
        landed: s >= landS,
      };
    });

/** The dust rolling out from the keep's foot `timeMs` into the fall (gone a while after it). */
export const collapseDust = (timeMs: number, seed: number): DustPuff[] => {
  const random = createRandom((seed ^ 0x2c1b3c6d) >>> 0);
  return Array.from({ length: DUST.count }, (_, index) => {
    const born = (FALL.from + (index / DUST.count) * (FALL.to - FALL.from)) * KEEP_COLLAPSE_MS;
    const drift = (random() - 0.5) * 2;
    const age = (timeMs - born) / DUST.lifeMs;
    if (age < 0 || age > 1) {
      return undefined;
    }
    const grow = 1 - (1 - age) ** 2;
    return {
      x: 100 + drift * (40 + 110 * grow),
      y: 396 - DUST.rise * grow - random() * 30,
      radius: DUST.radius[0] + (DUST.radius[1] - DUST.radius[0]) * grow,
      alpha: 0.6 * (1 - age) * Math.min(1, age * 6),
    };
  }).filter((puff): puff is DustPuff => puff !== undefined);
};

/** The rubble heap's outline (x, y pairs, drawing space) at `heap` 0..1 risen: a low uneven mound across the keep's foot. */
export const heapOutline = (heap: number, seed: number): number[] => {
  const random = createRandom((seed ^ 0x51ed270b) >>> 0);
  const steps = 14;
  const points: number[] = [100 - HEAP.width / 2, 404];
  for (let index = 1; index < steps; index += 1) {
    const u = index / steps;
    const bump = Math.sin(Math.PI * u) ** 0.8 * (0.75 + random() * 0.4);
    points.push(100 - HEAP.width / 2 + HEAP.width * u, 404 - HEAP.height * heap * bump);
  }
  points.push(100 + HEAP.width / 2, 404);
  return points;
};
