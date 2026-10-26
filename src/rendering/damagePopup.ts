import type { HitInfo } from '../objects/enemy/enemyTypes';

/** How a damage number looks `ageMs` into its life: risen this far (px), this opaque, at this scale. */
export interface DamagePopupFrame {
  rise: number;
  alpha: number;
  scale: number;
}

/** It pops in this much bigger and settles over this share of its life; it fades over the last `FADE` share. */
const POP = { scale: 1.35, share: 0.15 };
const FADE = 0.4;

/** Arrow hits get a number; burning and fall damage tick on their own, so they don't. */
export const showsDamageNumber = (cause: HitInfo['cause'] | undefined): boolean => cause !== 'burn' && cause !== 'fall';

/**
 * A blow that kills outright (a bomb going off, shattering, unhorsing: Number.MAX_SAFE_INTEGER, maybe × stone skin) shows
 * the `health` it took, not its size; any other hit shows its damage (overkill too).
 */
export const shownDamage = (amount: number, health: number): number => (amount >= Number.MAX_SAFE_INTEGER / 1000 ? health : amount);

/** The number shown: whole points, at least 1 for any real hit; nothing for none. */
export const damageLabel = (amount: number): string | undefined => (amount > 0 ? String(Math.max(1, Math.round(amount))) : undefined);

/** Rises quickly then slows (ease-out), pops in and settles, then fades out. */
export const damagePopupFrame = (ageMs: number, lifeMs: number, rise: number): DamagePopupFrame => {
  const t = Math.max(0, Math.min(1, ageMs / Math.max(1, lifeMs)));
  const scale = t < POP.share ? POP.scale - (POP.scale - 1) * (t / POP.share) : 1;
  const alpha = t < 1 - FADE ? 1 : (1 - t) / FADE;
  return { rise: rise * (1 - (1 - t) ** 2), alpha, scale };
};

/** A popup's box in the popup layer: centre x, width, and its top and bottom y. */
export interface PopupBox {
  x: number;
  width: number;
  top: number;
  bottom: number;
}

/**
 * Where a new popup `width` × `height` spawned at (`x`, `bottom`) goes so it doesn't cover the ones on screen: lifted
 * above each it would overlap, `gap` px clear, until it overlaps none (its bottom y). Newer popups rise faster than older
 * ones (ease-out), so a popup put above another moves away from it.
 */
export const stackedPopupBottom = (x: number, bottom: number, width: number, height: number, others: readonly PopupBox[], gap: number): number => {
  const beside = others.filter((other) => Math.abs(other.x - x) < (other.width + width) / 2);
  let y = bottom;
  for (let moved = true; moved;) {
    moved = false;
    for (const other of beside) {
      if (other.bottom > y - height - gap && other.top < y + gap) {
        y = other.top - gap;
        moved = true;
      }
    }
  }
  return y;
};
