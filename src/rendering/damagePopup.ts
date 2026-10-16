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
