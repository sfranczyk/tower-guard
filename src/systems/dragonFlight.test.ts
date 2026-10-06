import { describe, expect, it } from 'vitest';
import { DRAGON_ALTITUDE, DRAGON_HOVER_OFFSET, GROUND_Y, WORLD_WIDTH } from '../config';
import { cruiseAltitude, fallStep, flyTowards, hoverX } from './dragonFlight';

describe('dragon flight', () => {
  it('hovers in front of the bowman, but inside the world', () => {
    expect(hoverX(300)).toBe(300 + DRAGON_HOVER_OFFSET);
    expect(hoverX(WORLD_WIDTH - 100)).toBeLessThanOrEqual(WORLD_WIDTH);
  });

  it('cruises high above the ground', () => {
    for (let time = 0; time < 10000; time += 250) {
      expect(cruiseAltitude(time)).toBeLessThan(GROUND_Y - 200);
      expect(Math.abs(cruiseAltitude(time) - DRAGON_ALTITUDE)).toBeLessThanOrEqual(12);
    }
  });

  it('flies towards a target without overshooting', () => {
    expect(flyTowards(500, 300, 60, 1000)).toBe(440);
    expect(flyTowards(305, 300, 60, 1000)).toBe(300);
  });

  it('falls, tips nose-down and lands on the ground', () => {
    let state = { y: DRAGON_ALTITUDE, vy: 0, rotation: 0, landed: false };
    let steps = 0;
    while (!state.landed && steps < 300) {
      state = fallStep(state, 470, 16);
      steps += 1;
    }
    expect(state.landed).toBe(true);
    expect(state.y).toBe(470);
    expect(state.rotation).toBeGreaterThan(0);
    expect(steps * 16).toBeLessThan(1500);
  });
});
