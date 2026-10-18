import type { Graphics } from 'pixi.js';
import type { BannerSide } from '../../systems/banners';
import { BANNER_EMBLEM, ENEMY_BANNER, PLAYER_BANNER } from '../keep';

/**
 * Banner proposals (design lab, tab Banners): five shapes of a keep's battle banner, all in the keep's colours
 * (rendering/keep.ts: blue ours, red theirs, gold emblem). Each draws with the pole's foot at `at` (y down), standing
 * up, the cloth flying towards +x (`flip` −1: towards −x); `wave` (seconds) ripples the cloth. The game draws
 * `BANNER_STYLE` (rendering/banner.ts).
 */

export interface BannerAt {
  x: number;
  y: number;
  flip: number;
}

export interface BannerStyle {
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** `strength`: how stiffly the breeze holds it out (1, default) … 0 limp; styles that hang anyway ignore it. */
  draw(g: Graphics, side: BannerSide, wave: number, at: BannerAt, strength?: number): void;
}

/** Pole height (px) of every style: what carriers and markers place it by. */
export const BANNER_POLE = 64;

const WOOD = [0x8a6238, 0x6b4a2e] as const;
const GOLD_DARK = 0xb8892f;

export const bannerColors = (side: BannerSide): readonly [number, number] => (side === 'player' ? PLAYER_BANNER : ENEMY_BANNER);

/** Maps points given relative to the pole's foot (x towards the cloth) into `g`. */
const mapper = (at: BannerAt) => (points: number[]): number[] =>
  points.map((value, index) => (index % 2 === 0 ? at.x + value * at.flip : at.y + value));

const pole = (g: Graphics, at: BannerAt, height = BANNER_POLE): void => {
  const pts = mapper(at);
  g.poly(pts([-1.5, -height, 1.5, -height, 1.5, 0, -1.5, 0])).fill({ color: WOOD[0] });
  g.poly(pts([0.5, -height, 1.5, -height, 1.5, 0, 0.5, 0])).fill({ color: WOOD[1] });
};

const lozenge = (g: Graphics, at: BannerAt, x: number, y: number, size: number): void => {
  g.poly(mapper(at)([x, y - size, x + size * 0.78, y, x, y + size, x - size * 0.78, y])).fill({ color: BANNER_EMBLEM });
};

/** Today's: a swallow-tailed flag at the top of the pole, gilt knob. */
const swallowtail: BannerStyle['draw'] = (g, side, wave, at) => {
  const [cloth, shade] = bannerColors(side);
  const pts = mapper(at);
  pole(g, at);
  g.circle(at.x, at.y - BANNER_POLE - 2, 2.6).fill({ color: BANNER_EMBLEM });
  const top = -BANNER_POLE + 2;
  const w = 26;
  const h = 18;
  const ripple = Math.sin(wave * 5) * 1.6;
  const tail = Math.sin(wave * 5 + 1.2) * 2.2;
  g.poly(pts([1.5, top, w * 0.55, top + ripple * 0.5, w, top + ripple, w - 7, top + h * 0.5 + tail * 0.5, w, top + h + tail, w * 0.55, top + h + ripple * 0.5, 1.5, top + h]))
    .fill({ color: cloth });
  g.poly(pts([1.5, top + h - 4, w * 0.55, top + h - 4 + ripple * 0.4, w * 0.55, top + h + ripple * 0.5, 1.5, top + h])).fill({ color: shade, alpha: 0.7 });
  lozenge(g, at, 10, top + h * 0.45, 4.5);
};

/** A gonfalon: a crossbar at the top and a long cloth hanging from it, cut into three points. */
const gonfalon: BannerStyle['draw'] = (g, side, wave, at) => {
  const [cloth, shade] = bannerColors(side);
  const pts = mapper(at);
  pole(g, at, BANNER_POLE + 4);
  const top = -BANNER_POLE + 2;
  const sway = Math.sin(wave * 3) * 1.4;
  g.poly(pts([-2, top - 2, 24, top - 2, 24, top + 1, -2, top + 1])).fill({ color: WOOD[1] });
  g.circle(at.x + 25 * at.flip, at.y + top - 0.5, 1.8).fill({ color: BANNER_EMBLEM });
  g.circle(at.x, at.y - BANNER_POLE - 6, 2.4).fill({ color: BANNER_EMBLEM });
  const bottom = top + 30;
  g.poly(pts([1, top + 1, 22, top + 1, 22 + sway, bottom - 4, 18 + sway, bottom + 2, 15 + sway, bottom - 4, 11.5 + sway, bottom + 3, 8 + sway, bottom - 4, 5 + sway, bottom + 2, 1 + sway, bottom - 4]))
    .fill({ color: cloth });
  g.poly(pts([1, top + 1, 22, top + 1, 22, top + 5, 1, top + 5])).fill({ color: shade });
  lozenge(g, at, 11.5 + sway * 0.5, top + 15, 5);
};

/**
 * A pennon: a long tapering streamer from the pole's top, with a gold stripe, snaking in the wind. In a weak breeze
 * (`strength` → 0) it curls down along the pole, the tip first.
 */
const pennon: BannerStyle['draw'] = (g, side, wave, at, strength = 1) => {
  const [cloth, shade] = bannerColors(side);
  const pts = mapper(at);
  pole(g, at);
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

/** A square standard: a stiff square flag with a gold border band and a gold cross, a fringe along the fly. */
const standard: BannerStyle['draw'] = (g, side, wave, at) => {
  const [cloth, shade] = bannerColors(side);
  const pts = mapper(at);
  pole(g, at);
  g.circle(at.x, at.y - BANNER_POLE - 2, 2.8).fill({ color: BANNER_EMBLEM });
  const top = -BANNER_POLE + 2;
  const s = 20;
  const lift = Math.sin(wave * 4) * 1.2;
  g.poly(pts([1.5, top, 1.5 + s, top + lift, 1.5 + s, top + s + lift, 1.5, top + s])).fill({ color: BANNER_EMBLEM });
  g.poly(pts([3.5, top + 2, s - 0.5, top + 2 + lift, s - 0.5, top + s - 2 + lift, 3.5, top + s - 2])).fill({ color: cloth });
  const mid = 1.5 + s / 2;
  g.poly(pts([mid - 1.5, top + 2 + lift / 2, mid + 1.5, top + 2 + lift / 2, mid + 1.5, top + s - 2 + lift / 2, mid - 1.5, top + s - 2 + lift / 2])).fill({ color: BANNER_EMBLEM });
  g.poly(pts([3.5, top + s / 2 - 1.5 + lift / 2, s - 0.5, top + s / 2 - 1.5 + lift, s - 0.5, top + s / 2 + 1.5 + lift, 3.5, top + s / 2 + 1.5 + lift / 2])).fill({ color: BANNER_EMBLEM });
  g.poly(pts([3.5, top + s - 6, mid - 1.5, top + s - 6 + lift / 4, mid - 1.5, top + s - 2 + lift / 4, 3.5, top + s - 2])).fill({ color: shade, alpha: 0.6 });
  for (let i = 0; i < 5; i += 1) {
    const y = top + 2 + i * 4 + lift;
    g.poly(pts([1.5 + s, y, 1.5 + s + 3, y + 1, 1.5 + s, y + 2])).fill({ color: GOLD_DARK });
  }
};

/** A vexillum: a crossbar near the top, a small square cloth hanging with a gold fringe, a gold sun disc above. */
const vexillum: BannerStyle['draw'] = (g, side, wave, at) => {
  const [cloth, shade] = bannerColors(side);
  const pts = mapper(at);
  pole(g, at, BANNER_POLE + 6);
  const top = -BANNER_POLE + 6;
  const sway = Math.sin(wave * 2.5) * 1;
  // The sun disc with rays.
  const cx = at.x;
  const cy = at.y - BANNER_POLE - 4;
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    g.poly([cx + Math.cos(a) * 3, cy + Math.sin(a) * 3, cx + Math.cos(a + 0.2) * 7, cy + Math.sin(a + 0.2) * 7, cx + Math.cos(a - 0.2) * 7, cy + Math.sin(a - 0.2) * 7])
      .fill({ color: BANNER_EMBLEM });
  }
  g.circle(cx, cy, 4).fill({ color: BANNER_EMBLEM });
  g.circle(cx, cy, 2).fill({ color: GOLD_DARK });
  g.poly(pts([-12, top - 1.5, 12, top - 1.5, 12, top + 1.5, -12, top + 1.5])).fill({ color: WOOD[1] });
  const w = 11;
  const bottom = top + 22;
  g.poly(pts([-w, top + 1.5, w, top + 1.5, w + sway, bottom, -w + sway, bottom])).fill({ color: cloth });
  g.poly(pts([-w, top + 1.5, w, top + 1.5, w, top + 4.5, -w, top + 4.5])).fill({ color: shade });
  lozenge(g, at, sway * 0.5, top + 12, 5);
  for (let i = 0; i < 6; i += 1) {
    const x = -w + 1.5 + i * ((2 * w - 3) / 5) + sway;
    g.poly(pts([x - 1.2, bottom, x + 1.2, bottom, x, bottom + 4])).fill({ color: BANNER_EMBLEM });
  }
};

export const BANNER_STYLES: readonly BannerStyle[] = [
  {
    id: 'swallowtail', name: 'Swallowtail', tagline: 'Today\'s: a forked flag at the top',
    description: 'The banner in the game now: an ash pole with a gilt knob and a swallow-tailed cloth flying from the top, a gold lozenge on it, its tail rippling.',
    draw: swallowtail,
  },
  {
    id: 'gonfalon', name: 'Gonfalon', tagline: 'Hung from a crossbar, three points',
    description: 'A church-and-city banner: a crossbar at the top of the pole with gold knobs, the cloth hanging straight down from it and cut into three points, the lozenge in the middle; it sways rather than flies, so it reads well even when its carrier stands still.',
    draw: gonfalon,
  },
  {
    id: 'pennon', name: 'Pennon', tagline: 'A long streamer from a spear',
    description: 'A knight\'s pennon: a steel spearhead on the pole and a long tapering streamer in the keep\'s colour with a gold stripe, snaking in the wind. The lightest of them, most visible in motion.',
    draw: pennon,
  },
  {
    id: 'standard', name: 'Square standard', tagline: 'Stiff square, gold border and cross',
    description: 'A square standard held stiff from the pole: a gold border band round the keep\'s colour, a gold cross through it and a gold fringe along the fly. Heraldic and easy to tell apart at a glance.',
    draw: standard,
  },
  {
    id: 'vexillum', name: 'Vexillum', tagline: 'Roman: crossbar, fringe and a sun on top',
    description: 'An old army standard: a small square cloth hanging from a crossbar below the top, a row of gold tassels along its foot and a gold sun disc on the pole\'s tip. Compact, and the sun shows above a crowd.',
    draw: vexillum,
  },
];
