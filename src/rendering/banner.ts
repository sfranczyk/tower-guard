import type { Graphics } from 'pixi.js';
import type { BannerSide } from '../systems/banners';
import { BANNER_STYLES, type BannerAt } from './designs/bannerDesigns';

export { BANNER_POLE, bannerColors } from './designs/bannerDesigns';

/** The banner style the game draws (design lab tab Banners: rendering/designs/bannerDesigns.ts). */
export const BANNER_STYLE = 'swallowtail';

/**
 * A keep's battle banner (the run's Banners option): `BANNER_STYLE` in the keep's colours, the pole's foot at `at`,
 * standing up, the cloth towards +x (`flip` −1: −x); `wave` (seconds) ripples it.
 */
export const drawBanner = (g: Graphics, side: BannerSide, wave = 0, at: BannerAt = { x: 0, y: 0, flip: 1 }, clear = true): void => {
  if (clear) {
    g.clear();
  }
  (BANNER_STYLES.find((style) => style.id === BANNER_STYLE) ?? BANNER_STYLES[0]).draw(g, side, wave, at);
};
