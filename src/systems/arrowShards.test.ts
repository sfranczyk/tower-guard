import { describe, expect, it } from 'vitest';
import { breakArrow, shardAlpha, stepShard, type ShardTuning } from './arrowShards';

const TUNING: ShardTuning = { breakMin: 0.5, breakMax: 0.5, speedMin: 100, speedMax: 100, lift: 0, spin: 10, gravity: 0, lifeMs: 1000, fadeMs: 400 };
const ARROW = { position: { x: 100, y: 50 }, rotation: 0, length: 40 };

describe('breakArrow', () => {
  it('snaps the arrow into its rear and front half, each centred on its part of the shaft', () => {
    const [rear, front] = breakArrow(ARROW, { x: 100, y: 100 }, TUNING, () => 0.5);
    expect([rear.from, rear.to, front.from, front.to]).toEqual([0, 0.5, 0.5, 1]);
    expect(rear.position).toEqual({ x: 90, y: 50 });
    expect(front.position).toEqual({ x: 110, y: 50 });
  });

  it('throws each half away from the blast', () => {
    const [rear, front] = breakArrow(ARROW, { x: 100, y: 50 }, TUNING, () => 0.5);
    expect(rear.velocity.x).toBeLessThan(0);
    expect(front.velocity.x).toBeGreaterThan(0);
  });
});

describe('stepShard', () => {
  it('stops on the ground lying flat, then only fades', () => {
    const [shard] = breakArrow(ARROW, { x: 100, y: 0 }, TUNING, () => 0.9);
    stepShard(shard, 500, TUNING, () => 60);
    expect(shard.resting).toBe(true);
    expect(shard.position.y).toBe(60);
    expect(Math.sin(shard.rotation)).toBeCloseTo(0);
    const x = shard.position.x;
    stepShard(shard, 300, TUNING, () => 60);
    expect(shard.position.x).toBe(x);
    expect(shardAlpha(shard, TUNING)).toBeCloseTo(0.5);
  });
});
