import { describe, expect, it } from 'vitest';
import { FIRE_DRAGON_BREATH_INTERVAL_MS } from '../../config';
import { FIRE_BREATH_MS } from '../../rendering/dragonFire';
import { DragonBreath } from './DragonBreath';

describe('DragonBreath', () => {
  it('breathes once, then waits for the interval', () => {
    const breath = new DragonBreath();
    breath.breathe(0.6);
    expect(breath.timeMs).toBe(0);
    breath.step(FIRE_BREATH_MS);
    expect(breath.timeMs).toBeUndefined();
    breath.breathe(0.6);
    expect(breath.timeMs).toBeUndefined();
    breath.step(FIRE_DRAGON_BREATH_INTERVAL_MS);
    breath.breathe(0.6);
    expect(breath.timeMs).toBe(0);
  });

  it('turns the fire slowly towards a clamped target', () => {
    const breath = new DragonBreath();
    breath.breathe(0.6);
    breath.breathe(3);
    breath.step(100);
    expect(breath.aim).toBeCloseTo(0.72);
    for (let i = 0; i < 20; i += 1) {
      breath.step(100);
    }
    expect(breath.aim).toBeLessThanOrEqual(1.25);
  });
});
