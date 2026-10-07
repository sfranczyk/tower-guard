import { describe, expect, it } from 'vitest';
import { livingBowmen, nearestExposedBowman } from './targeting';

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
