import { describe, expect, it } from 'vitest';
import { KEEP_COLLAPSE_MS, collapseDust, collapseFrame, collapseStones, heapOutline } from './keepCollapse';

describe('keep collapse', () => {
  it('stands whole at first, then sinks faster and faster under its rubble', () => {
    expect(collapseFrame(0, 1)).toMatchObject({ standing: 1, lean: 0, heap: 0, done: false });
    const standing = [0.2, 0.4, 0.6].map((share) => collapseFrame(share * KEEP_COLLAPSE_MS, 1).standing);
    expect(standing).toEqual([...standing].sort((a, b) => b - a));
    expect(standing[0] - standing[1]).toBeLessThan(standing[1] - standing[2]);
    const end = collapseFrame(KEEP_COLLAPSE_MS, 1);
    expect(end.done).toBe(true);
    expect(end.heap).toBe(1);
    expect(end.shake).toBe(0);
  });

  it('leans the way it falls', () => {
    expect(collapseFrame(KEEP_COLLAPSE_MS * 0.6, 1).lean).toBeGreaterThan(0);
    expect(collapseFrame(KEEP_COLLAPSE_MS * 0.6, -1).lean).toBeLessThan(0);
  });

  it('lands every stone on the ground and keeps it there, the same for one seed', () => {
    const stones = collapseStones(KEEP_COLLAPSE_MS * 2, 5, 1);
    expect(stones.length).toBeGreaterThan(10);
    stones.forEach((stone) => {
      expect(stone.landed).toBe(true);
      expect(stone.y).toBeCloseTo(404 - stone.size * 0.5);
    });
    expect(collapseStones(KEEP_COLLAPSE_MS * 3, 5, 1)).toEqual(stones);
    expect(collapseStones(0, 5, 1)).toEqual([]);
  });

  it('rolls out dust that settles once it is over', () => {
    expect(collapseDust(KEEP_COLLAPSE_MS * 0.5, 3).length).toBeGreaterThan(0);
    expect(collapseDust(KEEP_COLLAPSE_MS * 2, 3)).toEqual([]);
  });

  it('raises a heap that is flat at first and stands on the ground', () => {
    const flat = heapOutline(0, 1);
    expect(flat.filter((_, index) => index % 2 === 1).every((y) => y === 404)).toBe(true);
    const heap = heapOutline(1, 1);
    expect(Math.min(...heap.filter((_, index) => index % 2 === 1))).toBeLessThan(360);
  });
});
