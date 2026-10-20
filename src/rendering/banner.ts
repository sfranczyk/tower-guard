import type { Graphics } from 'pixi.js';
import type { BannerSide } from '../systems/banners';
import { BANNER_EMBLEM, ENEMY_BANNER, PLAYER_BANNER } from './keep';

/** Where a banner stands: the pole's foot (y down), the cloth flying towards +x (`flip` −1: towards −x). */
export interface BannerSpot {
  x: number;
  y: number;
  flip: number;
}

/** Pole height (px): what carriers and markers place the banner by. */
export const BANNER_POLE = 64;

const WOOD = [0x8a6238, 0x6b4a2e] as const;

export const bannerColors = (side: BannerSide): readonly [number, number] => (side === 'player' ? PLAYER_BANNER : ENEMY_BANNER);

/** Maps points given relative to the pole's foot (x towards the cloth) into `g`. */
const mapper = (at: BannerSpot) => (points: number[]): number[] =>
  points.map((value, index) => (index % 2 === 0 ? at.x + value * at.flip : at.y + value));

/**
 * A keep's battle banner (the run's Banners option), a pennon in the keep's colours: a spear-tipped pole and a long
 * tapering streamer with a gold stripe, snaking in the wind. `wave` (seconds) ripples it; in a weak breeze
 * (`strength` → 0) it curls down along the pole, the tip first.
 */
export const drawBanner = (g: Graphics, side: BannerSide, wave = 0, at: BannerSpot = { x: 0, y: 0, flip: 1 }, clear = true, strength = 1): void => {
  if (clear) {
    g.clear();
  }
  const [cloth, shade] = bannerColors(side);
  const pts = mapper(at);
  g.poly(pts([-1.5, -BANNER_POLE, 1.5, -BANNER_POLE, 1.5, 0, -1.5, 0])).fill({ color: WOOD[0] });
  g.poly(pts([0.5, -BANNER_POLE, 1.5, -BANNER_POLE, 1.5, 0, 0.5, 0])).fill({ color: WOOD[1] });
  // Spearhead tip.
  g.poly(pts([-2, -BANNER_POLE, 2, -BANNER_POLE, 0, -BANNER_POLE - 7])).fill({ color: 0xc9ccd4 });
  const top = -BANNER_POLE + 1;
  const len = 40;
  const steps = 8;
  const flutter = 0.3 + 0.7 * strength;
  const droop = (1 - strength) * 1.45;
  // The centre line from the pole, bending down more towards the tip the weaker the breeze; snaking across it.
  const line: Array<{ x: number; y: number; nx: number; ny: number }> = [];
  let x = 1.5;
  let y = top + 7;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = droop * (0.35 + 0.65 * t);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const snake = Math.sin(wave * 6 - t * 4) * 2.4 * t * flutter;
    line.push({ x: x + nx * snake, y: y + ny * snake, nx, ny });
    x += Math.cos(angle) * (len / steps);
    y += Math.sin(angle) * (len / steps);
  }
  const across = (i: number, offset: number): number[] => [line[i].x + line[i].nx * offset, line[i].y + line[i].ny * offset];
  const half = (t: number): number => 7 * (1 - t) + 0.6;
  const upper = line.flatMap((_, i) => across(i, -half(i / steps)));
  const lower = line.map((_, i) => across(i, half(i / steps))).reverse().flat();
  g.poly(pts([...upper, ...lower])).fill({ color: cloth });
  const stripeEnd = 6;
  const stripeUpper = line.slice(0, stripeEnd + 1).flatMap((_, i) => across(i, -1.2));
  const stripeLower = line.slice(0, stripeEnd + 1).map((_, i) => across(i, 1.2)).reverse().flat();
  g.poly(pts([...stripeUpper, ...stripeLower])).fill({ color: BANNER_EMBLEM });
  g.poly(pts([...across(0, -half(0)), ...across(1, -half(0.125)), ...across(1, half(0.125)), ...across(0, half(0))])).fill({ color: shade });
};
