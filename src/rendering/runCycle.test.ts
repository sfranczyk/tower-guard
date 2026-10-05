import { describe, expect, it } from 'vitest';
import { RUN_GROUND_Y, STANCE_END, runBounce, runFoot } from './runCycle';

const LEG_LENGTH = 60;
const samples = Array.from({ length: 200 }, (_, index) => index / 200);

describe('runFoot', () => {
  it('keeps the stance foot on the ground, sliding back at constant speed', () => {
    const stance = samples.filter((p) => p < STANCE_END).map(runFoot);
    stance.forEach((foot) => expect(foot.lift).toBe(0));
    const steps = stance.slice(1).map((foot, index) => foot.x - stance[index].x);
    steps.forEach((step) => {
      expect(step).toBeLessThan(0);
      expect(step).toBeCloseTo(steps[0], 6);
    });
  });

  it('never goes below the ground', () => {
    samples.forEach((p) => expect(runFoot(p).lift).toBeGreaterThanOrEqual(0));
  });

  it('stays within leg reach from the hip, including the body bob', () => {
    samples.forEach((p) => {
      const foot = runFoot(p);
      const y = RUN_GROUND_Y - runBounce(p) - foot.lift;
      expect(Math.hypot(foot.x, y)).toBeLessThan(LEG_LENGTH);
    });
  });

  it('kicks the heel up behind and drives the knee forward', () => {
    const heelKick = runFoot(0.55);
    expect(heelKick.x).toBeLessThan(-15);
    expect(heelKick.lift).toBeGreaterThan(20);
    const kneeDrive = runFoot(0.72);
    expect(Math.abs(kneeDrive.x)).toBeLessThan(5);
    expect(kneeDrive.lift).toBeGreaterThan(25);
  });

  it('is continuous around the loop', () => {
    const end = runFoot(0.9999);
    const start = runFoot(0);
    expect(end.x).toBeCloseTo(start.x, 1);
    expect(end.lift).toBeCloseTo(start.lift, 1);
  });

  it('has a flight phase with both feet off the ground', () => {
    const flight = samples.filter((p) => runFoot(p).lift > 0 && runFoot(p + 0.5).lift > 0);
    expect(flight.length).toBeGreaterThan(0);
  });
});

describe('runBounce', () => {
  it('is lowest at mid-stance and highest in the flight phase', () => {
    expect(runBounce(STANCE_END / 2)).toBeGreaterThan(runBounce(STANCE_END + 0.05));
    expect(runBounce(0.45)).toBeCloseTo(0);
  });
});
