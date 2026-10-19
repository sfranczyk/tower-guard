import { describe, expect, it } from 'vitest';
import { SURVIVAL } from '../config';
import { ECLIPSE_CLEAR, nearestValley, nightSky } from './nightCycle';

describe('night cycle', () => {
  it('starts in full night with the moon up and the sun hidden', () => {
    const sky = nightSky(0);
    expect(sky.moon.visible).toBe(true);
    expect(sky.moon.height).toBeGreaterThan(0.5);
    expect(sky.stars).toBe(1);
    expect(sky.dawn).toBe(0);
    expect(sky.day).toBe(0);
    expect(sky.shade).toBe(1);
    expect(sky.hillsLight).toBe(0);
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
    expect(sky.hillsLight).toBe(1);
    expect(sky.sunRise).toBe(1);
    expect(nightSky(2)).toEqual(sky);
  });
});

describe('storms and eclipses on the same timeline', () => {
  it('rages until dawn and is over by sunrise', () => {
    expect(nightSky(SURVIVAL.dawnAt - 0.01).calm).toBe(0);
    expect(nightSky(0.9).calm).toBeGreaterThan(0);
    expect(nightSky(1).calm).toBe(1);
  });

  it('starts as a total eclipse and ends with the sun clear', () => {
    expect(nightSky(0).eclipse).toBe(0);
    expect(nightSky(0).corona).toBe(1);
    // Never more than a crescent before dawn.
    expect(nightSky(SURVIVAL.dawnAt - 0.01).eclipse).toBeLessThan(ECLIPSE_CLEAR * 0.4);
    expect(nightSky(1).eclipse).toBeCloseTo(ECLIPSE_CLEAR);
    expect(nightSky(1).corona).toBe(0);
    expect(nightSky(1).eclipseMoon).toBe(0);
  });
});

describe('nearestValley', () => {
  const valleys = [300, 650];
  it('finds the closest valley in a plain stretch', () => {
    expect(nearestValley(420, valleys, 1200)).toBe(300);
    expect(nearestValley(600, valleys, 1200)).toBe(650);
  });

  it('mirrors every other stretch', () => {
    // Stretch 1 (1200..2400) is mirrored: its valleys sit at 2400 − 300 and 2400 − 650.
    expect(nearestValley(2050, valleys, 1200)).toBe(2100);
    expect(nearestValley(1700, valleys, 1200)).toBe(1750);
    expect(nearestValley(-350, valleys, 1200)).toBe(-300);
  });
});
