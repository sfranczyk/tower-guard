import { describe, expect, it } from 'vitest';
import { MAX_BOUGHT_ARROWS, UPGRADES, blockedBy, boughtArrows, minionLevel, minionPower, playerStats, upgradeById, upgradeCost } from './upgrades';

const def = (id: string) => upgradeById(id)!;

describe('upgrades', () => {
  it('has unique ids and requirements that exist', () => {
    const ids = UPGRADES.map((upgrade) => upgrade.id);
    expect(new Set(ids).size).toBe(ids.length);
    UPGRADES.filter((upgrade) => upgrade.requires).forEach((upgrade) => expect(ids).toContain(upgrade.requires!.id));
  });

  it('prices each level by the first one, rounded to 10', () => {
    expect([1, 2].map((level) => upgradeCost(def('basicArrow'), level))).toEqual([150, 300]);
    expect([1, 2, 3].map((level) => upgradeCost(def('regen'), level))).toEqual([100, 160, 260]);
    expect([1, 2].map((level) => upgradeCost(def('minion:troop'), level))).toEqual([400, 800]);
  });

  it('needs the gold, the level before and the required upgrade', () => {
    expect(blockedBy(def('regen'), {}, 99)).toBe('Not enough gold');
    expect(blockedBy(def('regen'), {}, 100)).toBeUndefined();
    expect(blockedBy(def('regen'), { regen: 3 }, 9999)).toBe('Bought');
    expect(blockedBy(def('quick:fire'), {}, 9999)).toMatch(/^Needs/);
    expect(blockedBy(def('quick:fire'), { 'arrow:fire': 1 }, 9999)).toBeUndefined();
  });

  it('sells at most three arrows besides the normal one', () => {
    const three = { 'arrow:fire': 1, 'arrow:frost': 1, 'arrow:piercing': 1 };
    expect(MAX_BOUGHT_ARROWS).toBe(3);
    expect(blockedBy(def('arrow:vortex'), three, 9999)).toMatch(/^Up to/);
  });

  it('turns levels into stats', () => {
    const stats = playerStats({ basicArrow: 2, 'arrow:fire': 1, 'quick:fire': 1, regen: 1, maxHp: 2, speed: 3 });
    expect(stats.quiver).toEqual(['normal', 'fire']);
    expect(stats.basicDamage).toBeCloseTo(1.5);
    expect(stats.cooldown).toEqual({ fire: 0.5 });
    expect(stats.regenBonus).toBe(5);
    expect(stats.maxHealth).toBeCloseTo(1.4);
    expect(stats.speed).toBeCloseTo(1.4);
    expect(playerStats({}).speed).toBeCloseTo(0.8);
    expect([0, 1, 2].map((level) => playerStats({ wallBreaker: level }).keepBlast)).toEqual([1, 2, 3]);
  });

  it('makes minions stronger by half a level each', () => {
    expect(minionLevel({}, 'troop')).toBe(1);
    expect(minionLevel({ 'minion:troop': 2 }, 'troop')).toBe(3);
    expect([1, 2, 3].map(minionPower)).toEqual([1, 1.5, 2]);
  });

  it('puts bought arrows in the quiver in the order they were bought', () => {
    const levels: Record<string, number> = {};
    levels['arrow:vortex'] = 1;
    levels.regen = 1;
    levels['arrow:explosive'] = 1;
    levels['arrow:fire'] = 1;
    expect(boughtArrows(levels)).toEqual(['vortex', 'explosive', 'fire']);
    expect(playerStats(JSON.parse(JSON.stringify(levels)) as Record<string, number>).quiver).toEqual(['normal', 'vortex', 'explosive', 'fire']);
  });
});

describe('shop prices and order', () => {
  it('prices speed 60, 120, 240 and the arrows as set', () => {
    const speed = upgradeById('speed')!;
    expect([1, 2, 3].map((level) => upgradeCost(speed, level))).toEqual([60, 120, 240]);
    const prices = (type: string): number[] => [upgradeCost(upgradeById(`arrow:${type}`)!, 1), upgradeCost(upgradeById(`quick:${type}`)!, 1)];
    expect(prices('pinning')).toEqual([200, 250]);
    expect(prices('shrapnel')).toEqual([200, 250]);
    expect(prices('fire')).toEqual([150, 250]);
    expect(prices('frost')).toEqual([200, 250]);
  });

  it('lists the arrows fire, frost, shrapnel, pinning, piercing, explosive, vortex', () => {
    expect(UPGRADES.filter((def) => def.arrow).map((def) => def.arrow)).toEqual(['fire', 'frost', 'shrapnel', 'pinning', 'piercing', 'explosive', 'vortex']);
  });
});
