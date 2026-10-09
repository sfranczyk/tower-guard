import { describe, expect, it } from 'vitest';
import {
  PRIEST_FOLLOW_GAP,
  PRIEST_HEAL_INTERVAL_MS,
  PRIEST_HEAL_PER_TARGET,
  PRIEST_HEAL_RADIUS,
  PRIEST_MANA_MAX,
  PRIEST_MANA_REGEN_PER_S,
  PRIEST_MIN_CAST_MANA,
  PRIEST_STANDOFF,
} from '../config';
import { ManaPool, planHeals, priestPost } from './healing';

const at = (x: number, y = 0) => ({ x, y });

describe('planHeals', () => {
  it('heals the wounded in reach, nearest first, each by at most the per-target amount', () => {
    const heals = planHeals(at(0), [
      { at: at(100), missing: 50 },
      { at: at(-30), missing: 4 },
      { at: at(PRIEST_HEAL_RADIUS + 1), missing: 30 },
      { at: at(10), missing: 0 },
    ], 100);
    expect(heals).toEqual([{ index: 1, amount: 4 }, { index: 0, amount: PRIEST_HEAL_PER_TARGET }]);
  });

  it('stops when the mana runs out', () => {
    const heals = planHeals(at(0), [{ at: at(10), missing: 30 }, { at: at(20), missing: 30 }, { at: at(30), missing: 30 }], 15.5);
    expect(heals).toEqual([{ index: 0, amount: 10 }, { index: 1, amount: 5 }]);
  });

  it('measures the reach in both directions', () => {
    expect(planHeals(at(0, 0), [{ at: at(130, 130), missing: 10 }], 50)).toEqual([]);
  });
});

describe('priestPost', () => {
  const bowman = 300;
  const keep = 2240;

  it('walks just behind the soldier nearest to it, on the side away from the bowman', () => {
    expect(priestPost(900, [700, 820, 1500], bowman, keep)).toBe(820 + PRIEST_FOLLOW_GAP);
  });

  it('falls back behind the next soldiers when those around it are gone', () => {
    expect(priestPost(900, [1400, 1600], bowman, keep)).toBe(1400 + PRIEST_FOLLOW_GAP);
  });

  it('never goes nearer the bowman than its standoff, even behind a soldier fighting him', () => {
    expect(priestPost(520, [bowman + 20], bowman, keep)).toBe(bowman + PRIEST_STANDOFF);
  });

  it('keeps to the far side when the bowman is behind the soldiers', () => {
    expect(priestPost(900, [1000], 1400, keep)).toBe(1000 - PRIEST_FOLLOW_GAP);
  });

  it('retreats to the keep with no soldier left', () => {
    expect(priestPost(900, [], bowman, keep)).toBe(keep);
  });
});

describe('ManaPool', () => {
  it('starts full, spends, pauses and refills', () => {
    const pool = new ManaPool();
    expect(pool.mana).toBe(PRIEST_MANA_MAX);
    expect(pool.canCast).toBe(true);
    pool.spend(PRIEST_MANA_MAX);
    expect(pool.canCast).toBe(false);
    pool.update(PRIEST_HEAL_INTERVAL_MS);
    expect(pool.mana).toBeCloseTo((PRIEST_MANA_REGEN_PER_S * PRIEST_HEAL_INTERVAL_MS) / 1000);
    expect(pool.canCast).toBe(pool.mana >= PRIEST_MIN_CAST_MANA);
    pool.update(60_000);
    expect(pool.mana).toBe(PRIEST_MANA_MAX);
  });

  it('takes the host mana within its limits', () => {
    const pool = new ManaPool();
    pool.set(-5);
    expect(pool.ratio).toBe(0);
    pool.set(PRIEST_MANA_MAX * 2);
    expect(pool.ratio).toBe(1);
  });
});
