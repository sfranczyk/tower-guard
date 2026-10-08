import { describe, expect, it } from 'vitest';
import { DEFAULT_LOADOUT, LOADOUT_SLOTS, clearSlot, firstArrow, normalizeLoadout, placeArrow } from './loadout';

describe('loadout', () => {
  it('fills missing, unknown and repeated arrows with empty slots', () => {
    expect(normalizeLoadout(['piercing', 'fragment', 'piercing', 'nope'])).toEqual(['piercing', null, null, null, null]);
    expect(normalizeLoadout(undefined)).toEqual(DEFAULT_LOADOUT);
    expect(normalizeLoadout([null, null])).toEqual(DEFAULT_LOADOUT);
    expect(normalizeLoadout(['normal', 'explosive', 'piercing', 'shrapnel', 'pinning', 'normal'])).toHaveLength(LOADOUT_SLOTS);
  });

  it('places an arrow, swapping it with the one it displaces', () => {
    expect(placeArrow(['normal', 'explosive', null, null, null], 0, 'explosive')).toEqual(['explosive', 'normal', null, null, null]);
    expect(placeArrow(['normal', null, null, null, null], 3, 'pinning')).toEqual(['normal', null, null, 'pinning', null]);
    expect(placeArrow(['normal', null, null, null, null], 4, 'normal')).toEqual([null, null, null, null, 'normal']);
  });

  it('never empties the last arrow and starts with the first filled slot', () => {
    expect(clearSlot([null, 'shrapnel', null, null, null], 1)).toEqual([null, 'shrapnel', null, null, null]);
    expect(clearSlot(['normal', 'shrapnel', null, null, null], 0)).toEqual([null, 'shrapnel', null, null, null]);
    expect(firstArrow([null, null, 'pinning', 'normal', null])).toBe('pinning');
  });
});
