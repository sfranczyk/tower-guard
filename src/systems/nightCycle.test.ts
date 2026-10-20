import { describe, expect, it } from 'vitest';
import { SURVIVAL } from '../config';
import { ECLIPSE_CLEAR, nearestValley, nightSky, sunCrescent, sunShowing } from './nightCycle';

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
    const steps = [SURVIVAL.dawnAt + 0.05, 0.85, 0.95].map((progress) => nightSky(progress));
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

  it('runs an eclipse from first touch through totality halfway to last touch', () => {
    const start = nightSky(0, 'eclipse');
    expect(start).toMatchObject({ eclipse: ECLIPSE_CLEAR, corona: 0, stars: 0, day: 1, shade: 0, diamond: 0 });
    expect(start.moon.visible).toBe(false);
    const total = nightSky(0.5, 'eclipse');
    expect(total).toMatchObject({ corona: 1, stars: 1, dawn: 0, day: 0, shade: 1, diamond: 0 });
    expect(sunShowing(Math.abs(total.eclipse))).toBe(0);
    expect(sunShowing(Math.abs(nightSky(SURVIVAL.eclipseTotalFrom, 'eclipse').eclipse))).toBe(0);
    expect(sunShowing(Math.abs(nightSky(SURVIVAL.eclipseTotalTo, 'eclipse').eclipse))).toBe(0);
    const end = nightSky(1, 'eclipse');
    expect(end).toMatchObject({ eclipse: -ECLIPSE_CLEAR, corona: 0, stars: 0, day: 1, shade: 0, diamond: 0 });
  });

  it('darkens to the total eclipse and lightens after it, the moon moving one way all along', () => {
    const steps = Array.from({ length: 101 }, (_, index) => nightSky(index / 100, 'eclipse'));
    steps.slice(1).forEach((sky, index) => {
      expect(sky.eclipse).toBeLessThan(steps[index].eclipse);
      if (index < 50) {
        expect(sky.hillsLight).toBeLessThanOrEqual(steps[index].hillsLight);
      } else {
        expect(sky.hillsLight).toBeGreaterThanOrEqual(steps[index].hillsLight);
      }
    });
    // A quarter of the sun showing still lights more than half the sky.
    const quarter = steps.find((sky) => sunShowing(Math.abs(sky.eclipse)) <= 0.25)!;
    expect(quarter.hillsLight).toBeGreaterThan(0.5);
  });

  it('flares the diamond ring just before and just after the total eclipse', () => {
    const width = SURVIVAL.eclipseDiamond;
    expect(nightSky(SURVIVAL.eclipseTotalFrom - width / 2, 'eclipse').diamond).toBeCloseTo(1);
    expect(nightSky(SURVIVAL.eclipseTotalTo + width / 2, 'eclipse').diamond).toBeCloseTo(1);
    expect(nightSky(SURVIVAL.eclipseTotalFrom - width * 1.5, 'eclipse').diamond).toBe(0);
    expect(nightSky(0.5, 'eclipse').diamond).toBe(0);
    expect(nightSky(0.9).diamond).toBe(0);
  });

  it('cuts the sun to a crescent where the moon covers it', () => {
    expect(sunCrescent(0, 0)).toEqual([]);
    expect(sunShowing(0)).toBe(0);
    expect(sunShowing(ECLIPSE_CLEAR)).toBe(1);
    expect(sunShowing(1)).toBeGreaterThan(sunShowing(0.5));
    // Moon to the right: the crescent's points lie on the left, all within the sun.
    const points = sunCrescent(1, 0);
    for (let index = 0; index < points.length; index += 2) {
      expect(Math.hypot(points[index], points[index + 1])).toBeLessThanOrEqual(1 + 1e-9);
      expect(points[index]).toBeLessThan(0.55);
    }
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
