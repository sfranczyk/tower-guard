import type { Graphics } from 'pixi.js';
import type { BannerSide } from '../systems/banners';
import { BANNER_EMBLEM, ENEMY_BANNER, PLAYER_BANNER } from './keep';

/**
 * A keep's battle banner (the run's Banners option) in the flat landscape style: an ash pole with a gilt finial and a
 * swallow-tailed cloth in the keep's banner colours (rendering/keep.ts) with its gold emblem. Drawn with the pole's
 * foot at (0, 0), standing up the −y axis; the cloth flies towards +x (scale.x −1 flies it the other way), `wave`
 * (any number, e.g. time in seconds) ripples its tail.
 */
export const BANNER_POLE = 64;
const CLOTH_W = 26;
const CLOTH_H = 18;
const WOOD = [0x8a6238, 0x6b4a2e] as const;

export const bannerColors = (side: BannerSide): readonly [number, number] => (side === 'player' ? PLAYER_BANNER : ENEMY_BANNER);

/** `at`: where the pole's foot goes in `g` (the design lab draws several into one tile); `flip` −1 flies it left. */
export const drawBanner = (g: Graphics, side: BannerSide, wave = 0, at = { x: 0, y: 0, flip: 1 }, clear = true): void => {
  const [cloth, shade] = bannerColors(side);
  const px = (x: number): number => at.x + x * at.flip;
  const pts = (points: number[]): number[] => points.map((value, index) => (index % 2 === 0 ? px(value) : at.y + value));
  if (clear) {
    g.clear();
  }
  g.poly(pts([-1.5, -BANNER_POLE, 1.5, -BANNER_POLE, 1.5, 0, -1.5, 0])).fill({ color: WOOD[0] });
  g.poly(pts([0.5, -BANNER_POLE, 1.5, -BANNER_POLE, 1.5, 0, 0.5, 0])).fill({ color: WOOD[1] });
  g.circle(at.x, at.y - BANNER_POLE - 2, 2.6).fill({ color: BANNER_EMBLEM });
  const top = -BANNER_POLE + 2;
  const ripple = Math.sin(wave * 5) * 1.6;
  const tail = Math.sin(wave * 5 + 1.2) * 2.2;
  g.poly(pts([
    1.5, top,
    CLOTH_W * 0.55, top + ripple * 0.5,
    CLOTH_W, top + ripple,
    CLOTH_W - 7, top + CLOTH_H * 0.5 + tail * 0.5,
    CLOTH_W, top + CLOTH_H + tail,
    CLOTH_W * 0.55, top + CLOTH_H + ripple * 0.5,
    1.5, top + CLOTH_H,
  ])).fill({ color: cloth });
  g.poly(pts([1.5, top + CLOTH_H - 4, CLOTH_W * 0.55, top + CLOTH_H - 4 + ripple * 0.4, CLOTH_W * 0.55, top + CLOTH_H + ripple * 0.5, 1.5, top + CLOTH_H])).fill({ color: shade, alpha: 0.7 });
  // The emblem: a gold lozenge.
  const cy = top + CLOTH_H * 0.45;
  g.poly(pts([10, cy - 4.5, 13.5, cy, 10, cy + 4.5, 6.5, cy])).fill({ color: BANNER_EMBLEM });
};
