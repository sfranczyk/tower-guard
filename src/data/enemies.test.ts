import { describe, expect, it } from 'vitest';
import { ENEMY_HEALTH, ENEMY_SPEED } from '../config';
import { ENEMY_LOOKS, blowsApart, getEnemyStats, splashGibChance } from './enemies';

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

  it('follows the splash chance for random rolls', () => {
    const hits = Array.from({ length: 1000 }, (_, index) => blowsApart('explosion', 20, 20, index / 1000)).filter(Boolean).length;
    expect(hits).toBe(750);
  });

  it('never for other causes', () => {
    expect(blowsApart('arrow', 500, 20, LUCKY)).toBe(false);
    expect(blowsApart('headshot', 500, 20, LUCKY)).toBe(false);
    expect(blowsApart('lightning', 500, 20, LUCKY)).toBe(false);
  });
});

describe('splashGibChance', () => {
  it('is zero up to 75% of max health', () => {
    expect(splashGibChance(75, 100)).toBe(0);
    expect(splashGibChance(14, 20)).toBe(0);
  });

  it('starts at 50% and adds a point per damage-% above 75%', () => {
    expect(splashGibChance(76, 100)).toBeCloseTo(0.51);
    expect(splashGibChance(100, 100)).toBeCloseTo(0.75);
    expect(splashGibChance(14, 16)).toBeCloseTo(0.625);
  });

  it('is certain from 125% up', () => {
    expect(splashGibChance(125, 100)).toBe(1);
    expect(splashGibChance(300, 100)).toBe(1);
  });
});

describe('ENEMY_LOOKS', () => {
  it('makes runners run with an uppercut and brutes 1.5× tall with a two-handed club', () => {
    expect(ENEMY_LOOKS.fast).toMatchObject({ size: 1, attackStyle: 'uppercut', runs: true });
    expect(ENEMY_LOOKS.tank).toMatchObject({ size: 1.5, attackStyle: 'twoHanded', runs: false });
    expect(ENEMY_LOOKS.basic.size).toBe(1);
  });
});

describe('strike reach', () => {
  it('is longest for the brute and shortest for the runner, all beyond where a swing starts', () => {
    expect(ENEMY_LOOKS.tank.strikeReach).toBeGreaterThan(ENEMY_LOOKS.basic.strikeReach);
    expect(ENEMY_LOOKS.basic.strikeReach).toBeGreaterThan(ENEMY_LOOKS.fast.strikeReach);
    // Swings start within 25 px (CombatSystem MELEE_REACH), so the bowman always has to move to dodge.
    (['basic', 'fast', 'tank', 'archer'] as const).forEach((type) => expect(ENEMY_LOOKS[type].strikeReach).toBeGreaterThan(25));
  });
});
