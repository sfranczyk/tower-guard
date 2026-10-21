import { describe, expect, it } from 'vitest';
import { ALLIES } from '../config';
import { AllyRoster } from './allyRoster';

const none = (): number => 0;

describe('AllyRoster', () => {
  it('starts empty and trains one at a time, kind by kind', () => {
    const roster = new AllyRoster();
    expect(roster.canSummon('allyKnight')).toBe(false);
    roster.tick(ALLIES.allyKnightTrainMs / 2, none);
    expect(roster.slot('allyKnight', 0).cooldown).toBeCloseTo(0.5);
    roster.tick(ALLIES.allyKnightTrainMs / 2, none);
    expect(roster.readyOf('allyKnight')).toBe(1);
    expect(roster.readyOf('squire')).toBe(ALLIES.allyKnightTrainMs >= 2 * ALLIES.squireTrainMs ? 2 : 1);
  });

  it('stops training once reserve and field reach the limit, and goes on when one falls', () => {
    const roster = new AllyRoster();
    const limit = ALLIES.allyKnightLimit;
    roster.tick(ALLIES.allyKnightTrainMs, none);
    roster.summoned('allyKnight');
    // The rest of the places are taken on the field.
    const standing = (): number => limit;
    roster.tick(ALLIES.allyKnightTrainMs * 3, standing);
    expect(roster.readyOf('allyKnight')).toBe(0);
    expect(roster.slot('allyKnight', limit)).toEqual({ type: 'allyKnight', ready: 0, alive: limit, limit, cooldown: 0 });
    roster.tick(ALLIES.allyKnightTrainMs, () => limit - 1);
    expect(roster.readyOf('allyKnight')).toBe(1);
  });

  it('lets the player summon as many as are ready', () => {
    const roster = new AllyRoster();
    for (let i = 0; i < 3; i += 1) {
      roster.tick(ALLIES.squireTrainMs, none);
    }
    expect(roster.readyOf('squire')).toBe(3);
    roster.summoned('squire');
    roster.summoned('squire');
    expect(roster.canSummon('squire')).toBe(true);
    roster.summoned('squire');
    expect(roster.canSummon('squire')).toBe(false);
  });
});
