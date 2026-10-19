import { describe, expect, it } from 'vitest';
import { AURORA_CURTAINS, auroraColumn } from './aurora';

describe('aurora', () => {
  const curtain = AURORA_CURTAINS[0];

  it('fades out at both ends of a curtain', () => {
    expect(auroraColumn(curtain, 0, 3).glow).toBeCloseTo(0);
    expect(auroraColumn(curtain, 1, 3).glow).toBeCloseTo(0);
    expect(auroraColumn(curtain, 0.5, 3).glow).toBeGreaterThan(0.4);
  });

  it('keeps rays and glow within range at any time', () => {
    for (let seconds = 0; seconds < 60; seconds += 1.7) {
      for (let u = 0; u <= 1; u += 0.05) {
        const column = auroraColumn(curtain, u, seconds);
        expect(column.height).toBeGreaterThanOrEqual(0);
        expect(column.height).toBeLessThanOrEqual(1);
        expect(column.glow).toBeLessThanOrEqual(1);
        expect(Math.abs(column.foot)).toBeLessThanOrEqual(25);
      }
    }
  });

  it('waves over time', () => {
    expect(auroraColumn(curtain, 0.4, 0).foot).not.toBeCloseTo(auroraColumn(curtain, 0.4, 2).foot);
  });
});
