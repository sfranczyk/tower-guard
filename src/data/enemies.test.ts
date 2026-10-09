import { describe, expect, it } from 'vitest';
import { ARROWS, ENEMY_SPEED, EXPLOSION_DAMAGE, PIN_DAMAGE, PIN_DURATION_MS, PIN_DURATION_ZOMBIE_MS } from '../config';
import { ENEMY_DAMAGE, ENEMY_LOOKS, enemyDamage, blowsApart, explosionDamage, getEnemyStats, knockbackPush, pinDurationMs, rollDamage, splashGibChance } from './enemies';

describe('getEnemyStats', () => {
  it('returns base stats at difficulty 1', () => {
    expect(getEnemyStats('basic', 1)).toEqual({ health: 35, speed: ENEMY_SPEED });
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
    expect(stats.health).toBe(Math.round(35 * 1.35));
    expect(stats.speed).toBeCloseTo(ENEMY_SPEED * 1.35);
  });
});

describe('enemy toughness and damage', () => {
  const arrowsToKill = (type: Parameters<typeof getEnemyStats>[0], damage: number): number =>
    Math.ceil(getEnemyStats(type, 1).health / damage);
  const headshot = ARROWS.damage * ARROWS.headshotMultiplier;

  it('takes a sensible number of arrows per type', () => {
    expect(arrowsToKill('basic', ARROWS.damage)).toBe(2);
    expect(arrowsToKill('fast', headshot)).toBe(1);
    expect(arrowsToKill('archer', headshot)).toBe(1);
    expect(arrowsToKill('fast', ARROWS.damage)).toBe(2);
    expect(arrowsToKill('tank', ARROWS.damage)).toBeGreaterThanOrEqual(5);
    expect(arrowsToKill('dragon', ARROWS.damage)).toBeGreaterThan(arrowsToKill('tank', ARROWS.damage));
  });

  it('hits differently per type: runners least, brutes most', () => {
    const average = ([min, max]: readonly [number, number]): number => (min + max) / 2;
    const melee = (type: 'basic' | 'fast' | 'tank') => average(ENEMY_DAMAGE[type].melee);
    expect(melee('fast')).toBeLessThan(melee('basic'));
    expect(melee('basic')).toBeLessThan(melee('tank'));
    expect(average(ENEMY_DAMAGE.dragon.arrow!)).toBeGreaterThan(average(ENEMY_DAMAGE.archer.arrow!));
  });

  it('hits the keep as hard as the bowman, except archer arrows (half), brutes (double) and kamikazes (×8)', () => {
    const keepFactor = (type: Parameters<typeof enemyDamage>[0], attack: 'melee' | 'arrow' = 'melee') =>
      enemyDamage(type, attack, 'keep')[1] / enemyDamage(type, attack, 'bowman')[1];
    (['basic', 'fast', 'zombie'] as const).forEach((type) =>
      expect(enemyDamage(type, 'melee', 'keep')).toEqual(enemyDamage(type, 'melee', 'bowman')));
    expect(keepFactor('dragon', 'arrow')).toBe(1);
    expect(keepFactor('archer', 'arrow')).toBe(0.5);
    expect(keepFactor('archer')).toBe(1);
    expect(keepFactor('tank')).toBe(2);
    expect(keepFactor('kamikaze')).toBe(8);
  });

  it('gives non-shooters the archer arrow', () => {
    expect(enemyDamage('basic', 'arrow', 'bowman')).toEqual(ENEMY_DAMAGE.archer.arrow);
  });

  it('rolls damage within the range', () => {
    expect(rollDamage([6, 10], 0)).toBe(6);
    expect(rollDamage([6, 10], 1)).toBe(10);
    expect(rollDamage([6, 10], 0.5)).toBe(8);
  });
});

describe('blowsApart', () => {
  const LUCKY = 0;
  const UNLUCKY = 0.99;

  it('always blows apart on a direct explosive hit', () => {
    expect(blowsApart('blast', 1, UNLUCKY)).toBe(true);
  });

  it('usually blows apart near the blast, rarely at the edge', () => {
    expect(blowsApart('explosion', 0.1, 0.9)).toBe(true);
    expect(blowsApart('explosion', 0.1, UNLUCKY)).toBe(false);
    expect(blowsApart('explosion', 0.95, 0.5)).toBe(false);
    expect(blowsApart('explosion', 0.95, 0.01)).toBe(true);
  });

  it('follows the splash chance for random rolls', () => {
    const hits = Array.from({ length: 1000 }, (_, index) => blowsApart('explosion', 0.5, index / 1000)).filter(Boolean).length;
    expect(hits).toBe(500);
  });

  it('never for other causes', () => {
    expect(blowsApart('arrow', 0, LUCKY)).toBe(false);
    expect(blowsApart('headshot', 0, LUCKY)).toBe(false);
    expect(blowsApart('lightning', 0, LUCKY)).toBe(false);
  });
});

describe('explosionDamage', () => {
  it('is full at the centre and smallest at the edge', () => {
    expect(explosionDamage(0)).toBe(EXPLOSION_DAMAGE.centre);
    expect(explosionDamage(1)).toBe(EXPLOSION_DAMAGE.edge);
    expect(explosionDamage(0.5)).toBe(Math.round((EXPLOSION_DAMAGE.centre + EXPLOSION_DAMAGE.edge) / 2));
  });

  it('falls off steadily and stays within its range', () => {
    for (let distance = 0.05; distance <= 1; distance += 0.05) {
      expect(explosionDamage(distance)).toBeLessThanOrEqual(explosionDamage(distance - 0.05));
    }
    expect(explosionDamage(-1)).toBe(EXPLOSION_DAMAGE.centre);
    expect(explosionDamage(2)).toBe(EXPLOSION_DAMAGE.edge);
  });

  it('kills light enemies with a direct hit, but not a brute', () => {
    expect(explosionDamage(0)).toBeGreaterThanOrEqual(getEnemyStats('basic', 1).health);
    expect(explosionDamage(0)).toBeLessThan(getEnemyStats('tank', 1).health);
  });
});

describe('splashGibChance', () => {
  it('is almost certain near the centre and small at the edge', () => {
    expect(splashGibChance(0)).toBeCloseTo(0.95);
    expect(splashGibChance(0.3)).toBeCloseTo(0.95);
    expect(splashGibChance(0.5)).toBeCloseTo(0.5);
    expect(splashGibChance(0.7)).toBeCloseTo(0.05);
    expect(splashGibChance(1)).toBeCloseTo(0.05);
  });

  it('falls off steadily with distance', () => {
    for (let distance = 0.05; distance <= 1; distance += 0.05) {
      expect(splashGibChance(distance)).toBeLessThanOrEqual(splashGibChance(distance - 0.05));
    }
  });
});

describe('knockbackPush', () => {
  it('throws closer enemies further, none at the edge', () => {
    expect(knockbackPush(0)).toBeGreaterThan(knockbackPush(0.5));
    expect(knockbackPush(0.5)).toBeGreaterThan(knockbackPush(0.9));
    expect(knockbackPush(1)).toBe(0);
  });
});

describe('ENEMY_LOOKS', () => {
  it('makes runners run with an uppercut and brutes 1.5× tall with a two-handed club', () => {
    expect(ENEMY_LOOKS.fast).toMatchObject({ size: 0.75, attackStyle: 'uppercut', runs: true });
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

describe('pinDurationMs', () => {
  it('pins most enemies and zombies for 20 s', () => {
    (['basic', 'fast', 'archer', 'kamikaze'] as const).forEach((type) => expect(pinDurationMs(type)).toBe(PIN_DURATION_MS));
    expect(PIN_DURATION_MS).toBe(20000);
    expect(pinDurationMs('zombie')).toBe(PIN_DURATION_ZOMBIE_MS);
    expect(PIN_DURATION_ZOMBIE_MS).toBe(20000);
  });

  it('only scratches: 0 to 4 damage', () => {
    expect(rollDamage(PIN_DAMAGE, 0)).toBe(0);
    expect(rollDamage(PIN_DAMAGE, 1)).toBe(4);
  });

  it("can't pin brutes or dragons", () => {
    (['tank', 'dragon', 'fireDragon'] as const).forEach((type) => expect(pinDurationMs(type)).toBe(0));
  });
});
