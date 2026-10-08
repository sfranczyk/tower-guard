import type { Graphics } from 'pixi.js';
import { VORTEX_MS } from '../config';
import { vortexStrength } from '../systems/vortex';
import type { Vec2 } from '../types';

/**
 * The vortex arrow's vortex, seen from the side (pure geometry, tested; `drawVortex` draws it): a glowing ring
 * on the ground, a funnel of spiral arms rising from it and debris circling inwards. It winds up, holds and in
 * its last FADE_MS dies away: it spins out wider and thinner and fades.
 */

/** Its last this many ms: the funnel dies away. */
export const FADE_MS = 420;
const ARMS = 4;
const ARM_POINTS = 22;
const COLORS = { glow: 0x7a4fc0, arm: [0x4b2a86, 0x8a5cd8, 0xc9a8ff, 0xf1e6ff], mote: [0x6b4a2e, 0x8a7a5a, 0xc9a8ff] } as const;

/** How much of the vortex is left at `ageMs`: 1 until it starts to die away, then down to 0 at the end. */
export const vortexFade = (ageMs: number): number => Math.max(0, Math.min(1, (VORTEX_MS - ageMs) / FADE_MS));

/** Size of the whole vortex at `ageMs`: grows as it winds up and spreads out a little as it dies away. */
export const vortexScale = (ageMs: number): number =>
  vortexFade(ageMs) <= 0 ? 0 : Math.min(vortexStrength(ageMs) * 1.2, 1) * (1 + 0.12 * (1 - vortexFade(ageMs)));

/**
 * Spiral arms at `ageMs` around `ground` (the centre on the ground): each arm winds up from the rim to the top of
 * the funnel, wider at the top, turning with time. The ellipse is flattened (we see it from the side).
 */
export const vortexArms = (ground: Vec2, ageMs: number, radius: number, height: number): Vec2[][] => {
  const scale = vortexScale(ageMs);
  const spin = ageMs / 140;
  return Array.from({ length: ARMS }, (_, arm) => Array.from({ length: ARM_POINTS }, (_, index) => {
    const t = index / (ARM_POINTS - 1);
    const angle = spin + (arm / ARMS) * Math.PI * 2 + t * Math.PI * 3;
    // Narrow at the bottom, flaring out towards the top.
    const ring = radius * scale * (0.18 + 0.82 * t * t);
    return { x: ground.x + Math.cos(angle) * ring * 0.55, y: ground.y - t * height * scale + Math.sin(angle) * ring * 0.16 };
  }));
};

/** Debris circling inwards: each mote spirals from the rim to the centre and starts again. */
export const vortexMotes = (ground: Vec2, ageMs: number, radius: number, height: number, count = 18): Array<Vec2 & { size: number; tone: number }> => {
  const scale = vortexScale(ageMs);
  return Array.from({ length: count }, (_, index) => {
    const seed = (index * 0.61803) % 1;
    const life = ((ageMs / 1100 + seed) % 1);
    const angle = ageMs / (90 + 40 * seed) + index * 2.4;
    const ring = radius * scale * (1 - life) * (0.6 + 0.4 * seed);
    return {
      x: ground.x + Math.cos(angle) * ring * 0.6,
      y: ground.y - life * height * scale * (0.4 + 0.6 * seed) + Math.sin(angle) * ring * 0.15,
      size: (1.4 + 2 * seed) * (0.6 + 0.4 * scale),
      tone: index % COLORS.mote.length,
    };
  });
};

export const drawVortex = (g: Graphics, ground: Vec2, ageMs: number, radius: number, height: number): void => {
  g.clear();
  const scale = vortexScale(ageMs);
  if (scale <= 0) {
    return;
  }
  g.alpha = vortexFade(ageMs) ** 1.5;
  const pulse = 0.85 + 0.15 * Math.sin(ageMs / 120);
  // Glow on the ground.
  g.ellipse(ground.x, ground.y, radius * 0.6 * scale, 9 * scale).fill({ color: COLORS.glow, alpha: 0.22 * pulse });
  g.ellipse(ground.x, ground.y, radius * 0.3 * scale, 5 * scale).fill({ color: 0xc9a8ff, alpha: 0.3 * pulse });
  // The funnel: dark wide strokes under bright thin ones.
  vortexArms(ground, ageMs, radius, height).forEach((arm, armIndex) => {
    COLORS.arm.forEach((color, layer) => {
      const width = (7 - layer * 1.8) * scale;
      g.moveTo(arm[0].x, arm[0].y);
      arm.slice(1).forEach((point) => g.lineTo(point.x, point.y));
      g.stroke({ width: Math.max(0.6, width), color, alpha: (0.35 + layer * 0.15) * (armIndex % 2 === 0 ? 1 : 0.75), cap: 'round', join: 'round' });
    });
  });
  vortexMotes(ground, ageMs, radius, height).forEach(({ x, y, size, tone }) => g.circle(x, y, size).fill({ color: COLORS.mote[tone], alpha: 0.85 }));
};
