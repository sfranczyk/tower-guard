import { describe, expect, it } from 'vitest';
import { ENEMY_ATTACK } from '../config';
import { EnemyBow } from './EnemyBow';

/** Frames until the bow shoots (or `limit`). */
const framesToShot = (bow: EnemyBow, limit = 1000): number => {
  for (let frame = 1; frame <= limit; frame += 1) {
    if (bow.draw(Math.PI, 16)) {
      return frame;
    }
  }
  return Infinity;
};

describe('EnemyBow', () => {
  it('raises the bow, draws and shoots, then waits before the next shot', () => {
    const bow = new EnemyBow();
    const first = framesToShot(bow) * 16;
    expect(first).toBeGreaterThanOrEqual(ENEMY_ATTACK.archerDrawMs);
    expect(first).toBeLessThan(ENEMY_ATTACK.archerDrawMs + 300);
    expect(bow.tension).toBe(0);
    expect(framesToShot(bow) * 16).toBeGreaterThanOrEqual(ENEMY_ATTACK.archerCooldownMs + ENEMY_ATTACK.archerDrawMs);
  });

  it('lowers the bow when relaxed', () => {
    const bow = new EnemyBow();
    for (let i = 0; i < 30; i += 1) {
      bow.draw(Math.PI, 16);
    }
    expect(bow.ready).toBe(1);
    for (let i = 0; i < 60; i += 1) {
      bow.relax(16);
    }
    expect(bow.ready).toBe(0);
    expect(bow.tension).toBe(0);
  });

  it('sends and takes the bow for co-op', () => {
    const bow = new EnemyBow();
    bow.apply({ aim: 2.5, tension: 0.4, ready: 1 });
    expect(bow.net).toEqual({ aim: 2.5, tension: 0.4, ready: 1 });
    bow.apply({ aim: 3 });
    expect(bow.net).toEqual({ aim: 3, tension: 0, ready: 0 });
  });
});
