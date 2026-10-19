import { describe, expect, it } from 'vitest';
import { DEFAULT_LOADOUT, LOADOUT_SLOTS, clearSlot, firstArrow, normalizeLoadout, placeArrow } from './loadout';

describe('loadout', () => {
  it('fills missing, unknown and repeated arrows with empty slots', () => {
    expect(normalizeLoadout(['piercing', 'fragment', 'piercing', 'nope'])).toEqual(['piercing', null, null]);
    expect(normalizeLoadout(undefined)).toEqual(DEFAULT_LOADOUT);
    expect(normalizeLoadout([null, null])).toEqual(DEFAULT_LOADOUT);
    expect(normalizeLoadout(['normal', 'explosive', 'piercing', 'shrapnel', 'pinning', 'normal'])).toHaveLength(LOADOUT_SLOTS);
  });

  it('places an arrow, swapping it with the one it displaces', () => {
    expect(placeArrow(['normal', 'explosive', null], 0, 'explosive')).toEqual(['explosive', 'normal', null]);
    expect(placeArrow(['normal', null, null], 1, 'pinning')).toEqual(['normal', 'pinning', null]);
    expect(placeArrow(['normal', null, null], 2, 'normal')).toEqual([null, null, 'normal']);
  });

  it('never empties the last arrow and starts with the first filled slot', () => {
    expect(clearSlot([null, 'shrapnel', null], 1)).toEqual([null, 'shrapnel', null]);
    expect(clearSlot(['normal', 'shrapnel', null], 0)).toEqual([null, 'shrapnel', null]);
    expect(firstArrow([null, 'pinning', 'normal'])).toBe('pinning');
  });
});
