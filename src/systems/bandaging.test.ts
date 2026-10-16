import { describe, expect, it } from 'vitest';
import { MEDIC } from '../config';
import { bandageHeal, pickPatient } from './bandaging';

describe('pickPatient', () => {
  it('goes to the one with the smallest share of health left', () => {
    expect(pickPatient([{ missing: 10, ratio: 0.7, bowman: false }, { missing: 20, ratio: 0.3, bowman: false }])).toBe(1);
  });

  it('puts a badly hurt bowman first, a lightly hurt one after the soldiers', () => {
    const soldier = { missing: 25, ratio: 0.2, bowman: false };
    expect(pickPatient([soldier, { missing: 60, ratio: MEDIC.bowmanFirstBelow - 0.1, bowman: true }])).toBe(1);
    expect(pickPatient([soldier, { missing: 30, ratio: 0.7, bowman: true }])).toBe(0);
  });

  it('leaves scratches alone', () => {
    expect(pickPatient([{ missing: MEDIC.minMissing - 1, ratio: 0.9, bowman: false }])).toBeUndefined();
    expect(pickPatient([])).toBeUndefined();
  });
});

describe('bandageHeal', () => {
  it('heals at its pace, never past what is missing', () => {
    expect(bandageHeal(500, 100)).toBeCloseTo(MEDIC.healPerSecond / 2);
    expect(bandageHeal(10000, 3)).toBe(3);
  });
});
