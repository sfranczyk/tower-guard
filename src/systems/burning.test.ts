import { describe, expect, it } from 'vitest';
import { BURN_DAMAGE_PER_S, BURN_DURATION_MS } from '../config';
import { burnDamage, flamesTouch, relight } from './burning';

const body = { left: 100, right: 114, top: 450, bottom: 490 };

describe('flamesTouch', () => {
  it('burns when a flame core overlaps the body', () => {
    expect(flamesTouch([{ center: { x: 107, y: 470 }, radius: 5 }], body)).toBe(true);
    expect(flamesTouch([{ center: { x: 130, y: 470 }, radius: 25 }], body)).toBe(true);
  });

  it("doesn't burn from a flame's soft edge or from far away", () => {
    // 20 px from the body: inside the radius but outside its core (0.7 × 25 = 17.5).
    expect(flamesTouch([{ center: { x: 134, y: 470 }, radius: 25 }], body)).toBe(false);
    expect(flamesTouch([], body)).toBe(false);
  });
});

describe('burn', () => {
  it('lasts BURN_DURATION_MS after the last touch', () => {
    expect(relight()).toBe(BURN_DURATION_MS);
  });

  it('deals steady damage per second, and nothing once burnt out', () => {
    expect(burnDamage(BURN_DURATION_MS, 1000)).toBeCloseTo(BURN_DAMAGE_PER_S);
    expect(burnDamage(BURN_DURATION_MS, 16)).toBeCloseTo(BURN_DAMAGE_PER_S * 0.016);
    expect(burnDamage(8, 16)).toBeCloseTo(BURN_DAMAGE_PER_S * 0.008);
    expect(burnDamage(0, 16)).toBe(0);
  });

  it('adds up to BURN_DAMAGE_PER_S × the duration over a whole burn', () => {
    let remaining = BURN_DURATION_MS;
    let total = 0;
    while (remaining > 0) {
      total += burnDamage(remaining, 16);
      remaining -= 16;
    }
    expect(total).toBeCloseTo((BURN_DAMAGE_PER_S * BURN_DURATION_MS) / 1000, 6);
  });
});
