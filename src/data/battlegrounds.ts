/**
 * Battlegrounds: the look of the field a wave is fought on (sky, sun, hills, trees, ground).
 * Pure data; rendering/Background.ts draws them.
 */

export type BattlegroundId = 'greenMeadow' | 'crimsonPass';

export interface Battleground {
  id: BattlegroundId;
  name: string;
  /** Sky colours from the top down (drawn as horizontal bands). */
  sky: readonly number[];
  sun: { x: number; y: number; radius: number; color: number };
  cloudColor: number;
  cloudAlpha: number;
  /** Far and near hill colours. */
  hills: readonly [number, number];
  trees: { style: 'round' | 'pine'; colors: readonly [number, number, number]; trunk: number };
  ground: { fill: number; edge: number; tufts: number };
}

export const BATTLEGROUNDS: Readonly<Record<BattlegroundId, Battleground>> = {
  greenMeadow: {
    id: 'greenMeadow',
    name: 'Green Meadow',
    sky: [0x80b8d1],
    sun: { x: 790, y: 105, radius: 68, color: 0xf8dc9b },
    cloudColor: 0xf7fbf5,
    cloudAlpha: 0.88,
    hills: [0x587d85, 0x3f6965],
    trees: { style: 'round', colors: [0x2d594f, 0x35695a, 0x264e4b], trunk: 0x584d42 },
    ground: { fill: 0x79a866, edge: 0xc7e094, tufts: 0x679452 },
  },
  crimsonPass: {
    id: 'crimsonPass',
    name: 'Crimson Pass',
    // Sunset: deep violet at the top fading to warm orange at the horizon.
    sky: [0x3b2a52, 0x5e3456, 0x8e4152, 0xc65c45, 0xe8894a],
    sun: { x: 620, y: 300, radius: 58, color: 0xffb35c },
    cloudColor: 0xf3a27a,
    cloudAlpha: 0.72,
    hills: [0x6e2f3a, 0x4a2230],
    trees: { style: 'pine', colors: [0x26182a, 0x2e1d31, 0x1e1322], trunk: 0x2a1a1f },
    ground: { fill: 0x9a6a43, edge: 0xc99a5b, tufts: 0x7c5233 },
  },
};

export const BATTLEGROUND_IDS = Object.keys(BATTLEGROUNDS) as BattlegroundId[];
export const DEFAULT_BATTLEGROUND: BattlegroundId = 'greenMeadow';
