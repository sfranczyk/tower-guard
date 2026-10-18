import { describe, expect, it } from 'vitest';
import { SURVIVAL } from '../config';
import { nightSky } from './nightCycle';

describe('night cycle', () => {
  it('starts in full night with the moon up and the sun hidden', () => {
    const sky = nightSky(0);
    expect(sky.moon.visible).toBe(true);
    expect(sky.moon.height).toBeGreaterThan(0.5);
    expect(sky.stars).toBe(1);
    expect(sky.dawn).toBe(0);
    expect(sky.day).toBe(0);
    expect(sky.shade).toBe(1);
    expect(sky.sunRise).toBe(-1);
  });

  it('moves the moon left to right and sets it before the end', () => {
    const xs = [0, 0.2, 0.4, 0.6, 0.8].map((progress) => nightSky(progress).moon.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(nightSky(SURVIVAL.moonSetAt + 0.01).moon.visible).toBe(false);
  });

  it('keeps the night until dawn, then brightens step by step', () => {
    expect(nightSky(SURVIVAL.dawnAt - 0.01).dawn).toBe(0);
    const steps = [SURVIVAL.dawnAt + 0.05, 0.85, 0.95].map(nightSky);
    steps.reduce((before, after) => {
      expect(after.dawn).toBeGreaterThanOrEqual(before.dawn);
      expect(after.stars).toBeLessThanOrEqual(before.stars);
      expect(after.sunRise).toBeGreaterThanOrEqual(before.sunRise);
      return after;
    });
  });

  it('ends in daylight with the sun just risen', () => {
    const sky = nightSky(1);
    expect(sky.day).toBe(1);
    expect(sky.stars).toBe(0);
    expect(sky.shade).toBe(0);
    expect(sky.sunRise).toBe(1);
    expect(nightSky(2)).toEqual(sky);
  });
});
