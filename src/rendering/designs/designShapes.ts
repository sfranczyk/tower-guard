import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../../types';

/** Flat shapes the enemy designs are built from (the landscape style: no outlines, darker far side). */

export const add = (a: Vec2, x: number, y: number): Vec2 => ({ x: a.x + x, y: a.y + y });
export const mix = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** A filled polygon through the points. */
export const shape = (g: Graphics, points: readonly Vec2[], color: number, alpha = 1): void => {
  g.poly(points.flatMap((p) => [p.x, p.y])).fill({ color, alpha });
};

/** A rounded limb from a to b, tapering from width wa to wb. */
export const limb = (g: Graphics, a: Vec2, b: Vec2, wa: number, wb: number, color: number, alpha = 1): void => {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / length;
  const ny = (b.x - a.x) / length;
  shape(g, [
    add(a, (nx * wa) / 2, (ny * wa) / 2), add(b, (nx * wb) / 2, (ny * wb) / 2),
    add(b, (-nx * wb) / 2, (-ny * wb) / 2), add(a, (-nx * wa) / 2, (-ny * wa) / 2),
  ], color, alpha);
  g.circle(a.x, a.y, wa / 2).fill({ color, alpha });
  g.circle(b.x, b.y, wb / 2).fill({ color, alpha });
};

/** A foot or boot planted at `foot` (ankle), toes forward. */
export const boot = (g: Graphics, foot: Vec2, length: number, height: number, color: number): void => {
  g.roundRect(foot.x - length * 0.3, foot.y - height * 0.7, length, height, height / 2).fill({ color });
};

/** Points on an ellipse around `center`, rotated by `angle`, each radius scaled by `jitter(i)`. */
export const ellipsePoints = (
  center: Vec2, rx: number, ry: number, count: number, angle = 0, jitter: (i: number) => number = () => 1,
): Vec2[] => Array.from({ length: count }, (_, i) => {
  const a = (i / count) * Math.PI * 2;
  const x = Math.cos(a) * rx * jitter(i);
  const y = Math.sin(a) * ry * jitter(i);
  return { x: center.x + x * Math.cos(angle) - y * Math.sin(angle), y: center.y + x * Math.sin(angle) + y * Math.cos(angle) };
});

/** Repeatable 0..1 noise for a seed, so rocks keep their shape every frame. */
export const hash = (seed: number): number => {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** An irregular rock lying along the bone a → b, shortened by `gap` at both ends. */
export const rockAlong = (g: Graphics, a: Vec2, b: Vec2, width: number, color: number, seed: number, gap = 2): void => {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  shape(g, ellipsePoints(mix(a, b, 0.5), Math.max(2, length / 2 - gap + width * 0.25), width / 2, 7, angle,
    (i) => 0.82 + hash(seed + i) * 0.3), color);
};

/** A soft glow: a few fading circles around a bright core. */
export const glow = (g: Graphics, center: Vec2, radius: number, color: number, strength = 1): void => {
  g.circle(center.x, center.y, radius * 2.4).fill({ color, alpha: 0.12 * strength });
  g.circle(center.x, center.y, radius * 1.6).fill({ color, alpha: 0.25 * strength });
  g.circle(center.x, center.y, radius).fill({ color, alpha: Math.min(1, 0.9 * strength) });
};
