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

  it('after a shot keeps a held bow up while the string springs back', () => {
    const aim = new BowAim();
    aim.set({ x: 1, y: 0 }, 0.8);
    aim.raise(300);
    aim.loose();
    aim.held = true;
    expect(aim.power).toBe(0);
    expect(aim.shownTension).toBeCloseTo(0.8);
    aim.raise(45);
    expect(aim.shownTension).toBeCloseTo(0.3);
    // The string hand stays back while the string springs forward, then goes back to it.
    expect(aim.shownHand).toBeCloseTo(0.8);
    aim.raise(300);
    expect(aim.shownHand).toBeCloseTo(0.8);
    aim.raise(100);
    expect(aim.shownHand).toBeLessThan(0.8);
    aim.raise(500);
    expect(aim.shownHand).toBe(0);
    expect(aim.shownTension).toBe(0);
    expect(aim.ready).toBe(1);
    aim.held = false;
    aim.raise(380);
    expect(aim.ready).toBe(0);
  });

  it('hands out copies', () => {
    const aim = new BowAim();
    aim.snapshot().direction.x = 5;
    expect(aim.direction.x).toBe(1);
  });
});
