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

  it('moves piled-up units apart, at most maxStep a frame, the fixed ones not at all', () => {
    const xs = spreadApart([{ x: 100, fixed: false }, { x: 100, fixed: false }], 10);
    expect(xs[1] - xs[0]).toBeCloseTo(CROWD.minGap);
    expect(spreadApart([{ x: 100, fixed: true }, { x: 100, fixed: false }], 10)).toEqual([100, 100 + CROWD.minGap]);
    expect(spreadApart([{ x: 100, fixed: true }, { x: 100, fixed: true }], 10)).toEqual([100, 100]);
    expect(spreadApart([{ x: 100, fixed: false }, { x: 100, fixed: false }], 1)).toEqual([99, 101]);
    expect(spreadApart([{ x: 100, fixed: false }, { x: 110, fixed: false }], 10)).toEqual([100, 110]);
  });
});
