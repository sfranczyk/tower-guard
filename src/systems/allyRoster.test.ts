import { describe, expect, it } from 'vitest';
import { ALLIES } from '../config';
import { AllyRoster } from './allyRoster';

describe('AllyRoster', () => {
  it('allows up to the limit standing at once', () => {
    const roster = new AllyRoster();
    expect(roster.canSummon('squire', ALLIES.squireLimit - 1)).toBe(true);
    expect(roster.canSummon('squire', ALLIES.squireLimit)).toBe(false);
  });

  it('waits out the pause after each summons, kind by kind', () => {
    const roster = new AllyRoster();
    roster.summoned('allyKnight');
    expect(roster.canSummon('allyKnight', 1)).toBe(false);
    expect(roster.canSummon('squire', 0)).toBe(true);
    roster.tick(ALLIES.allyKnightCooldownMs / 2);
    expect(roster.slot('allyKnight', 1).cooldown).toBeCloseTo(0.5);
    roster.tick(ALLIES.allyKnightCooldownMs / 2);
    expect(roster.canSummon('allyKnight', 1)).toBe(true);
    expect(roster.slot('allyKnight', 1)).toEqual({ type: 'allyKnight', alive: 1, limit: ALLIES.allyKnightLimit, cooldown: 0 });
  });
});
