import { describe, expect, it } from 'vitest';
import { MEADOW_TREES } from '../config';
import { meadowTreeAt, type MeadowTreeId } from './meadowTrees';

describe('meadowTreeAt', () => {
  const slots = Array.from({ length: 400 }, (_, index) => index - 50);
  const row = slots.map(meadowTreeAt);

  it('is the same every time', () => {
    expect(slots.map(meadowTreeAt)).toEqual(row);
  });

  it('uses every design, the current tree most', () => {
    const counts = new Map<MeadowTreeId, number>();
    row.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    expect([...counts.keys()].sort()).toEqual(Object.keys(MEADOW_TREES).sort());
    const most = Math.max(...counts.values());
    expect(counts.get('current')).toBe(most);
  });

  it('never repeats a variant next to itself', () => {
    row.slice(1).forEach((id, index) => {
      if (id !== 'current') {
        expect(row[index]).not.toBe(id);
      }
    });
  });
});
