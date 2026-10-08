import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';

/**
 * How the frost arrow's chill and freeze look on a body: frost glints on a chilled one, a block of ice around a
 * frozen one; the violet glow of one a vortex arrow holds up, and the ring of wind round a dragon it hit. (Burning uses rendering/burning.ts.) Drawn in the
 * figure's container space.
 */

/** Tints for the body: a cold blue while chilled, paler and icier while frozen. */
export const CHILL_TINT = 0xb9dcff;
export const FROZEN_TINT = 0x9fd2ff;
/** Glowing violet while a vortex arrow holds it up. */
export const LEVITATE_TINT = 0xd9bdff;

const ICE = { fill: 0xcfeeff, edge: 0xffffff, shade: 0x7fb8e6 };

/** Deterministic 0..1 noise. */
const noise = (index: number, salt: number): number => {
  const value = Math.sin(index * 78.233 + salt * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

/** Little frost glints twinkling at the body points (chilled). */
export const drawFrostGlints = (g: Graphics, points: readonly Vec2[], timeMs: number, size: number): void => {
  points.forEach((point, index) => {
    const twinkle = 0.5 + 0.5 * Math.sin(timeMs / (220 + 90 * noise(index, 1)) + index * 2.1);
    if (twinkle < 0.35) {
      return;
    }
    const x = point.x + (noise(index, 2) - 0.5) * 10 * size;
    const y = point.y + (noise(index, 3) - 0.5) * 8 * size;
    const arm = (2 + 2.5 * twinkle) * size;
    g.moveTo(x - arm, y).lineTo(x + arm, y).moveTo(x, y - arm).lineTo(x, y + arm)
      .stroke({ width: 1.2 * size, color: 0xffffff, alpha: 0.85 * twinkle, cap: 'round' });
    g.circle(x, y, 1.4 * size).fill({ color: 0xe8f6ff, alpha: twinkle });
  });
};

/**
 * A block of ice around a frozen body (the box around its points, padded): faceted, translucent so the figure
 * shows through, with a bright edge, a few cracks and a glint sweeping over it.
 */
export const drawIceBlock = (g: Graphics, points: readonly Vec2[], timeMs: number, size: number, intensity = 1): void => {
  if (points.length === 0 || intensity <= 0) {
    return;
  }
  const pad = 9 * size;
  const left = Math.min(...points.map((p) => p.x)) - pad;
  const right = Math.max(...points.map((p) => p.x)) + pad;
  const top = Math.min(...points.map((p) => p.y)) - pad;
  const bottom = Math.max(...points.map((p) => p.y)) + 2 * size;
  const width = right - left;
  const height = bottom - top;
  // Uneven facets: a few corners knocked off.
  const outline = [
    { x: left + width * 0.12, y: top }, { x: left + width * 0.7, y: top - height * 0.03 }, { x: right, y: top + height * 0.14 },
    { x: right + width * 0.04, y: top + height * 0.62 }, { x: right - width * 0.06, y: bottom }, { x: left + width * 0.08, y: bottom },
    { x: left - width * 0.05, y: top + height * 0.55 }, { x: left, y: top + height * 0.12 },
  ];
  g.poly(outline.flatMap((p) => [p.x, p.y])).fill({ color: ICE.fill, alpha: 0.42 * intensity });
  g.poly(outline.flatMap((p) => [p.x, p.y])).stroke({ width: 1.6 * size, color: ICE.edge, alpha: 0.8 * intensity, join: 'round' });
  // The shaded right face.
  g.poly([outline[2], outline[3], outline[4], { x: right - width * 0.22, y: bottom - height * 0.08 }, { x: right - width * 0.14, y: top + height * 0.2 }]
    .flatMap((p) => [p.x, p.y])).fill({ color: ICE.shade, alpha: 0.22 * intensity });
  // Cracks.
  g.moveTo(left + width * 0.3, top + height * 0.2).lineTo(left + width * 0.42, top + height * 0.38).lineTo(left + width * 0.36, top + height * 0.52)
    .moveTo(left + width * 0.62, bottom - height * 0.1).lineTo(left + width * 0.7, bottom - height * 0.3)
    .stroke({ width: 1 * size, color: ICE.edge, alpha: 0.6 * intensity });
  // A glint sliding down the front every couple of seconds.
  const sweep = (timeMs % 2400) / 2400;
  if (sweep < 0.5) {
    const y = top + height * (sweep * 2);
    g.moveTo(left + width * 0.15, y).lineTo(left + width * 0.45, y - height * 0.12)
      .stroke({ width: 3 * size, color: 0xffffff, alpha: 0.35 * intensity * Math.sin(sweep * 2 * Math.PI), cap: 'round' });
  }
};

/**
 * Levitating (hit by a vortex arrow): a violet glow round the body, pulsing, with motes of light circling it and
 * drifting down.
 */
export const drawArcaneAura = (g: Graphics, points: readonly Vec2[], timeMs: number, size: number): void => {
  if (points.length === 0) {
    return;
  }
  const centre = {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
  const pulse = 0.8 + 0.2 * Math.sin(timeMs / 180);
  g.circle(centre.x, centre.y, 130 * size * pulse).fill({ color: 0x7a4fc0, alpha: 0.18 });
  g.circle(centre.x, centre.y, 95 * size * pulse).fill({ color: 0xa47ae8, alpha: 0.22 });
  g.circle(centre.x, centre.y, 65 * size * pulse).fill({ color: 0xd9c2ff, alpha: 0.25 });
  points.forEach((point) => g.circle(point.x, point.y, 22 * size * pulse).fill({ color: 0xc9a8ff, alpha: 0.22 }));
  for (let index = 0; index < 9; index += 1) {
    const angle = timeMs / 380 + (index / 9) * Math.PI * 2;
    const drift = ((timeMs / 900 + index * 0.37) % 1);
    const x = centre.x + Math.cos(angle) * 85 * size;
    const y = centre.y + Math.sin(angle) * 45 * size + drift * 70 * size;
    g.circle(x, y, (3 - drift * 1.6) * size * 2.5).fill({ color: index % 2 ? 0xf1e6ff : 0xc9a8ff, alpha: 0.95 * (1 - drift) });
  }
};

/**
 * A ring of wind swirling round a dragon a vortex arrow hit: three tilted, flattened rings of streaks going round
 * it at different speeds, with motes caught in them. `size` scales the strokes, `strength` 0..1 fades it in and out.
 */
export const drawAirVortex = (g: Graphics, points: readonly Vec2[], timeMs: number, size: number, strength: number): void => {
  if (points.length === 0 || strength <= 0) {
    return;
  }
  const centre = {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
  const radius = Math.max(...points.map((point) => Math.hypot(point.x - centre.x, point.y - centre.y))) * 1.15;
  const colors = [0x5a3592, 0x8a5cd8, 0xd9c2ff];
  [0, 1, 2].forEach((ring) => {
    const rx = radius * (0.9 + ring * 0.12);
    const ry = rx * 0.36;
    const tilt = -0.35 + ring * 0.35;
    const spin = (timeMs / (260 + ring * 90)) * (ring % 2 === 0 ? 1 : -1) + ring * 2.1;
    const at = (angle: number): Vec2 => {
      const x = Math.cos(angle) * rx;
      const y = Math.sin(angle) * ry;
      return { x: centre.x + x * Math.cos(tilt) - y * Math.sin(tilt), y: centre.y + x * Math.sin(tilt) + y * Math.cos(tilt) };
    };
    // Two streaks per ring, each a long tapering arc.
    [0, Math.PI].forEach((offset) => {
      const steps = 14;
      for (let index = 0; index < steps; index += 1) {
        const from = at(spin + offset + (index / steps) * Math.PI * 0.8);
        const to = at(spin + offset + ((index + 1) / steps) * Math.PI * 0.8);
        const fade = index / steps;
        g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({
          width: (2 + 6 * fade) * size, color: colors[ring], alpha: 0.9 * fade * strength, cap: 'round',
        });
      }
    });
    for (let mote = 0; mote < 3; mote += 1) {
      const point = at(spin * 1.3 + mote * 2.2);
      g.circle(point.x, point.y, 4 * size).fill({ color: 0xf1e6ff, alpha: 0.9 * strength });
    }
  });
};
