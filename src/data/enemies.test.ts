import { describe, expect, it } from 'vitest';
import { ENEMY_HEALTH, ENEMY_SPEED } from '../config';
import { blowsApart, getEnemyStats } from './enemies';

describe('getEnemyStats', () => {
  it('returns base stats at difficulty 1', () => {
    expect(getEnemyStats('basic', 1)).toEqual({ health: ENEMY_HEALTH, speed: ENEMY_SPEED });
  });

  it('makes fast enemies quicker and frailer, tanks slower and tougher', () => {
    const basic = getEnemyStats('basic', 1);
    const fast = getEnemyStats('fast', 1);
    const tank = getEnemyStats('tank', 1);
    expect(fast.speed).toBeGreaterThan(basic.speed);
    expect(fast.health).toBeLessThan(basic.health);
    expect(tank.speed).toBeLessThan(basic.speed);
    expect(tank.health).toBeGreaterThan(basic.health);
  });

  it('scales with difficulty and rounds health', () => {
    const stats = getEnemyStats('basic', 1.35);
    expect(stats.health).toBe(Math.round(ENEMY_HEALTH * 1.35));
    expect(stats.speed).toBeCloseTo(ENEMY_SPEED * 1.35);
  });
});

describe('blowsApart', () => {
  const LUCKY = 0;
  const UNLUCKY = 0.99;

  it('always blows apart on a direct explosive hit', () => {
    expect(blowsApart('blast', 1, 100, UNLUCKY)).toBe(true);
  });

  it('may blow apart on a splash explosion above 75% of max health', () => {
    expect(blowsApart('explosion', 76, 100, LUCKY)).toBe(true);
    expect(blowsApart('explosion', 76, 100, UNLUCKY)).toBe(false);
    expect(blowsApart('explosion', 75, 100, LUCKY)).toBe(false);
    // Runner (14 max hp) hit by a 14 splash: 100% > 75%.
    expect(blowsApart('explosion', 14, 14, LUCKY)).toBe(true);
  });

  it('happens about half the time when the splash is strong enough', () => {
    const hits = Array.from({ length: 1000 }, (_, index) => blowsApart('explosion', 20, 20, index / 1000)).filter(Boolean).length;
    expect(hits).toBe(500);
  });

  it('never for other causes', () => {
    expect(blowsApart('arrow', 500, 20, LUCKY)).toBe(false);
    expect(blowsApart('headshot', 500, 20, LUCKY)).toBe(false);
    expect(blowsApart('lightning', 500, 20, LUCKY)).toBe(false);
  });
});
