import { describe, expect, it } from 'vitest';
import { compactOrder, firstFreeSeat, hasGaps, seatCount } from './seats';

describe('co-op seats', () => {
  it('gives a new guest the lowest free seat, none when the room is full', () => {
    expect(firstFreeSeat([true], 4)).toBe(1);
    expect(firstFreeSeat([true, true, false, true], 4)).toBe(2);
    expect(firstFreeSeat([true, true, true, true], 4)).toBeUndefined();
  });

  it('counts bowmen up to the last taken seat', () => {
    expect(seatCount([true])).toBe(1);
    expect(seatCount([true, false, true])).toBe(3);
    expect(seatCount([true, true, false, false])).toBe(2);
  });

  it('closes the gaps in order, the host staying first', () => {
    expect(compactOrder([true, false, true, true])).toEqual([0, 2, 3]);
    expect(hasGaps([true, false, true])).toBe(true);
    expect(hasGaps([true, true, false])).toBe(false);
  });
});
