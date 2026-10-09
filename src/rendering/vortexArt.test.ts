import { describe, expect, it } from 'vitest';
import { VORTEX } from '../config';
import { vortexArms, vortexFade, vortexMotes, vortexScale } from './vortexArt';

describe('vortex art', () => {
  it('winds up, holds and fades away at the end', () => {
    expect(vortexScale(0)).toBe(0);
    expect(vortexScale(VORTEX.ms / 2)).toBe(1);
    expect(vortexFade(VORTEX.ms / 2)).toBe(1);
    expect(vortexScale(VORTEX.ms)).toBe(0);
    expect(vortexFade(VORTEX.ms - 50)).toBeLessThan(0.2);
  });

  it('keeps the funnel and its debris within its size (a little more as it dies away)', () => {
    const ground = { x: 500, y: 400 };
    const radius = 150;
    const height = 120;
    [100, VORTEX.ms / 2, VORTEX.ms - 100].forEach((age) => {
      const points = [...vortexArms(ground, age, radius, height).flat(), ...vortexMotes(ground, age, radius, height)];
      points.forEach((point) => {
        expect(Math.abs(point.x - ground.x)).toBeLessThanOrEqual(radius * 1.12);
        expect(point.y).toBeLessThanOrEqual(ground.y + radius * 0.16);
        expect(point.y).toBeGreaterThanOrEqual(ground.y - height * 1.12 - radius * 0.16);
      });
    });
  });
});
