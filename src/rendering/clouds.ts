import type { Weather } from '../data/battlegrounds';
import { createRandom } from '../utils/math';

/**
 * Cloud shapes and their layout in the sky, as plain data (no Pixi) so they can be tested.
 * - cumulus: long, fairly flat heap of domes on a flat base, shaded underneath and lit on top;
 * - stratus: long flat band of overlapping ellipses;
 * - cirrus: thin, high, slanted wisps (drawn fainter);
 * - storm: huge, dark, low-hanging cloud with a heavy shadowed base (storm weather only).
 */
export type CloudKind = 'cumulus' | 'stratus' | 'cirrus' | 'storm';

/** Shadow is drawn first, then the body, then the highlight on top. */
export type CloudLayer = 'shadow' | 'body' | 'highlight';

export interface CloudBlob {
  layer: CloudLayer;
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** Blobs in local space: x centred on 0, the cloud's base at y ≈ 0 and its top at −height. */
export interface CloudShape {
  kind: CloudKind;
  width: number;
  height: number;
  blobs: CloudBlob[];
}

export interface CloudPlacement {
  shape: CloudShape;
  x: number;
  /** Base of the cloud. */
  y: number;
  /** Drift to the right in px/s; higher clouds drift slower. */
  speed: number;
  /** Opacity relative to the battleground's cloud alpha. */
  alpha: number;
}

type Random = () => number;
const between = (random: Random, min: number, max: number): number => min + random() * (max - min);

const cumulus = (random: Random, width: number): CloudShape => {
  // Long and fairly flat.
  const height = width * between(random, 0.3, 0.38);
  const blobs: CloudBlob[] = [];
  const domes = 6 + Math.floor(random() * 3);
  for (let index = 0; index < domes; index += 1) {
    const t = index / (domes - 1);
    const radius = height * (0.32 + 0.38 * Math.sin(Math.PI * t)) * between(random, 0.88, 1.08);
    const x = (t - 0.5) * width * 0.72;
    const y = -radius * 0.62;
    blobs.push({ layer: 'body', x, y, rx: radius, ry: radius });
  }
  // One soft sunlit patch over the upper-left of the dome (per-dome highlights read as bubbles).
  blobs.push({ layer: 'highlight', x: -width * 0.08, y: -height * 0.62, rx: width * 0.24, ry: height * 0.3 });
  blobs.push({ layer: 'body', x: 0, y: -height * 0.08, rx: width * 0.48, ry: height * 0.2 });
  blobs.unshift({ layer: 'shadow', x: 0, y: 0, rx: width * 0.47, ry: height * 0.2 });
  return { kind: 'cumulus', width, height, blobs };
};

const stratus = (random: Random, width: number): CloudShape => {
  const height = between(random, 18, 26);
  const blobs: CloudBlob[] = [{ layer: 'shadow', x: 0, y: 0, rx: width * 0.46, ry: height * 0.28 }];
  const pieces = 6 + Math.floor(random() * 3);
  for (let index = 0; index < pieces; index += 1) {
    const t = index / (pieces - 1);
    blobs.push({
      layer: 'body',
      x: (t - 0.5) * width * 0.7 + between(random, -8, 8),
      y: -height * between(random, 0.35, 0.6),
      rx: width * between(random, 0.12, 0.2),
      ry: height * between(random, 0.35, 0.55),
    });
  }
  return { kind: 'stratus', width, height, blobs };
};

const cirrus = (random: Random, width: number): CloudShape => {
  const streaks = 3 + Math.floor(random() * 3);
  const blobs: CloudBlob[] = [];
  for (let index = 0; index < streaks; index += 1) {
    const t = streaks === 1 ? 0.5 : index / (streaks - 1);
    blobs.push({
      layer: 'body',
      x: (t - 0.5) * width * 0.45 + between(random, -10, 10),
      // Rising to the right, like wind-combed ice crystals.
      y: -4 - t * 18 + between(random, -2, 2),
      rx: width * between(random, 0.2, 0.3),
      ry: between(random, 2.2, 4),
    });
  }
  return { kind: 'cirrus', width, height: 26, blobs };
};

const storm = (random: Random, width: number): CloudShape => {
  const height = width * between(random, 0.34, 0.42);
  const blobs: CloudBlob[] = [];
  const domes = 7 + Math.floor(random() * 3);
  for (let index = 0; index < domes; index += 1) {
    const t = index / (domes - 1);
    const radius = height * (0.34 + 0.32 * Math.sin(Math.PI * t)) * between(random, 0.85, 1.12);
    blobs.push({ layer: 'body', x: (t - 0.5) * width * 0.76, y: -height * 0.3 - radius * 0.55, rx: radius, ry: radius * 0.9 });
  }
  // Wide, heavy, dark underside: most of the cloud reads as shadow.
  blobs.unshift(
    { layer: 'shadow', x: 0, y: -height * 0.12, rx: width * 0.49, ry: height * 0.3 },
    { layer: 'shadow', x: width * 0.18, y: -height * 0.02, rx: width * 0.26, ry: height * 0.2 },
    { layer: 'shadow', x: -width * 0.2, y: -height * 0.04, rx: width * 0.24, ry: height * 0.18 },
  );
  // No sunlit highlight: there's no sun above a storm deck.
  return { kind: 'storm', width, height, blobs };
};

const BUILDERS: Record<CloudKind, (random: Random, width: number) => CloudShape> = { cumulus, stratus, cirrus, storm };

type KindSettings = { width: [number, number]; y: [number, number]; speed: [number, number]; alpha: number; count: number };

/** Per weather: size range, height band (base y), drift speed (px/s), alpha and count of each kind. */
const SKIES: Record<Weather, Partial<Record<CloudKind, KindSettings>>> = {
  fair: {
    cirrus: { width: [190, 290], y: [48, 85], speed: [8, 12], alpha: 0.55, count: 2 },
    stratus: { width: [260, 380], y: [115, 160], speed: [16, 22], alpha: 0.8, count: 2 },
    cumulus: { width: [200, 300], y: [175, 225], speed: [32, 42], alpha: 1, count: 3 },
  },
  clear: {},
  // A low, nearly closed deck of storm clouds with a few ragged bands under it.
  storm: {
    storm: { width: [330, 470], y: [105, 150], speed: [6, 11], alpha: 1, count: 6 },
    stratus: { width: [280, 400], y: [165, 200], speed: [14, 20], alpha: 0.7, count: 2 },
  },
};

export const createCloudShape = (kind: CloudKind, width: number, seed: number): CloudShape =>
  BUILDERS[kind](createRandom(seed), width);

/**
 * A sky's worth of clouds for the weather, spread evenly over the world width (with jitter) in a
 * shuffled order of kinds. The same seed always gives the same sky; a clear sky has none.
 */
export const layoutClouds = (worldWidth: number, seed: number, weather: Weather = 'fair'): CloudPlacement[] => {
  const random = createRandom(seed);
  const sky = SKIES[weather];
  const kinds = (Object.keys(sky) as CloudKind[]).flatMap((kind) => Array<CloudKind>(sky[kind]?.count ?? 0).fill(kind));
  if (kinds.length === 0) {
    return [];
  }
  for (let index = kinds.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [kinds[index], kinds[swap]] = [kinds[swap], kinds[index]];
  }
  const slot = worldWidth / kinds.length;
  return kinds.map((kind, index) => {
    const settings = sky[kind] as KindSettings;
    const shape = createCloudShape(kind, between(random, ...settings.width), Math.floor(random() * 1e9));
    return {
      shape,
      x: slot * (index + 0.5) + between(random, -slot * 0.35, slot * 0.35),
      y: between(random, ...settings.y),
      speed: between(random, ...settings.speed),
      alpha: settings.alpha,
    };
  });
};

/** Blends two 0xRRGGBB colours (t = 0 → a, 1 → b). */
export const mixColor = (a: number, b: number, t: number): number => {
  const channel = (shift: number): number => {
    const from = (a >> shift) & 0xff;
    const to = (b >> shift) & 0xff;
    return Math.round(from + (to - from) * t) << shift;
  };
  return channel(16) | channel(8) | channel(0);
};
