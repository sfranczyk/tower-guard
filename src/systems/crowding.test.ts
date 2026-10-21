import { describe, expect, it } from 'vitest';
import { CROWD } from '../config';
import { meleePosts, spreadApart, weaponReaches, type MeleeAttacker } from './crowding';

const bowman = { name: 'bowman' };
const attacker = (id: number, x: number, target: unknown = bowman, targetX = 0): MeleeAttacker<number> => ({ id, x, target, targetX, reach: 25 });

describe('crowding', () => {
  it('gives the nearest attackers on each side the attack posts, two to a post, the rest queue', () => {
    const posts = meleePosts([30, 31, 40, 41, 50, 51, 60, 70].map((x, id) => attacker(id, x)));
    expect([0, 1].map((id) => posts.get(id)!.distance)).toEqual([25, 25]);
    expect([2, 3].map((id) => posts.get(id)!.distance)).toEqual([25 + CROWD.slotSpacing, 25 + CROWD.slotSpacing]);
    expect([4, 5].map((id) => posts.get(id)!.attacks)).toEqual([true, true]);
    const queued = [6, 7].map((id) => posts.get(id)!);
    expect(queued.every((post) => !post.attacks)).toBe(true);
    expect(queued[0].distance).toBeGreaterThan(posts.get(5)!.distance);
    expect(queued[1].distance - queued[0].distance).toBe(CROWD.queueSpacing);
  });

  it('counts each side and each target apart', () => {
    const other = { name: 'squire' };
    const posts = meleePosts([attacker(0, 30), attacker(1, -30), attacker(2, 230, other, 200)]);
    expect([0, 1, 2].map((id) => posts.get(id)!.distance)).toEqual([25, 25, 25]);
    expect(posts.get(2)!.target).toBe(other);
  });

  it('lands a blow only ahead of the attacker, within its reach', () => {
    expect(weaponReaches(100, -1, 70, 55)).toBe(true);
    expect(weaponReaches(100, -1, 100, 55)).toBe(false); // standing on it
    expect(weaponReaches(100, -1, 120, 55)).toBe(false); // behind it
    expect(weaponReaches(100, -1, 40, 55)).toBe(false); // beyond its reach
  });

  const unit = (x: number, vx = 0, fixed = false, hiddenMs = CROWD.hiddenMs): { x: number; vx: number; width: number; fixed: boolean; hiddenMs: number } =>
    ({ x, vx, width: 14, fixed, hiddenMs });
  const gap = CROWD.visibleShare * 14;

  it('eases apart units that keep hiding one another, until both show', () => {
    const { xs } = spreadApart([unit(100, -22), unit(100, -22)], 10, 16);
    expect(xs[1] - xs[0]).toBeCloseTo(gap);
    expect(spreadApart([unit(100, 0, true), unit(100)], 10, 16).xs).toEqual([100, 100 + gap]);
    expect(spreadApart([unit(100, 0, true), unit(100, 0, true)], 10, 16).xs).toEqual([100, 100]);
    expect(spreadApart([unit(100), unit(110)], 10, 16).xs).toEqual([100, 110]);
  });

  it('leaves a unit passing another alone for CROWD.hiddenMs', () => {
    const passing = spreadApart([unit(100, -22, false, 0), unit(101, -63, false, 0)], 10, 16);
    expect(passing.xs).toEqual([100, 101]);
    expect(passing.hiddenMs).toEqual([16, 16]);
    expect(spreadApart([unit(100), unit(200, 0, false, 500)], 10, 16).hiddenMs).toEqual([0, 0]);
  });

  it('puts the faster one ahead, so it is never held back', () => {
    // Both walking left; the runner (faster) behind the raider ends up on the left, ahead.
    const { xs } = spreadApart([unit(100, -22), unit(101, -63)], 10, 16);
    expect(xs[1]).toBeLessThan(xs[0]);
  });
});
