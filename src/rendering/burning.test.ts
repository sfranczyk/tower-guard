import { describe, expect, it } from 'vitest';
import { STANDING_BURN_POINTS, burnFlames, burnSmoke } from './burning';

describe('burnFlames', () => {
  it('licks up from every body point, always upwards', () => {
    const flames = burnFlames(STANDING_BURN_POINTS, 500, 1);
    expect(flames.length).toBe(STANDING_BURN_POINTS.length);
    flames.forEach(({ base, tip, width }) => {
      expect(tip.y).toBeLessThan(base.y);
      expect(width).toBeGreaterThan(0);
    });
  });

  it('flickers over time and is the same for the same moment', () => {
    expect(burnFlames(STANDING_BURN_POINTS, 500, 1)).toEqual(burnFlames(STANDING_BURN_POINTS, 500, 1));
    const a = burnFlames(STANDING_BURN_POINTS, 500, 1)[0];
    const b = burnFlames(STANDING_BURN_POINTS, 620, 1)[0];
    expect(Math.abs(a.tip.y - b.tip.y) + Math.abs(a.tip.x - b.tip.x)).toBeGreaterThan(0.5);
  });

  it('shrinks as it burns out, and is gone at zero', () => {
    const height = (intensity: number) => burnFlames(STANDING_BURN_POINTS, 500, intensity)
      .reduce((sum, { base, tip }) => sum + base.y - tip.y, 0);
    expect(height(0.3)).toBeLessThan(height(1));
    expect(burnFlames(STANDING_BURN_POINTS, 500, 0)).toHaveLength(0);
  });
});

describe('burnSmoke', () => {
  it('rises above the head and fades as it climbs', () => {
    const top = { x: 0, y: -52 };
    const puffs = burnSmoke(top, 700, 1);
    puffs.forEach(({ center }) => expect(center.y).toBeLessThan(top.y));
    const sorted = [...puffs].sort((a, b) => b.center.y - a.center.y);
    expect(sorted[sorted.length - 1].alpha).toBeLessThan(sorted[0].alpha);
  });
});
