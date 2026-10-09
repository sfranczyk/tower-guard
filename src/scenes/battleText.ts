import type { ProjectileType } from '../types';

/** The status line's text for a battle: arrow descriptions, weapon slot keys and the wind. */

export const DEFAULT_STATUS = 'Drag from the bowman and release to fire';

export const PROJECTILE_LABELS: Record<ProjectileType, string> = {
  normal: 'Normal arrow · reliable damage',
  explosive: 'Explosive bolt · heavy, short high arc, area damage on impact',
  piercing: 'Piercing arrow · light and fast, flat and long, passes through enemies',
  shrapnel: 'Shrapnel arrow · press Space in flight to burst it into three small arrows',
  pinning: 'Pinning arrow · barely hurts, but pins an enemy to the ground for 10 s (zombies 15 s; not brutes or dragons)',
  fire: 'Fire arrow · sets an enemy alight (the fire spreads to those next to it); in the ground it leaves a fire',
  frost: 'Frost arrow · slows an enemy; a second hit or a headshot freezes it solid, and a frozen one shatters',
  vortex: 'Vortex arrow · where it lands a vortex pulls enemies together, then bursts and throws them down',
  fragment: 'Shrapnel fragment',
};

/** Weapon slot keys: Digit1 picks the first slot of the quiver, and so on. */
export const slotOfKey = (code: string): number => (/^Digit[1-9]$/.test(code) ? Number(code.slice(5)) - 1 : -1);

/** Status text for the wind: arrows for its direction, one to three by strength. */
export const windLabel = (wind: number, strongest: number): string => {
  const strength = Math.max(1, Math.min(3, Math.ceil((Math.abs(wind) / Math.max(1, strongest)) * 3)));
  const arrows = (wind < 0 ? '←' : '→').repeat(strength);
  return `wind ${arrows} ${['light', 'moderate', 'strong'][strength - 1]}`;
};
