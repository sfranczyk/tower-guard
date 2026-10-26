import { describe, expect, it } from 'vitest';
import { MOBA_SKY } from '../config';
import { cometAt, cycleMs, dayTitle, ordinal, ordinalWord, daySky, dayTime, eclipseAt, eclipsesUntil, moonLit, moonLitOutline, moonPhase, pathX, redSunset, segmentNear, sweptNear } from './dayCycle';

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
  it('runs 2.5 minutes of day (with 20 s sunrise and sunset) and 1.5 minutes of night', () => {
    expect(cycleMs()).toBe(4 * MINUTE);
    expect(dayTime(0).part).toBe('sunrise');
    expect(dayTime(19_999).part).toBe('sunrise');
    expect(dayTime(20_000).part).toBe('day');
    expect(dayTime(2.5 * MINUTE - 20_001).part).toBe('day');
    expect(dayTime(2.5 * MINUTE - 10_000).part).toBe('sunset');
    expect(dayTime(2.5 * MINUTE).part).toBe('night');
    expect(dayTime(4 * MINUTE)).toMatchObject({ index: 1, part: 'sunrise', at: 0 });
  });

  it('brightens through the sunrise, stays light all day and is dark at night', () => {
    const lights = [0, 5_000, 10_000, 15_000, 20_000].map((time) => daySky(1, time).light);
    expect(lights).toEqual([...lights].sort((a, b) => a - b));
    expect(lights[0]).toBeLessThan(0.5);
    expect(daySky(1, MINUTE).light).toBe(1);
    expect(daySky(1, 3 * MINUTE).light).toBe(0);
    expect(daySky(1, 3 * MINUTE).stars).toBe(1);
    expect(daySky(1, MINUTE).stars).toBe(0);
  });

  it('shows the sunrise sky at sunrise and the sunset sky at sunset only', () => {
    const { dayMs, twilightMs, sinkMs } = MOBA_SKY;
    expect(daySky(1, (twilightMs - sinkMs) / 2).dawn).toBeCloseTo(1);
    expect(daySky(1, 10_000).dusk).toBe(0);
    expect(daySky(1, dayMs + (sinkMs - twilightMs) / 2).dusk).toBeCloseTo(1);
    expect(daySky(1, MINUTE).dawn + daySky(1, MINUTE).dusk).toBe(0);
  });

  it('crosses the sky from right to left: the sun by day, the moon by night', () => {
    const sun = [0, 0.7 * MINUTE, 1.4 * MINUTE, 2.1 * MINUTE].map((time) => daySky(1, time).sun);
    expect(sun.every((s) => s.visible)).toBe(true);
    expect(sun.map((s) => s.x)).toEqual([...sun.map((s) => s.x)].sort((a, b) => b - a));
    const night = daySky(1, 2.75 * MINUTE);
    expect(night.sun.visible).toBe(false);
    expect(night.moon.visible).toBe(true);
    expect(daySky(1, 3.75 * MINUTE).moon.x).toBeLessThan(night.moon.x);
  });

  it('lets the sun and moon sink behind the hills for a while past their setting time', () => {
    const { dayMs, sinkMs } = MOBA_SKY;
    const setting = daySky(1, dayMs + sinkMs / 2);
    expect(setting.sun.visible).toBe(true);
    expect(setting.sun.arc).toBeGreaterThan(1);
    expect(daySky(1, dayMs + sinkMs + 1).sun.visible).toBe(false);
    expect(daySky(1, cycleMs() - sinkMs / 2).sun).toMatchObject({ visible: true, x: expect.any(Number) });
    expect(daySky(1, cycleMs() - sinkMs / 2).sun.arc).toBeLessThan(0);
    expect(daySky(1, dayMs - sinkMs / 2).moon.visible).toBe(true);
    expect(daySky(1, cycleMs() + sinkMs / 2).moon).toMatchObject({ visible: true });
    expect(daySky(1, cycleMs() + sinkMs + 1).moon.visible).toBe(false);
  });

  it('shows no stars while the sun is up, then brings them out after sunset', () => {
    const { dayMs, twilightMs, sinkMs, starFadeMs } = MOBA_SKY;
    expect(daySky(1, 1000).stars).toBe(0);
    expect(daySky(1, dayMs - twilightMs / 10).stars).toBe(0);
    expect(daySky(1, dayMs + sinkMs / 2).stars).toBe(0);
    expect(daySky(1, dayMs + sinkMs + starFadeMs / 2).stars).toBeCloseTo(0.5);
    expect(daySky(1, dayMs + sinkMs + starFadeMs).stars).toBe(1);
    expect(daySky(1, cycleMs() - sinkMs).stars).toBe(0);
  });

  it('keeps the sky lit while the sun shows: full night only once it has sunk, dawn as soon as it starts to come up', () => {
    const { dayMs, sinkMs } = MOBA_SKY;
    const sinking = daySky(1, dayMs + sinkMs / 2);
    expect(sinking.sun.visible).toBe(true);
    expect(sinking.light).toBeGreaterThan(0);
    expect(sinking.dusk).toBeGreaterThan(0);
    expect(daySky(1, dayMs + sinkMs).light).toBe(0);
    const coming = daySky(1, cycleMs() - sinkMs / 2);
    expect(coming.light).toBeGreaterThan(0);
    expect(coming.dawn).toBeGreaterThan(0);
    expect(daySky(1, cycleMs() - sinkMs - 1).light).toBe(0);
  });

  it('reddens the setting sun, less on a dark sunset', () => {
    const { dayMs, sunsetRed } = MOBA_SKY;
    expect(daySky(1, MINUTE).sunRed).toBe(0);
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const red = seeds.find((seed) => redSunset(seed, 0))!;
    const dark = seeds.find((seed) => !redSunset(seed, 0))!;
    expect(daySky(red, dayMs).sunRed).toBeGreaterThan(daySky(red, dayMs - 10_000).sunRed);
    expect(daySky(red, dayMs).sunRed).toBeGreaterThan(daySky(dark, dayMs).sunRed);
    expect(daySky(red, dayMs).sunRed).toBeLessThanOrEqual(sunsetRed);
  });

  it('rises and sets upright on a half ellipse, keeping the same top', () => {
    expect(pathX(0)).toBe(1);
    expect(pathX(0.5)).toBeCloseTo(0.5);
    expect(pathX(1)).toBe(0);
    // Barely across in the first 5 % of the way, straight up out of the hills.
    expect(1 - pathX(0.05)).toBeLessThan(0.01);
  });

  it('shows no moon before the first day', () => {
    expect(daySky(1, 0).moon.visible).toBe(false);
    expect(daySky(1, MOBA_SKY.sinkMs / 2).moon.visible).toBe(false);
    expect(daySky(1, cycleMs() + MOBA_SKY.sinkMs / 2).moon.visible).toBe(true);
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
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map((n) => ordinal(n)))
      .toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
    expect(dayTitle(1)).toBe('The first day of battle');
    expect([2, 12, 20, 21, 42, 99, 100].map(ordinalWord)).toEqual(['second', 'twelfth', 'twentieth', 'twenty-first', 'forty-second', 'ninety-ninth', '100th']);
    expect(daySky(1, 0)).toMatchObject({ dayNumber: 1, title: 0 });
    expect(daySky(1, cycleMs() + MOBA_SKY.dayTitleMs / 2)).toMatchObject({ dayNumber: 2, title: 0.5 });
    expect(daySky(1, MOBA_SKY.dayTitleMs + 1).title).toBeUndefined();
  });

  it('raises "Eclipse!" as an eclipse begins', () => {
    const eclipse = eclipsesUntil(1, 60 * 60000)[0]!;
    expect(daySky(1, eclipse.start - 1).eclipseTitle).toBeUndefined();
    expect(daySky(1, eclipse.start).eclipseTitle).toBe(0);
    expect(daySky(1, eclipse.start + 1000).eclipseTitle).toBeCloseTo(1000 / MOBA_SKY.dayTitleMs);
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

  it('come 5 to 15 minutes apart, only in full daylight, for at most 2 minutes, over once the sun has sunk', () => {
    seeds.forEach((seed) => {
      const eclipses = eclipsesUntil(seed, 120 * MINUTE);
      expect(eclipses.length).toBeGreaterThan(3);
      eclipses.forEach((eclipse, index) => {
        const before = index === 0 ? 0 : eclipses[index - 1].start;
        expect(eclipse.start - before).toBeGreaterThanOrEqual(MOBA_SKY.eclipseMinMs);
        expect(dayTime(eclipse.start).part).toBe('day');
        expect(eclipse.end - eclipse.start).toBeLessThanOrEqual(MOBA_SKY.eclipseMs);
        expect(eclipse.end).toBeLessThanOrEqual(dayTime(eclipse.start).start + MOBA_SKY.dayMs + MOBA_SKY.sinkMs);
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

  it('bring the stars out only just before totality', () => {
    const eclipse = eclipsesUntil(11, 60 * MINUTE)[0];
    const totality = eclipse.start + (0.5 - MOBA_SKY.eclipseTotal / 2) * MOBA_SKY.eclipseMs;
    const lead = MOBA_SKY.eclipseStarLead * MOBA_SKY.eclipseMs;
    if (totality < eclipse.end && dayTime(eclipse.start).at + MOBA_SKY.eclipseMs < MOBA_SKY.dayMs - MOBA_SKY.twilightMs) {
      expect(daySky(11, totality - lead - 1).stars).toBe(0);
      expect(daySky(11, totality - lead / 2).stars).toBeCloseTo(0.5);
      expect(daySky(11, totality).stars).toBe(1);
      expect(daySky(11, eclipse.start + MOBA_SKY.eclipseMs / 2).stars).toBe(1);
    }
  });

  it('keep the stars from flickering when the sun sets eclipsed', () => {
    const cut = seeds.flatMap((seed) => eclipsesUntil(seed, 120 * MINUTE).filter((eclipse) => eclipse.end - eclipse.start < MOBA_SKY.eclipseMs).map((eclipse) => ({ seed, eclipse })));
    expect(cut.length).toBeGreaterThan(0);
    cut.forEach(({ seed, eclipse }) => {
      const nightOut = dayTime(eclipse.start).start + MOBA_SKY.dayMs + MOBA_SKY.sinkMs + MOBA_SKY.starFadeMs;
      expect(eclipse.end).toBe(dayTime(eclipse.start).start + MOBA_SKY.dayMs + MOBA_SKY.sinkMs);
      // The sun sinks out of sight still eclipsed: it never shows bare again that day.
      expect(daySky(seed, eclipse.end - 1).eclipse).toBeDefined();
      expect(daySky(seed, eclipse.end).sun.visible).toBe(false);
      let before = daySky(seed, eclipse.start).stars;
      for (let t = eclipse.start; t <= nightOut; t += 100) {
        const stars = daySky(seed, t).stars;
        expect(Math.abs(stars - before)).toBeLessThan(0.05);
        before = stars;
      }
      expect(daySky(seed, nightOut).stars).toBe(1);
    });
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
