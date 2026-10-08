import { describe, expect, it } from 'vitest';
import { DRAGON_ALTITUDE, DRAGON_HOVER_OFFSET, DRAGON_TURN_PAST, GROUND_Y, WORLD_WIDTH } from '../config';
import { cruiseAltitude, facingScale, flyTowards, hoverX, nextHoverSide, stepFacing } from './dragonFlight';

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

  it('hovers on either side of its target', () => {
    expect(hoverX(1000, DRAGON_HOVER_OFFSET, 1)).toBe(1000 + DRAGON_HOVER_OFFSET);
    expect(hoverX(1000, DRAGON_HOVER_OFFSET, -1)).toBe(1000 - DRAGON_HOVER_OFFSET);
    expect(hoverX(50, DRAGON_HOVER_OFFSET, -1)).toBeGreaterThanOrEqual(0);
  });

  it('keeps its side until the target gets well behind it, then turns round', () => {
    expect(nextHoverSide(1300, 1000, 1)).toBe(1);
    // Passing underneath, not yet far enough behind.
    expect(nextHoverSide(1300, 1300 + DRAGON_TURN_PAST - 5, 1)).toBe(1);
    expect(nextHoverSide(1300, 1300 + DRAGON_TURN_PAST + 5, 1)).toBe(-1);
    // And back again the other way.
    expect(nextHoverSide(1300, 1300 - DRAGON_TURN_PAST - 5, -1)).toBe(1);
    expect(nextHoverSide(1300, 1000, -1)).toBe(1);
  });

  it('turns to the side with room when the world ends in front of the target', () => {
    // The bowman near the right edge: no room to his right, so the dragon comes round to his left.
    expect(nextHoverSide(WORLD_WIDTH - 80, WORLD_WIDTH - 20, 1)).toBe(-1);
    // Behind the player's keep near the left edge: it stays on his right.
    expect(nextHoverSide(300, 30, 1)).toBe(1);
    expect(nextHoverSide(10, 30, -1)).toBe(1);
  });

  it('swings round smoothly, never vanishing mid-turn', () => {
    let facing = -1;
    let steps = 0;
    while (facing !== 1 && steps < 1000) {
      const next = stepFacing(facing, 1, 16, 700);
      // Small steps (the biggest where it flips from a sliver facing one way to a sliver facing the other).
      expect(Math.abs(facingScale(next) - facingScale(facing))).toBeLessThan(0.15);
      expect(Math.abs(facingScale(next))).toBeGreaterThanOrEqual(0.06);
      facing = next;
      steps += 1;
    }
    expect(facing).toBe(1);
    expect(steps * 16).toBeGreaterThanOrEqual(690);
    expect(facingScale(-1)).toBe(-1);
    expect(facingScale(1)).toBe(1);
  });
});
