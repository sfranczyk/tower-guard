import type { ProjectileType } from '../types';

/**
 * The quiver: which arrow sits in each of the weapon slots (keys 1–5), picked on the battle setup's
 * Quiver page. Each type at most once; a slot may stay empty, but never all of them. Pure data + validation.
 */

export const LOADOUT_SLOTS = 5;

/** Arrows the player can carry (shrapnel fragments only come from a burst). */
export type ArrowType = Exclude<ProjectileType, 'fragment'>;
export const ARROW_TYPES: readonly ArrowType[] = ['normal', 'explosive', 'piercing', 'shrapnel', 'pinning', 'fire', 'frost', 'vortex'];

export const ARROW_INFO: Readonly<Record<ArrowType, { name: string; summary: string }>> = {
  normal: { name: 'Normal arrow', summary: 'Reliable damage' },
  explosive: { name: 'Explosive bolt', summary: 'Heavy, short high arc, area damage' },
  piercing: { name: 'Piercing arrow', summary: 'Light and fast, passes through enemies' },
  shrapnel: { name: 'Shrapnel arrow', summary: 'Space in flight bursts it into three' },
  pinning: { name: 'Pinning arrow', summary: 'Pins an enemy to the ground for 20 s' },
  fire: { name: 'Fire arrow', summary: 'Weak hit; sets enemies alight, the fire spreads' },
  frost: { name: 'Frost arrow', summary: 'Weak hit; slows, a second hit or a headshot freezes' },
  vortex: { name: 'Vortex arrow', summary: 'No damage; a vortex lifts enemies and throws them' },
};

/** `null` is an empty slot. */
export type Loadout = (ArrowType | null)[];

export const DEFAULT_LOADOUT: readonly ArrowType[] = ARROW_TYPES.slice(0, LOADOUT_SLOTS);

export const isArrowType = (value: unknown): value is ArrowType => ARROW_TYPES.includes(value as ArrowType);

/** LOADOUT_SLOTS slots of known arrows, each type once (a repeat is emptied); an empty quiver gets the default. */
export const normalizeLoadout = (input: unknown): Loadout => {
  if (!Array.isArray(input)) {
    return [...DEFAULT_LOADOUT];
  }
  const seen = new Set<ArrowType>();
  const loadout = Array.from({ length: LOADOUT_SLOTS }, (_, index): ArrowType | null => {
    const value: unknown = input[index];
    if (!isArrowType(value) || seen.has(value)) {
      return null;
    }
    seen.add(value);
    return value;
  });
  return seen.size > 0 ? loadout : [...DEFAULT_LOADOUT];
};

/** Puts `type` in `slot`; if it sat in another slot, that slot gets whatever `slot` held (a swap). */
export const placeArrow = (loadout: readonly (ArrowType | null)[], slot: number, type: ArrowType): Loadout => {
  const next = [...loadout];
  const from = next.indexOf(type);
  if (from >= 0) {
    next[from] = next[slot];
  }
  next[slot] = type;
  return next;
};

/** Empties `slot`, unless it's the last arrow left. */
export const clearSlot = (loadout: readonly (ArrowType | null)[], slot: number): Loadout =>
  arrowCount(loadout) > 1 ? loadout.map((type, index) => (index === slot ? null : type)) : [...loadout];

export const arrowCount = (loadout: readonly (ArrowType | null)[]): number => loadout.filter((type) => type !== null).length;

/** The arrow nocked at the start of a wave: the first filled slot. */
export const firstArrow = (loadout: readonly (ArrowType | null)[]): ArrowType =>
  loadout.find((type): type is ArrowType => type !== null) ?? DEFAULT_LOADOUT[0];
