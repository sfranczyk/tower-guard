import { describe, expect, it } from 'vitest';
import { DRAGON_ALTITUDE, DRAGON_HOVER_OFFSET, GROUND_Y, WORLD_WIDTH } from '../config';
import { cruiseAltitude, flyTowards, hoverX } from './dragonFlight';

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
});
