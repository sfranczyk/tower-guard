import { describe, expect, it } from 'vitest';
import { DRAGON_DRAW_MS, DRAGON_SHOT_INTERVAL_MS } from '../../config';
import { DragonBow } from './DragonBow';

describe('DragonBow', () => {
  it('draws over the last part of the interval and shoots', () => {
    const bow = new DragonBow();
    expect(bow.draw(1, DRAGON_SHOT_INTERVAL_MS * 0.5 - DRAGON_DRAW_MS / 2)).toBe(false);
    expect(bow.tension).toBeCloseTo(0.5);
    expect(bow.draw(1, DRAGON_DRAW_MS / 2)).toBe(true);
    expect(bow.tension).toBe(0);
    expect(bow.aimAngle).toBe(1);
  });

  it('eases off when relaxed and draws the full time again', () => {
    const bow = new DragonBow();
    bow.draw(1, DRAGON_SHOT_INTERVAL_MS * 0.5 - 10);
    bow.relax(10_000);
    expect(bow.tension).toBe(0);
    expect(bow.draw(1, DRAGON_DRAW_MS - 1)).toBe(false);
    expect(bow.draw(1, 1)).toBe(true);
  });
});
