import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import type { JointPose } from './stickmanPose';

/**
 * Someone on fire: flame tongues licking up from points along the body (feet, knees, hip, chest, shoulders,
 * head) and smoke rising from the top, flickering with time. `burnFlames` / `burnSmoke` are pure (tested);
 * the points come from the figure's current pose, so the fire follows walking, falling and lying.
 * Units are stickman sprite units (the bowman's figure is ~110 tall); flames always rise straight up.
 */

export interface FlameTongue {
  /** Where it burns from, and its tip (base + sway sideways, height up). */
  base: Vec2;
  tip: Vec2;
  width: number;
}

export interface SmokePuff {
  center: Vec2;
  radius: number;
  alpha: number;
}

/** Flame size (sprite units) and how fast they flicker (ms per cycle, varied per tongue). */
const FLAME = { height: 34, heightFlicker: 12, width: 10, flickerMs: 260 };
/** Tongues per body point, offset so they don't flicker in step. */
const TONGUES_PER_POINT = 1;
const SMOKE = { count: 5, cycleMs: 1600, rise: 70, radius: { start: 6, end: 20 }, alpha: 0.4 };

/** Fire colours, outermost first. */
export const BURN_COLORS = [0xd8432b, 0xff8a2e, 0xffd35a, 0xfff1b8] as const;
const SMOKE_COLOR = 0x4a4240;

/** Deterministic 0..1 noise. */
const noise = (index: number, salt: number): number => {
  const value = Math.sin(index * 91.7 + salt * 47.3) * 24634.6345;
  return value - Math.floor(value);
};

/** The points fire burns from on a joint pose (both feet and knees, hip, chest, shoulder, head). */
export const burnPoints = (pose: JointPose): Vec2[] => [
  pose.rearFoot,
  pose.frontFoot,
  pose.rearKnee,
  pose.frontKnee,
  pose.hip,
  { x: (pose.hip.x + pose.shoulder.x) / 2, y: (pose.hip.y + pose.shoulder.y) / 2 },
  pose.shoulder,
  pose.head,
];

/** Body points of a stickman standing (drawStickman's pose: hip at 0,0, feet at ±16,55, head at 0,-52). */
export const STANDING_BURN_POINTS: readonly Vec2[] = [
  { x: -16, y: 55 }, { x: 16, y: 55 }, { x: -9, y: 28 }, { x: 9, y: 28 },
  { x: 0, y: 0 }, { x: 0, y: -18 }, { x: 0, y: -35 }, { x: 0, y: -52 },
];

/**
 * Flame tongues at `timeMs`, `intensity` 0..1 (catching fire, burning out), `size` × the normal flame. Each
 * tongue grows and shrinks on its own beat and sways; the hottest layers are drawn by drawBurning on top.
 */
export const burnFlames = (points: readonly Vec2[], timeMs: number, intensity: number, size = 1): FlameTongue[] => {
  const strength = Math.max(0, Math.min(1, intensity));
  if (strength === 0) {
    return [];
  }
  return points.flatMap((point, pointIndex) => Array.from({ length: TONGUES_PER_POINT }, (_, tongue) => {
    const index = pointIndex * TONGUES_PER_POINT + tongue;
    const period = FLAME.flickerMs * (0.75 + 0.5 * noise(index, 1));
    const phase = (timeMs / period + noise(index, 2)) * Math.PI * 2;
    const height = (FLAME.height + FLAME.heightFlicker * Math.sin(phase)) * strength * (0.7 + 0.5 * noise(index, 3)) * size;
    const sway = Math.sin(phase * 0.7 + index) * 6 * strength * size;
    const base = { x: point.x + (noise(index, 4) - 0.5) * 14, y: point.y + (noise(index, 5) - 0.5) * 6 };
    return {
      base,
      tip: { x: base.x + sway, y: base.y - height },
      width: FLAME.width * (0.6 + 0.4 * strength) * (0.8 + 0.4 * noise(index, 6)) * size,
    };
  }));
};

/** Smoke puffs rising from `top` (the highest burning point), fading as they climb. */
export const burnSmoke = (top: Vec2, timeMs: number, intensity: number, size = 1): SmokePuff[] => {
  const strength = Math.max(0, Math.min(1, intensity));
  return Array.from({ length: SMOKE.count }, (_, index) => {
    const age = ((timeMs / SMOKE.cycleMs + index / SMOKE.count) % 1 + 1) % 1;
    return {
      center: { x: top.x + (Math.sin(age * 5 + index * 2) * 6 + age * 8) * size, y: top.y - (14 + age * SMOKE.rise) * size },
      radius: (SMOKE.radius.start + (SMOKE.radius.end - SMOKE.radius.start) * age) * size,
      alpha: SMOKE.alpha * strength * (1 - age),
    };
  });
};

/** One flame tongue as a teardrop: round at the base, pointed at the (swaying) tip, scaled by `scale`. */
const drawTongue = (g: Graphics, { base, tip, width }: FlameTongue, scale: number, color: number, alpha: number): void => {
  const w = width * scale;
  const top = { x: base.x + (tip.x - base.x) * scale, y: base.y + (tip.y - base.y) * scale };
  g.moveTo(base.x - w, base.y)
    .quadraticCurveTo(base.x - w, top.y + (base.y - top.y) * 0.35, top.x, top.y)
    .quadraticCurveTo(base.x + w, top.y + (base.y - top.y) * 0.35, base.x + w, base.y)
    .arc(base.x, base.y, w, 0, Math.PI)
    .fill({ color, alpha });
};

/**
 * Draws the fire on top of what's in `g`: smoke behind, then flames from the outer red to the white-hot core
 * (`size` scales the flames, e.g. up for the small figure in the game).
 */
export const drawBurning = (g: Graphics, points: readonly Vec2[], timeMs: number, intensity: number, size = 1): void => {
  const flames = burnFlames(points, timeMs, intensity, size);
  if (flames.length === 0) {
    return;
  }
  const top = points.reduce((highest, point) => (point.y < highest.y ? point : highest), points[0]);
  burnSmoke(top, timeMs, intensity, size).forEach(({ center, radius, alpha }) => g.circle(center.x, center.y, radius).fill({ color: SMOKE_COLOR, alpha }));
  const alpha = Math.min(1, intensity * 1.5);
  // Translucent outer flames so the figure shows through; the hot cores are solid.
  const LAYER_ALPHA = [0.55, 0.7, 0.9, 1];
  BURN_COLORS.forEach((color, layer) => {
    const scale = 1 - layer * 0.24;
    flames.forEach((flame) => drawTongue(g, flame, scale, color, alpha * LAYER_ALPHA[layer]));
  });
};
