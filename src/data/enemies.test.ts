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
  it('always blows apart on a direct explosive hit', () => {
    expect(blowsApart('blast', 1, 100)).toBe(true);
  });

  it('blows apart on a splash explosion only above 100% of max health', () => {
    expect(blowsApart('explosion', 21, 20)).toBe(true);
    // 75/100 hp hit for 101: ends at −26, more than the whole max health.
    expect(blowsApart('explosion', 101, 100)).toBe(true);
    expect(blowsApart('explosion', 100, 100)).toBe(false);
    expect(blowsApart('explosion', 14, 20)).toBe(false);
  });

  it('never for other causes', () => {
    expect(blowsApart('arrow', 500, 20)).toBe(false);
    expect(blowsApart('headshot', 500, 20)).toBe(false);
    expect(blowsApart('lightning', 500, 20)).toBe(false);
  });
});
