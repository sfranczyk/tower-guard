import { SURVIVAL } from '../config';

/**
 * The night of a survival level on a `nightCycle` map (pure, tested): where the moon and the sun are and how far dawn
 * has come at `progress` (0 = the level starts, 1 = its time is up). The moon is up at nightfall and crosses the sky,
 * setting at SURVIVAL.moonSetAt; dawn starts at SURVIVAL.dawnAt (stars fade, the sky warms, then turns to day) and the
 * sun's disc clears the horizon exactly at 1. The same timeline drives the other survival skies: the storm or the
 * sandstorm dies down with `calm`, and an eclipse's moon slides off the sun (`eclipse`). rendering/NightSky.ts draws it.
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
  /** Eclipse maps: the moon's offset from the sun's centre in sun radii (0 total .. ECLIPSE_CLEAR fully off). */
  eclipse: number;
  /** Eclipse maps: how bright the corona glows around the covered sun (1 total .. 0). */
  corona: number;
}

/** The moon's radius in sun radii, and its offset at which it no longer touches the sun. */
export const ECLIPSE_MOON_RADIUS = 1.02;
export const ECLIPSE_CLEAR = 1 + ECLIPSE_MOON_RADIUS;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const smoothstep = (from: number, to: number, value: number): number => {
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
 * The sun's crescent as a polygon (sun radius 1, centred on 0, 0) with the moon (`ECLIPSE_MOON_RADIUS`) at `offset`
 * sun radii in direction `angle`: the sun's rim outside the moon, then back along the moon's rim inside the sun. Empty
 * while the moon covers it all, the whole disc once it's off. The moon itself is never drawn, it only hides the sun.
 */
export const sunCrescent = (offset: number, angle: number, steps = 48): number[] => {
  const r = ECLIPSE_MOON_RADIUS;
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
export const sunShowing = (offset: number): number => {
  const r = ECLIPSE_MOON_RADIUS;
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
 * An eclipse map's sky at `progress`: total until SURVIVAL.eclipseFrom, then the moon slides off the sun, clear by
 * SURVIVAL.eclipseTo. The light comes back fast with the first crescent (a little sun lights a lot of sky), and the
 * corona fades as it does.
 */
const eclipseSky = (p: number): NightSkyState => {
  const eclipse = ECLIPSE_CLEAR * smoothstep(SURVIVAL.eclipseFrom, SURVIVAL.eclipseTo, p);
  const light = sunShowing(eclipse) ** 0.45;
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
    corona: 1 - smoothstep(0, 0.4, light),
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
    eclipse: ECLIPSE_CLEAR,
    corona: 0,
  };
};
