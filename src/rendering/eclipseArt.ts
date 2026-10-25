import type { Graphics } from 'pixi.js';
import { eclipseOutline, eclipseReach, sunCrescent, sunShowing } from '../systems/nightCycle';

/**
 * The way the moon crosses the sun (from lower right to upper left: this is the side it leaves to), the corona's
 * streamers and the diamond ring's colour.
 */
const ECLIPSE_ANGLE = Math.atan2(-0.6, -0.8);
const CORONA_STREAMERS = 14;
const DIAMOND_COLOR = 0xfffbf0;
const CORONA_COLOR = 0xfff4e0;

/** What an eclipse looks like now (systems/nightCycle.ts eclipsePhase). */
export interface EclipseLook {
  /** The moon's offset from the sun's centre in sun radii (positive before the total eclipse). */
  offset: number;
  corona: number;
  diamond: number;
  /** The moon's radius in sun radii. */
  moonRadius: number;
}

/**
 * An eclipse round (0, 0) of both graphics (survival's eclipse maps, rendering/NightSky.ts; MOBA, rendering/DaySky.ts):
 * the sun's crescent left by the moon (the moon only hides it, never drawn), its glow growing with it, the corona round
 * the sun fading first on the side the sun shows, and the diamond ring's bead on the rim. `alpha` dims it all (a setting sun).
 */
export const drawEclipse = (crescent: Graphics, corona: Graphics, look: EclipseLook, sunRadius: number, color: number, alpha = 1): void => {
  const { offset, moonRadius: r } = look;
  const showing = sunShowing(Math.abs(offset), r);
  const moonAngle = offset >= 0 ? ECLIPSE_ANGLE + Math.PI : ECLIPSE_ANGLE;
  crescent.clear();
  if (showing > 0) {
    crescent.circle(0, 0, sunRadius * 1.9).fill({ color, alpha: 0.12 * showing * alpha });
    crescent.circle(0, 0, sunRadius * 1.3).fill({ color, alpha: 0.18 * showing * alpha });
  }
  const shape = sunCrescent(Math.abs(offset), moonAngle, 48, r);
  if (shape.length > 0) {
    crescent.poly(shape.map((value) => value * sunRadius)).fill({ color, alpha: 0.95 * alpha });
  }
  if (look.diamond > 0) {
    drawDiamond(crescent, moonAngle + Math.PI, look.diamond * alpha, sunRadius);
  }
  corona.clear();
  const strength = look.corona * alpha;
  if (strength <= 0) {
    return;
  }
  // A ring of pale glow (none over sun or moon, where the sky shows behind the moon) and streamers round it.
  // The outline, seen from the sun's centre, crosses each direction once: pulled in to stay inside each ring's edge.
  const outline = eclipseOutline(Math.abs(offset), moonAngle, 48, r);
  const hole = (radius: number): number[] => outline.flatMap((value, index) => {
    if (index % 2 === 1) {
      return [];
    }
    const scale = Math.min(1, (radius * 0.98) / Math.hypot(value, outline[index + 1])) * sunRadius;
    return [value * scale, outline[index + 1] * scale];
  });
  corona.circle(0, 0, sunRadius * 1.9).fill({ color: CORONA_COLOR, alpha: 0.08 * strength });
  corona.poly(hole(1.9)).cut();
  corona.circle(0, 0, sunRadius * 1.35).fill({ color: CORONA_COLOR, alpha: 0.12 * strength });
  corona.poly(hole(1.35)).cut();
  for (let index = 0; index < CORONA_STREAMERS; index += 1) {
    const angle = (index / CORONA_STREAMERS) * Math.PI * 2 + 0.2 * Math.sin(index * 2.3);
    // 1 on the moon's side, 0 where the sun comes out: that side goes first.
    const side = (1 + Math.cos(angle - moonAngle)) / 2;
    const streamer = 0.22 * Math.max(0, Math.min(1, strength * 2 - (1 - side)));
    if (streamer <= 0.01) {
      continue;
    }
    // From the edge of sun or moon, whichever reaches further that way.
    const base = sunRadius * eclipseReach(Math.abs(offset), moonAngle, angle, r);
    const reach = sunRadius * (index % 2 === 0 ? 2.3 : 1.6);
    if (reach <= base * 1.1) {
      continue;
    }
    corona.poly([
      Math.cos(angle - 0.12) * base, Math.sin(angle - 0.12) * base,
      Math.cos(angle) * reach, Math.sin(angle) * reach,
      Math.cos(angle + 0.12) * base, Math.sin(angle + 0.12) * base,
    ]).fill({ color: CORONA_COLOR, alpha: streamer });
  }
};

/** The diamond ring: a bead of sun on the rim at `angle`, flaring into a glow and four rays, at `strength` (0..1). */
const drawDiamond = (g: Graphics, angle: number, strength: number, sunRadius: number): void => {
  const x = Math.cos(angle) * sunRadius;
  const y = Math.sin(angle) * sunRadius;
  g.circle(x, y, 34).fill({ color: DIAMOND_COLOR, alpha: 0.12 * strength });
  g.circle(x, y, 16).fill({ color: DIAMOND_COLOR, alpha: 0.3 * strength });
  g.circle(x, y, 5.5).fill({ color: DIAMOND_COLOR, alpha: strength });
  for (let index = 0; index < 4; index += 1) {
    const ray = angle + Math.PI / 4 + (index * Math.PI) / 2;
    const reach = (index % 2 === 0 ? 46 : 30) * strength;
    const side = ray + Math.PI / 2;
    g.poly([
      x + Math.cos(side) * 2, y + Math.sin(side) * 2,
      x + Math.cos(ray) * reach, y + Math.sin(ray) * reach,
      x - Math.cos(side) * 2, y - Math.sin(side) * 2,
    ]).fill({ color: DIAMOND_COLOR, alpha: 0.7 * strength });
  }
};
