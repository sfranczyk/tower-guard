import { describe, expect, it } from 'vitest';
import { livingBowmen, nearestExposedBowman, nearestMeleeTarget } from './targeting';

const bowman = (x: number, isInTower = false, isDead = false) => ({ x, isInTower, isDead });

describe('nearestExposedBowman', () => {
  it('picks the nearest bowman', () => {
    const near = bowman(400);
    expect(nearestExposedBowman([bowman(150), near], 600)).toBe(near);
    const far = bowman(150);
    expect(nearestExposedBowman([far, bowman(400)], 200)).toBe(far);
  });

  it('skips bowmen hiding in the keep and dead ones', () => {
    const exposed = bowman(150);
    expect(nearestExposedBowman([bowman(400, true), exposed], 600)).toBe(exposed);
    expect(nearestExposedBowman([bowman(400, false, true), exposed], 600)).toBe(exposed);
  });

  it('has no target when nobody is out in the open (the keep is the target then)', () => {
    expect(nearestExposedBowman([bowman(70, true), bowman(300, false, true)], 600)).toBeUndefined();
    expect(nearestExposedBowman([], 600)).toBeUndefined();
  });
});

describe('livingBowmen', () => {
  it('leaves out the fallen', () => {
    expect(livingBowmen([bowman(1), bowman(2, false, true), bowman(3, true)])).toHaveLength(2);
  });
});

describe('nearestMeleeTarget', () => {
  const ally = (x: number, alive = true) => ({ x, isAlive: () => alive });

  it('stops at a soldier standing between the enemy and the bowman', () => {
    const soldier = ally(420);
    expect(nearestMeleeTarget([bowman(250)], [soldier], 800)).toEqual({ ally: soldier });
  });

  it('goes for the bowman when he is nearer, or when the soldiers have fallen', () => {
    const archer = bowman(600);
    expect(nearestMeleeTarget([archer], [ally(300)], 800)).toEqual({ bowman: archer });
    expect(nearestMeleeTarget([bowman(250)], [ally(420, false)], 800)?.ally).toBeUndefined();
  });

  it('goes for a soldier while the bowmen hide, and for the keep with nobody out', () => {
    const soldier = ally(300);
    expect(nearestMeleeTarget([bowman(100, true)], [soldier], 800)).toEqual({ ally: soldier });
    expect(nearestMeleeTarget([bowman(100, true)], [], 800)).toBeUndefined();
  });
});
