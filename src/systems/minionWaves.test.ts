import { describe, expect, it } from 'vitest';
import { MinionWaves, type MinionGroup } from './minionWaves';

type Role = 'troop' | 'archer';

const waves = (groups: MinionGroup<Role>[], firstMs = 1000, spacingMs = 100) => new MinionWaves<Role>(() => groups, () => firstMs, () => spacingMs);

/** Steps `ms` in 10 ms frames and returns every role released, with when. */
const run = (clock: MinionWaves<Role>, ms: number): Array<{ role: Role; atMs: number }> => {
  const out: Array<{ role: Role; atMs: number }> = [];
  for (let t = 10; t <= ms; t += 10) {
    clock.update(10).forEach((role) => out.push({ role, atMs: t }));
  }
  return out;
};

describe('MinionWaves', () => {
  it('releases nothing before the first group', () => {
    expect(run(waves([{ role: 'troop', count: 5, everyMs: 30000 }]), 990)).toEqual([]);
  });

  it('releases a group one minion every spacing, starting at the first group', () => {
    const out = run(waves([{ role: 'troop', count: 3, everyMs: 30000 }]), 2000);
    expect(out.map(({ atMs }) => atMs)).toEqual([1000, 1100, 1200]);
  });

  it('repeats each group on its own clock', () => {
    const out = run(waves([{ role: 'troop', count: 2, everyMs: 4000 }, { role: 'archer', count: 1, everyMs: 3000 }]), 9000);
    expect(out.filter(({ role }) => role === 'troop').map(({ atMs }) => atMs)).toEqual([1000, 1100, 5000, 5100, 9000]);
    expect(out.filter(({ role }) => role === 'archer').map(({ atMs }) => atMs)).toEqual([1000, 4000, 7000]);
  });

  it('starts a group at its own first time when it has one', () => {
    const out = run(waves([{ role: 'archer', count: 1, everyMs: 3000, firstMs: 2500 }]), 6000);
    expect(out.map(({ atMs }) => atMs)).toEqual([2500, 5500]);
  });

  it('catches up after one long frame', () => {
    const clock = waves([{ role: 'troop', count: 2, everyMs: 30000 }]);
    expect(clock.update(1500)).toEqual(['troop', 'troop']);
  });

  it('skips groups set to none', () => {
    expect(run(waves([{ role: 'troop', count: 0, everyMs: 1000 }]), 5000)).toEqual([]);
  });
});
