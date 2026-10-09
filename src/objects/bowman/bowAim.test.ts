import { describe, expect, it } from 'vitest';
import { BowAim } from './bowAim';

describe('BowAim', () => {
  it('normalizes the direction, clamps the power and keeps a zero direction out', () => {
    const aim = new BowAim();
    aim.set({ x: 0, y: -3 }, 1.5);
    expect(aim.direction).toEqual({ x: 0, y: -1 });
    expect(aim.power).toBe(1);
    aim.set({ x: 0, y: 0 }, -1);
    expect(aim.direction).toEqual({ x: 0, y: -1 });
    expect(aim.snapshot().strength).toEqual({ value: 0, max: 1, distance: 0 });
  });

  it('raises the bow while drawing and lowers it slower after', () => {
    const aim = new BowAim();
    aim.set({ x: 1, y: 0 }, 0.5);
    aim.raise(100);
    expect(aim.ready).toBeCloseTo(0.5);
    aim.raise(100);
    expect(aim.ready).toBe(1);
    aim.drop();
    expect(aim.ready).toBe(0);
    expect(aim.power).toBe(0);
  });

  it('hands out copies', () => {
    const aim = new BowAim();
    aim.snapshot().direction.x = 5;
    expect(aim.direction.x).toBe(1);
  });
});
