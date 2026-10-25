import { describe, expect, it } from 'vitest';
import { MOBA_SKY } from '../config';
import { cometAt, cycleMs, dayTitle, daySky, dayTime, eclipseAt, eclipsesUntil, moonLit, moonLitOutline, moonPhase, redSunset, segmentNear, sweptNear } from './dayCycle';

const MINUTE = 60_000;

/** Area of a polygon given as flat x, y pairs. */
const area = (points: number[]): number => {
  let sum = 0;
  for (let index = 0; index < points.length; index += 2) {
    const next = (index + 2) % points.length;
    sum += points[index] * points[next + 1] - points[next] * points[index + 1];
  }
  return Math.abs(sum) / 2;
};

describe('day cycle', () => {
  it('runs 3.5 minutes of day (with 20 s sunrise and sunset) and 2.5 minutes of night', () => {
    expect(cycleMs()).toBe(6 * MINUTE);
    expect(dayTime(0).part).toBe('sunrise');
    expect(dayTime(19_999).part).toBe('sunrise');
    expect(dayTime(20_000).part).toBe('day');
    expect(dayTime(3.5 * MINUTE - 20_001).part).toBe('day');
    expect(dayTime(3.5 * MINUTE - 10_000).part).toBe('sunset');
    expect(dayTime(3.5 * MINUTE).part).toBe('night');
    expect(dayTime(6 * MINUTE)).toMatchObject({ index: 1, part: 'sunrise', at: 0 });
  });

  it('brightens through the sunrise, stays light all day and is dark at night', () => {
    const lights = [0, 5_000, 10_000, 15_000, 20_000].map((time) => daySky(1, time).light);
    expect(lights).toEqual([...lights].sort((a, b) => a - b));
    expect(lights[0]).toBe(0);
    expect(daySky(1, MINUTE).light).toBe(1);
    expect(daySky(1, 4 * MINUTE).light).toBe(0);
    expect(daySky(1, 4 * MINUTE).stars).toBe(1);
    expect(daySky(1, MINUTE).stars).toBe(0);
  });

  it('shows the sunrise sky at sunrise and the sunset sky at sunset only', () => {
    expect(daySky(1, 10_000).dawn).toBeCloseTo(1);
    expect(daySky(1, 10_000).dusk).toBe(0);
    expect(daySky(1, 3.5 * MINUTE - 10_000).dusk).toBeCloseTo(1);
    expect(daySky(1, MINUTE).dawn + daySky(1, MINUTE).dusk).toBe(0);
  });

  it('crosses the sky from right to left: the sun by day, the moon by night', () => {
    const sun = [0, MINUTE, 2 * MINUTE, 3 * MINUTE].map((time) => daySky(1, time).sun);
    expect(sun.every((s) => s.visible)).toBe(true);
    expect(sun.map((s) => s.x)).toEqual([...sun.map((s) => s.x)].sort((a, b) => b - a));
    const night = daySky(1, 4 * MINUTE);
    expect(night.sun.visible).toBe(false);
    expect(night.moon.visible).toBe(true);
    expect(daySky(1, 5.5 * MINUTE).moon.x).toBeLessThan(night.moon.x);
  });

  it('starts at a full moon, is new after 7 days and full again after 14', () => {
    expect(moonPhase(0)).toBe(0);
    expect(moonLit(moonPhase(0))).toBe(1);
    expect(moonLit(moonPhase(7 * cycleMs()))).toBeCloseTo(0);
    expect(moonLit(moonPhase(14 * cycleMs()))).toBeCloseTo(1);
    expect(moonLit(moonPhase(3.5 * cycleMs()))).toBeCloseTo(0.5);
  });

  it('draws the lit part of the moon as big as its phase', () => {
    [0, 0.1, 0.25, 0.4, 0.6, 0.75, 0.9].forEach((phase) => {
      expect(area(moonLitOutline(phase, 64)) / Math.PI).toBeCloseTo(moonLit(phase), 2);
    });
    expect(moonLitOutline(0.5)).toEqual([]);
    // Waning: lit on the left; waxing: on the right.
    const meanX = (points: number[]): number => points.filter((_, index) => index % 2 === 0).reduce((a, b) => a + b, 0);
    expect(meanX(moonLitOutline(0.3))).toBeLessThan(0);
    expect(meanX(moonLitOutline(0.7))).toBeGreaterThan(0);
  });

  it('names each day as it starts, then lets the title go', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map((n) => dayTitle(n).split(' ')[0]))
      .toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
    expect(dayTitle(1)).toBe('1st day of the battle');
    expect(daySky(1, 0)).toMatchObject({ dayNumber: 1, title: 0 });
    expect(daySky(1, cycleMs() + MOBA_SKY.dayTitleMs / 2)).toMatchObject({ dayNumber: 2, title: 0.5 });
    expect(daySky(1, MOBA_SKY.dayTitleMs + 1).title).toBeUndefined();
  });

  it('rolls each sunset red or dark, the same for the same seed', () => {
    const days = Array.from({ length: 40 }, (_, index) => redSunset(7, index));
    expect(days).toEqual(Array.from({ length: 40 }, (_, index) => redSunset(7, index)));
    expect(days.some(Boolean)).toBe(true);
    expect(days.some((red) => !red)).toBe(true);
  });
});

describe('eclipses', () => {
  const seeds = Array.from({ length: 60 }, (_, index) => index * 7919 + 3);

  it('come 5 to 15 minutes apart, only in full daylight, for at most 2 minutes, over by sunset', () => {
    seeds.forEach((seed) => {
      const eclipses = eclipsesUntil(seed, 120 * MINUTE);
      expect(eclipses.length).toBeGreaterThan(3);
      eclipses.forEach((eclipse, index) => {
        const before = index === 0 ? 0 : eclipses[index - 1].start;
        expect(eclipse.start - before).toBeGreaterThanOrEqual(MOBA_SKY.eclipseMinMs);
        expect(dayTime(eclipse.start).part).toBe('day');
        expect(eclipse.end - eclipse.start).toBeLessThanOrEqual(MOBA_SKY.eclipseMs);
        expect(eclipse.end).toBeLessThanOrEqual(dayTime(eclipse.start).start + MOBA_SKY.dayMs);
      });
    });
  });

  it('move one drawn at night to the next day (the gap then grows past 15 minutes at most by a night)', () => {
    const gaps = seeds.flatMap((seed) => eclipsesUntil(seed, 120 * MINUTE).map((eclipse, index, all) => eclipse.start - (index ? all[index - 1].start : 0)));
    expect(Math.max(...gaps)).toBeLessThanOrEqual(MOBA_SKY.eclipseMaxMs + MOBA_SKY.nightMs + 2 * MOBA_SKY.twilightMs);
    expect(gaps.some((gap) => gap > MOBA_SKY.eclipseMaxMs)).toBe(true);
  });

  it('darken the day while the sun is covered, with a corona at totality', () => {
    const eclipse = eclipsesUntil(11, 60 * MINUTE)[0];
    expect(eclipseAt(11, eclipse.start - 1)).toBeUndefined();
    expect(eclipseAt(11, eclipse.start + 1)?.index).toBe(0);
    const middle = eclipse.start + MOBA_SKY.eclipseMs / 2;
    if (middle < eclipse.end) {
      const sky = daySky(11, middle);
      expect(sky.light).toBeLessThan(0.1);
      expect(sky.eclipse?.corona).toBeGreaterThan(0.9);
      expect(sky.stars).toBeGreaterThan(0.5);
    }
    expect(daySky(11, eclipse.end + 1).eclipse).toBeUndefined();
  });

  it('send one comet across the whole field inside the eclipse', () => {
    seeds.forEach((seed) => {
      eclipsesUntil(seed, 60 * MINUTE).forEach((eclipse) => {
        expect(eclipse.comet).toBeGreaterThanOrEqual(eclipse.start);
        if (eclipse.end - eclipse.start >= MOBA_SKY.cometMs) {
          expect(eclipse.comet + MOBA_SKY.cometMs).toBeLessThanOrEqual(eclipse.end + 1e-6);
        }
        const first = cometAt(eclipse, eclipse.comet, 2800)!;
        const last = cometAt(eclipse, eclipse.comet + MOBA_SKY.cometMs, 2800)!;
        expect(Math.min(first.x, last.x)).toBeLessThan(0);
        expect(Math.max(first.x, last.x)).toBeGreaterThan(2800);
        expect(cometAt(eclipse, eclipse.comet - 1, 2800)).toBeUndefined();
        expect(cometAt(eclipse, eclipse.comet + MOBA_SKY.cometMs + 1, 2800)).toBeUndefined();
      });
    });
  });

  it('counts only an arrow passing through the comet', () => {
    expect(segmentNear({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 }, 26)).toBe(true);
    expect(segmentNear({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 30 }, 26)).toBe(false);
    expect(segmentNear({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 140, y: 0 }, 26)).toBe(false);
  });

  it('catches a fast arrow crossing a moving comet between two frames', () => {
    // The arrow jumps from left of the comet's old place to right of its new one, the comet moving towards it.
    expect(sweptNear({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 80, y: 0 }, { x: 60, y: 0 }, 10)).toBe(true);
    // Both at the same pace side by side never meet.
    expect(sweptNear({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 40 }, { x: 100, y: 40 }, 26)).toBe(false);
    // Moving together, the arrow stays inside it.
    expect(sweptNear({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 5, y: 0 }, { x: 105, y: 0 }, 26)).toBe(true);
  });
});
