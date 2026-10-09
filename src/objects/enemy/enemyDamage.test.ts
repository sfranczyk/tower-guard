import { describe, expect, it } from 'vitest';
import { Vitals } from './enemyDamage';

describe('Vitals', () => {
  it('keeps health between 0 and full', () => {
    const v = new Vitals(50);
    v.hurt(20);
    v.hurt(-5);
    expect(v.health).toBe(30);
    expect(v.missing).toBe(20);
    expect(v.restore(30)).toBe(20);
    expect(v.ratio).toBe(1);
    v.set(-3);
    expect(v.alive).toBe(false);
  });

  it('leaves the fight whatever its health', () => {
    const v = new Vitals(10);
    v.end();
    expect(v.alive).toBe(false);
    expect(v.health).toBe(10);
  });
});
