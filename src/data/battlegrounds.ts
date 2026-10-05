/**
 * Battlegrounds: the look of the field a wave is fought on (sky, sun, hills, trees, ground) and its
 * weather. Pure data; rendering/Background.ts draws them and systems/WeatherSystem.ts adds lightning.
 */

export type BattlegroundId = 'greenMeadow' | 'crimsonPass' | 'sunscorchDunes' | 'thunderRidge';

/** fair: drifting clouds; clear: cloudless sky; storm: dark storm clouds with lightning. */
export type Weather = 'fair' | 'clear' | 'storm';

export interface Battleground {
  id: BattlegroundId;
  name: string;
  /** Sky colours from the top down (drawn as horizontal bands). */
  sky: readonly number[];
  /** Omitted when it's hidden (storm). */
  sun?: { x: number; y: number; radius: number; color: number };
  weather: Weather;
  cloudColor: number;
  cloudAlpha: number;
  /** Far and near hill colours; dunes are lower and smoother than hills. */
  hills: readonly [number, number];
  hillShape: 'hills' | 'dunes';
  trees: { style: 'round' | 'pine' | 'cactus'; colors: readonly [number, number, number]; trunk: number };
  ground: { fill: number; edge: number; tufts: number };
}

export const BATTLEGROUNDS: Readonly<Record<BattlegroundId, Battleground>> = {
  greenMeadow: {
    id: 'greenMeadow',
    name: 'Green Meadow',
    sky: [0x80b8d1],
    sun: { x: 790, y: 105, radius: 68, color: 0xf8dc9b },
    weather: 'fair',
    cloudColor: 0xf7fbf5,
    cloudAlpha: 0.88,
    hills: [0x587d85, 0x3f6965],
    hillShape: 'hills',
    trees: { style: 'round', colors: [0x2d594f, 0x35695a, 0x264e4b], trunk: 0x584d42 },
    ground: { fill: 0x79a866, edge: 0xc7e094, tufts: 0x679452 },
  },
  crimsonPass: {
    id: 'crimsonPass',
    name: 'Crimson Pass',
    // Sunset: deep violet at the top fading to warm orange at the horizon.
    sky: [0x3b2a52, 0x5e3456, 0x8e4152, 0xc65c45, 0xe8894a],
    sun: { x: 620, y: 300, radius: 58, color: 0xffb35c },
    weather: 'fair',
    cloudColor: 0xf3a27a,
    cloudAlpha: 0.72,
    hills: [0x6e2f3a, 0x4a2230],
    hillShape: 'hills',
    trees: { style: 'pine', colors: [0x26182a, 0x2e1d31, 0x1e1322], trunk: 0x2a1a1f },
    ground: { fill: 0x9a6a43, edge: 0xc99a5b, tufts: 0x7c5233 },
  },
  sunscorchDunes: {
    id: 'sunscorchDunes',
    name: 'Sunscorch Dunes',
    // Hot, hazy desert sky: pale blue at the top bleaching to sandy haze at the horizon.
    sky: [0x7fb6d4, 0x9cc6d6, 0xbdd3cc, 0xdcd8b4, 0xeed9a2],
    sun: { x: 300, y: 92, radius: 60, color: 0xfff3c4 },
    weather: 'clear',
    cloudColor: 0xffffff,
    cloudAlpha: 0,
    hills: [0xd8b479, 0xc89c5c],
    hillShape: 'dunes',
    trees: { style: 'cactus', colors: [0x5b8a4c, 0x6f9e5c, 0x47703c], trunk: 0x47703c },
    ground: { fill: 0xe2c286, edge: 0xf2dba3, tufts: 0xc4a066 },
  },
  thunderRidge: {
    id: 'thunderRidge',
    name: 'Thunder Ridge',
    // Storm: no sun, slate sky under heavy clouds; lightning strikes now and then.
    sky: [0x1b222d, 0x232c39, 0x2c3645, 0x364252],
    weather: 'storm',
    cloudColor: 0x4b5464,
    cloudAlpha: 0.96,
    hills: [0x2e3a44, 0x232e38],
    hillShape: 'hills',
    trees: { style: 'pine', colors: [0x1a2928, 0x213130, 0x152221], trunk: 0x2a2420 },
    ground: { fill: 0x4d5e45, edge: 0x6d7f5e, tufts: 0x3c4b36 },
  },
};

export const BATTLEGROUND_IDS = Object.keys(BATTLEGROUNDS) as BattlegroundId[];
export const DEFAULT_BATTLEGROUND: BattlegroundId = 'greenMeadow';
