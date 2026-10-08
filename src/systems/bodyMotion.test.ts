import { describe, expect, it } from 'vitest';
import { BodyMotion } from './bodyMotion';
import { groundAt } from './terrain';

const X = 1000;

describe('BodyMotion', () => {
  it('flies a throw until it lands, then tells who asked once', () => {
    const motion = new BodyMotion();
    const landings: number[] = [];
    motion.onLanded = (speed) => landings.push(speed);
    motion.throw(X, groundAt(X), 150, -400, 10, 0);
    let step = motion.step(16, 0, 4000);
    expect(step.landed).toBe(false);
    expect(motion.flight!.y).toBeLessThan(groundAt(X));
    for (let i = 0; i < 400 && !step.landed; i += 1) {
      step = motion.step(16, 0, 4000);
    }
    expect(step.landed).toBe(true);
    expect(step.impactSpeed).toBeGreaterThan(300);
    expect(step.flight.x).toBeGreaterThan(X);
    motion.endFlight()?.(step.impactSpeed);
    expect(landings).toHaveLength(1);
    expect(motion.isThrown).toBe(false);
    expect(motion.endFlight()).toBeUndefined();
  });

  it('keeps a driven throw where the host put it, landing once it comes down at the ground', () => {
    const motion = new BodyMotion();
    motion.throw(X, groundAt(X) - 80, 100, 0, 5, 0);
    motion.placeFlight(X + 30, groundAt(X + 30) - 60, -1);
    let step = motion.step(16, 0, 4000, true);
    expect(step).toMatchObject({ landed: false, flight: { x: X + 30, y: groundAt(X + 30) - 60 } });
    expect(step.flight.rotation).not.toBe(0);
    motion.placeFlight(X + 40, groundAt(X + 40), 1);
    step = motion.step(16, 0, 4000, true);
    expect(step.landed).toBe(true);
  });

  it('never lands a driven throw that has no fall direction (a guest bowman lands when the host says)', () => {
    const motion = new BodyMotion();
    motion.throw(X, groundAt(X) - 10, 100, 0, 5, 0);
    motion.placeFlight(X, groundAt(X));
    expect(motion.step(16, 0, 4000, true).landed).toBe(false);
  });

  it('sends a rounded throw', () => {
    const motion = new BodyMotion();
    expect(motion.netThrow).toBeUndefined();
    motion.throw(X, 300, 123.6, -200, 9.87, 0);
    expect(motion.netThrow).toEqual({ vx: 124, spin: 9.9 });
  });

  it('pins for the longer time, says when a pin is fresh, and runs the time down', () => {
    const motion = new BodyMotion();
    expect(motion.pin(1000)).toBe(true);
    expect(motion.pin(500)).toBe(false);
    expect(motion.pinnedMs).toBe(1000);
    motion.tickPin(400);
    expect(motion.pinnedMs).toBe(600);
    motion.tickPin(1000);
    expect(motion.isPinned).toBe(false);
    expect(motion.pin(200)).toBe(true);
    motion.setPin(0);
    expect(motion.isPinned).toBe(false);
  });
});
