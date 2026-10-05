import { describe, expect, it } from 'vitest';
import { LIGHTNING_GROUND_CHANCE, LIGHTNING_INTERVAL_MS } from '../config';
import { createRandom } from '../utils/math';
import { createBolt, planStrike, struckBy } from './lightning';

describe('createBolt', () => {
  const start = { x: 400, y: 120 };
  const end = { x: 460, y: 490 };
  const bolt = createBolt(start, end, 11);

  it('runs from the cloud to the strike point', () => {
    expect(bolt.trunk[0]).toEqual(start);
    expect(bolt.trunk[bolt.trunk.length - 1]).toEqual(end);
    expect(bolt.trunk.length).toBeGreaterThan(20);
  });

  it('is jagged but stays near the straight line and never goes far below the ground', () => {
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    for (let seed = 1; seed <= 30; seed += 1) {
      const { trunk } = createBolt(start, end, seed);
      trunk.forEach((point) => {
        const t = Math.max(0, Math.min(1, (point.y - start.y) / (end.y - start.y)));
        const lineX = start.x + (end.x - start.x) * t;
        expect(Math.abs(point.x - lineX)).toBeLessThan(length * 0.4);
        expect(point.y).toBeLessThanOrEqual(end.y + 25);
      });
      const pathLength = trunk.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - trunk[index].x, point.y - trunk[index].y), 0);
      expect(pathLength).toBeGreaterThan(length * 1.1);
    }
  });

  it('has a few shorter forks starting on the trunk', () => {
    expect(bolt.branches.length).toBeGreaterThanOrEqual(2);
    bolt.branches.forEach((branch) => {
      expect(bolt.trunk).toContainEqual(branch[0]);
      const forkLength = Math.hypot(branch[branch.length - 1].x - branch[0].x, branch[branch.length - 1].y - branch[0].y);
      expect(forkLength).toBeLessThan(Math.hypot(end.x - start.x, end.y - start.y) * 0.31);
    });
  });

  it('is the same bolt for the same seed', () => {
    expect(createBolt(start, end, 11)).toEqual(bolt);
    expect(createBolt(start, end, 12)).not.toEqual(bolt);
  });
});

describe('planStrike', () => {
  it('waits within the interval and only sometimes reaches the ground', () => {
    const random = createRandom(3);
    const plans = Array.from({ length: 400 }, () => planStrike(random));
    plans.forEach((plan) => {
      expect(plan.delayMs).toBeGreaterThanOrEqual(LIGHTNING_INTERVAL_MS[0]);
      expect(plan.delayMs).toBeLessThanOrEqual(LIGHTNING_INTERVAL_MS[1]);
    });
    const groundShare = plans.filter((plan) => plan.reachesGround).length / plans.length;
    expect(groundShare).toBeGreaterThan(LIGHTNING_GROUND_CHANCE - 0.1);
    expect(groundShare).toBeLessThan(LIGHTNING_GROUND_CHANCE + 0.1);
  });
});

describe('struckBy', () => {
  it('hits everyone within the radius of the strike', () => {
    const targets = [{ x: 100 }, { x: 130 }, { x: 139 }, { x: 141 }, { x: 60 }];
    expect(struckBy(100, 40, targets)).toEqual([{ x: 100 }, { x: 130 }, { x: 139 }, { x: 60 }]);
  });
});
