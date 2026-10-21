import { describe, expect, it } from 'vitest';
import { SURVIVAL } from '../config';
import { enemyThreat } from '../data/enemyKinds';
import { bossCount, canLead, drawBossWave, drawByBudget, enemyRole, escortsOf, waveCost } from './survivalRoles';

describe('survival roles', () => {
  it('sort the kinds into supporters, bosses and fighters', () => {
    expect(enemyRole('priest')).toBe('supporter');
    expect(enemyRole('shaman')).toBe('supporter');
    expect(['troll', 'dragon', 'fireDragon'].map((kind) => enemyRole(kind as never))).toEqual(['boss', 'boss', 'boss']);
    expect(enemyRole('raider')).toBe('fighter');
    expect(canLead('priest')).toBe(false);
    expect(canLead('troll')).toBe(true);
  });

  it('fill a wave up to its budget, the lead kind first', () => {
    const wave = drawByBudget(['raider', 'tank', 'goblinKamikaze'], 6, () => 0, 'raider');
    expect(waveCost(wave)).toBeLessThanOrEqual(6);
    expect(wave.filter((kind) => kind === 'raider').length).toBeGreaterThanOrEqual(Math.floor(6 * SURVIVAL.leadShare));
    // A brute costs what two and a half raiders do.
    expect(waveCost(['tank', 'tank'])).toBe(2 * enemyThreat('tank'));
    expect(drawByBudget(['raider', 'hunter'], 20, () => 0.99).every((kind) => kind === 'hunter')).toBe(true);
    expect(drawByBudget([], 5, Math.random)).toEqual([]);
  });

  it('still send one when the budget is too small for anything', () => {
    expect(drawByBudget(['tank'], 1, () => 0)).toEqual(['tank']);
  });

  it('send 1 boss on easy, 1–2 on medium, 1–3 on hard', () => {
    expect(bossCount('easy', () => 0.99)).toBe(1);
    expect(bossCount('medium', () => 0)).toBe(1);
    expect(bossCount('medium', () => 0.99)).toBe(2);
    expect(bossCount('hard', () => 0.99)).toBe(3);
  });

  it('escort a boss with its own group, else anyone who came', () => {
    expect(escortsOf('troll', ['raider', 'fast', 'tank', 'dragon'])).toEqual(['fast', 'tank']);
    expect(escortsOf('dragon', ['raider', 'fast', 'knight'])).toEqual(['raider', 'knight']);
    expect(escortsOf('troll', ['raider'])).toEqual(['raider']);
  });

  it('put the bosses on top of the budget, escorts worth a share of it', () => {
    const { wave, gapBudget } = drawBossWave('troll', ['fast', 'tank', 'troll'], 8, 'hard', () => 0.99);
    expect(wave.filter((kind) => kind === 'troll')).toHaveLength(3);
    const escort = wave.filter((kind) => kind !== 'troll');
    expect(waveCost(escort)).toBeLessThanOrEqual(8 * SURVIVAL.bossEscortShare);
    expect(gapBudget).toBe(waveCost(wave));
  });
});
