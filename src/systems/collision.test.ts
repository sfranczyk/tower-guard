import { describe, expect, it } from 'vitest';
import { segmentHitTime } from './collision';

const box = { left: 10, right: 20, top: 10, bottom: 20 };

describe('segmentHitTime', () => {
  it('returns the entry time when the segment crosses the box', () => {
    expect(segmentHitTime({ x: 0, y: 15 }, { x: 40, y: 0 }, box)).toBeCloseTo(0.25);
  });

  it('returns undefined when the segment stops short of the box', () => {
    expect(segmentHitTime({ x: 0, y: 15 }, { x: 5, y: 0 }, box)).toBeUndefined();
  });

  it('returns undefined when the segment passes beside the box', () => {
    expect(segmentHitTime({ x: 0, y: 30 }, { x: 40, y: 0 }, box)).toBeUndefined();
  });

  it('handles a segment parallel to an axis inside the slab', () => {
    expect(segmentHitTime({ x: 15, y: 0 }, { x: 0, y: 40 }, box)).toBeCloseTo(0.25);
  });

  it('returns 0 when the segment starts inside the box', () => {
    expect(segmentHitTime({ x: 15, y: 15 }, { x: 40, y: 40 }, box)).toBe(0);
  });

  it('detects diagonal hits', () => {
    expect(segmentHitTime({ x: 0, y: 0 }, { x: 30, y: 30 }, box)).toBeCloseTo(1 / 3);
  });
});
