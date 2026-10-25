import { SURVIVAL } from '../config';

/**
 * The night of a survival level on a `nightCycle` map (pure, tested): where the moon and the sun are and how far dawn
 * has come at `progress` (0 = the level starts, 1 = its time is up). The moon is up at nightfall and crosses the sky,
 * setting at SURVIVAL.moonSetAt; dawn starts at SURVIVAL.dawnAt (stars fade, the sky warms, then turns to day) and the
 * sun's disc clears the horizon exactly at 1. The same timeline drives the other survival skies: the storm or the
 * sandstorm dies down with `calm`, and an eclipse's moon crosses the sun (`eclipse`). rendering/NightSky.ts draws it.
 */
export interface NightSkyState {
  /** Across the view (0 left .. 1 right) and above the horizon (0 on it .. 1 at the top); hidden once set. */
  moon: { x: number; height: number; visible: boolean };
  stars: number;
  /** Weights of the dawn and day skies laid over the night sky (0..1). */
  dawn: number;
  day: number;
  /** Strength of the night shade over the hills (1 = full night). */
  shade: number;
  /** How far the hills have turned to their day colours (0 night .. 1 day). */
  hillsLight: number;
  /** -1: a radius below the horizon (hidden), 0: centred on it, 1: the whole disc above it. */
  sunRise: number;
  /** How far a storm or sandstorm has died down (0 raging .. 1 over). */
  calm: number;
  /**
   * Eclipse maps: the moon's offset from the sun's centre in sun radii along its path, positive on the side it comes
   * from, negative on the side it leaves to (±eclipseClear(): just touching, 0: centred).
   */
  eclipse: number;
  /** Eclipse maps: how bright the corona glows around the covered sun (1 total .. 0). */
  corona: number;
  /** Eclipse maps: the diamond ring, the last (or first) bead of sun flaring on the rim just outside totality (0..1). */
  diamond: number;
}

/**
 * The moon's radius in sun radii: crossing the sun at an even pace over the whole level, it covers it all for
 * SURVIVAL.eclipseTotal of the time, (r - 1) / (r + 1) (0.06: 1.13).
 */
export const eclipseMoonRadius = (totalShare = SURVIVAL.eclipseTotal): number => {
  const total = Math.max(0, Math.min(0.5, totalShare));
  return (1 + total) / (1 - total);
};

/** The moon's offset from the sun (sun radii) at which it just touches it. */
export const eclipseClear = (): number => 1 + eclipseMoonRadius();

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
export const smoothstep = (from: number, to: number, value: number): number => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

/** Where the sun rises across the view (east, over the enemy's side). */
export const SUN_X = 0.72;

/**
 * The valley nearest `x` in the hills' own coordinates: `valleys` lie within one `tileWidth` stretch, repeated across
 * the scenery with every other copy mirrored (rendering/Background.ts tiledHills).
 */
export const nearestValley = (x: number, valleys: readonly number[], tileWidth: number): number => {
  const tile = Math.floor(x / tileWidth);
  const candidates = [tile - 1, tile, tile + 1].flatMap((index) => valleys.map((valley) =>
    (Math.abs(index) % 2 === 1 ? (index + 1) * tileWidth - valley : index * tileWidth + valley)));
  return candidates.reduce((best, candidate) => (Math.abs(candidate - x) < Math.abs(best - x) ? candidate : best));
};

/**
 * The sun's crescent as a polygon (sun radius 1, centred on 0, 0) with the moon (radius `r`) at `offset`
 * sun radii in direction `angle`: the sun's rim outside the moon, then back along the moon's rim inside the sun. Empty
 * while the moon covers it all, the whole disc once it's off. The moon itself is never drawn, it only hides the sun.
 */
export const sunCrescent = (offset: number, angle: number, steps = 48, r = eclipseMoonRadius()): number[] => {
  const d = Math.max(0, offset);
  const point = (cx: number, cy: number, radius: number, a: number): number[] => [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
  if (d >= 1 + r) {
    return Array.from({ length: steps }, (_, index) => point(0, 0, 1, (index / steps) * Math.PI * 2)).flat();
  }
  if (d <= r - 1) {
    return [];
  }
  const alpha = Math.acos(Math.max(-1, Math.min(1, (1 + d * d - r * r) / (2 * d))));
  const beta = Math.acos(Math.max(-1, Math.min(1, (r * r + d * d - 1) / (2 * d * r))));
  const mx = d * Math.cos(angle);
  const my = d * Math.sin(angle);
  const points: number[] = [];
  for (let index = 0; index <= steps; index += 1) {
    points.push(...point(0, 0, 1, angle + alpha + (index / steps) * (Math.PI * 2 - 2 * alpha)));
  }
  for (let index = 1; index < steps; index += 1) {
    points.push(...point(mx, my, r, angle + Math.PI + beta - (index / steps) * 2 * beta));
  }
  return points;
};

/** Share of the sun's disc the moon leaves showing at `offset` sun radii (0 total .. 1 clear). */
export const sunShowing = (offset: number, r = eclipseMoonRadius()): number => {
  const d = Math.max(0, offset);
  if (d >= 1 + r) {
    return 1;
  }
  if (d <= r - 1) {
    return 0;
  }
  const lens = r * r * Math.acos((d * d + r * r - 1) / (2 * d * r)) + Math.acos((d * d + 1 - r * r) / (2 * d))
    - 0.5 * Math.sqrt((-d + r + 1) * (d + r - 1) * (d - r + 1) * (d + r + 1));
  return clamp01(1 - lens / Math.PI);
};

/**
 * The outline of sun and moon together (sun radius 1, centred on 0, 0; the moon `offset` sun radii off in direction
 * `angle`): the sun's rim outside the moon, then the moon's rim outside the sun. What the corona never shines over.
 */
export const eclipseOutline = (offset: number, angle: number, steps = 48, r = eclipseMoonRadius()): number[] => {
  const d = Math.max(0, offset);
  const mx = d * Math.cos(angle);
  const my = d * Math.sin(angle);
  const circle = (cx: number, cy: number, radius: number): number[] =>
    Array.from({ length: steps }, (_, index) => [cx + radius * Math.cos((index / steps) * Math.PI * 2), cy + radius * Math.sin((index / steps) * Math.PI * 2)]).flat();
  if (d >= 1 + r) {
    return circle(0, 0, 1);
  }
  if (d <= r - 1) {
    return circle(mx, my, r);
  }
  const alpha = Math.acos(Math.max(-1, Math.min(1, (1 + d * d - r * r) / (2 * d))));
  const beta = Math.acos(Math.max(-1, Math.min(1, (r * r + d * d - 1) / (2 * d * r))));
  const points: number[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const a = angle + alpha + (index / steps) * (Math.PI * 2 - 2 * alpha);
    points.push(Math.cos(a), Math.sin(a));
  }
  for (let index = 1; index < steps; index += 1) {
    const a = angle + Math.PI + beta + (index / steps) * (Math.PI * 2 - 2 * beta);
    points.push(mx + r * Math.cos(a), my + r * Math.sin(a));
  }
  return points;
};

/**
 * How far from the sun's centre (sun radii) sun and moon together reach in direction `direction`, with the moon
 * `offset` sun radii off in direction `angle`: the far edge of the moon where it covers that way, else the sun's rim.
 */
export const eclipseReach = (offset: number, angle: number, direction: number, r = eclipseMoonRadius()): number => {
  const d = Math.max(0, offset);
  const along = d * Math.cos(direction - angle);
  const across = d * Math.sin(direction - angle);
  const inside = r * r - across * across;
  return inside > 0 ? Math.max(1, along + Math.sqrt(inside)) : 1;
};

/** One eclipse at `p` (0 the moon touches the sun .. 1 it has left it): where the moon is and what it leaves lit. */
export interface EclipsePhase {
  /** The moon's offset from the sun's centre (sun radii, NightSkyState.eclipse). */
  eclipse: number;
  corona: number;
  diamond: number;
  /** How much light the sky still gets (0 total .. 1 clear). */
  light: number;
  /** The moon's radius (sun radii), set by `totalShare`. */
  moonRadius: number;
}

/**
 * An eclipse at `p` (0..1 of its time): the moon crosses the sun at an even pace, covering it all for `totalShare` of
 * the time halfway. The light fades only once most of the sun is hidden (a little sun lights a lot of sky) and comes
 * back the same way; the corona shows while it's dark, and the diamond ring flares for `diamondShare` of the time just
 * before and just after the total eclipse. Survival's eclipse maps and MOBA's eclipses (systems/dayCycle.ts) share it.
 */
export const eclipsePhase = (p: number, totalShare = SURVIVAL.eclipseTotal, diamondShare = SURVIVAL.eclipseDiamond): EclipsePhase => {
  const r = eclipseMoonRadius(totalShare);
  const eclipse = (1 + r) * (1 - 2 * p);
  const from = 0.5 - totalShare / 2;
  const to = 0.5 + totalShare / 2;
  const light = sunShowing(Math.abs(eclipse), r) ** 0.45;
  const flare = (t: number): number => (t > 0 && t < 1 ? Math.sin(Math.PI * t) ** 2 : 0);
  return {
    eclipse,
    corona: 1 - smoothstep(0, 0.4, light),
    diamond: Math.max(flare((p - (from - diamondShare)) / diamondShare), flare((p - to) / diamondShare)),
    light,
    moonRadius: r,
  };
};

/** An eclipse map's sky at `progress`: the moon touches the sun as the level starts and leaves it as the time runs out. */
const eclipseSky = (p: number): NightSkyState => {
  const { eclipse, corona, diamond, light } = eclipsePhase(p);
  return {
    moon: { x: 0, height: 0, visible: false },
    stars: 1 - smoothstep(0, 0.35, light),
    dawn: smoothstep(0, 0.45, light),
    day: smoothstep(0.3, 1, light),
    shade: 1 - light,
    hillsLight: light,
    sunRise: 1,
    calm: 0,
    eclipse,
    corona,
    diamond,
  };
};

/** The sky of a survival level at `progress`: a night (moon, dawn, sunrise) or, on eclipse maps, the eclipse. */
export const nightSky = (progress: number, kind: 'night' | 'eclipse' | 'dust' = 'night'): NightSkyState => {
  if (kind === 'eclipse') {
    return eclipseSky(clamp01(progress));
  }
  const p = clamp01(progress);
  const moonT = p / SURVIVAL.moonSetAt;
  // Already up at nightfall (a quarter of its arc), highest a third of the way, on the horizon when it sets.
  const moonHeight = Math.sin(Math.PI * (0.25 + 0.75 * Math.min(1, moonT)));
  const dawnAt = Math.min(0.99, SURVIVAL.dawnAt);
  const dawn = clamp01((p - dawnAt) / (1 - dawnAt));
  return {
    moon: { x: 0.08 + 0.86 * Math.min(1, moonT), height: Math.max(0, moonHeight), visible: moonT < 1 },
    stars: 1 - smoothstep(0, 0.6, dawn),
    dawn: smoothstep(0, 0.55, dawn),
    day: smoothstep(0.45, 1, dawn),
    shade: 1 - smoothstep(0.15, 1, dawn),
    hillsLight: smoothstep(0.15, 1, dawn),
    sunRise: -1 + 2 * smoothstep(0.55, 1, dawn) ** 0.8,
    calm: smoothstep(0.05, 0.85, dawn),
    eclipse: eclipseClear(),
    corona: 0,
    diamond: 0,
  };
};
