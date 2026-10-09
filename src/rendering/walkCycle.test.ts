import { describe, expect, it } from 'vitest';
import { MARCH_KNEE_MIN_BEND, WALK_CYCLE_PX, marchKneeBend, walkFoot, walkFrame } from './walkCycle';

const samples = Array.from({ length: 101 }, (_, index) => index / 100);
const fine = Array.from({ length: 1001 }, (_, index) => index / 1000);

describe('walk', () => {
  it('keeps the planted foot still on the ground: it slides back at the walk\'s own speed while flat', () => {
    // Flat on the ground between the roll and the heel rise.
    for (let u = 0.1; u < 0.42; u += 0.01) {
      const a = walkFoot(u);
      const b = walkFoot(u + 0.001);
      expect(a.lift).toBe(0);
      expect(a.pitch).toBe(0);
      expect((b.x - a.x) / 0.001).toBeCloseTo(-WALK_CYCLE_PX, 6);
    }
  });

  it('strikes with the heel (toe up) and pushes off from the toes (toe down)', () => {
    expect(walkFoot(0).pitch).toBeGreaterThan(0.2);
    expect(walkFoot(0.575).pitch).toBeLessThan(-0.5);
    expect(walkFoot(0.575).lift).toBeGreaterThan(3);
  });

  it('keeps the swinging foot low and never below the ground', () => {
    fine.forEach((u) => {
      const { lift } = walkFoot(u);
      expect(lift).toBeGreaterThanOrEqual(0);
      expect(lift).toBeLessThan(10);
    });
  });

  it('moves without a jump, round the loop too', () => {
    for (let i = 1; i < fine.length; i += 1) {
      const a = walkFoot(fine[i - 1]);
      const b = walkFoot(fine[i]);
      expect(Math.abs(b.x - a.x)).toBeLessThan(0.5);
      expect(Math.abs(b.lift - a.lift)).toBeLessThan(0.3);
      expect(Math.abs(b.pitch - a.pitch)).toBeLessThan(0.05);
    }
    const start = walkFrame(0);
    const end = walkFrame(1);
    expect(end.front.x).toBeCloseTo(start.front.x, 9);
    expect(end.hipY).toBeCloseTo(start.hipY, 9);
    expect(end.rearArm).toBeCloseTo(start.rearArm, 9);
  });

  it('always has a foot down, and both down for a moment after each step', () => {
    const down = (p: number): number => [walkFrame(p).front, walkFrame(p).rear].filter((foot) => foot.lift === 0 || foot.pitch > 0).length;
    fine.forEach((p) => expect(down(p)).toBeGreaterThanOrEqual(1));
    expect(fine.some((p) => down(p) === 2)).toBe(true);
  });

  it('lands the front foot at 0.5 and the rear one at 0, the hips highest over the planted foot', () => {
    expect(walkFrame(0.5).front.pitch).toBeCloseTo(0.3, 6);
    expect(walkFrame(0).rear.pitch).toBeCloseTo(0.3, 6);
    expect(walkFrame(0.29).hipY).toBeLessThan(walkFrame(0.04).hipY - 3);
  });

  it('swings the arms against the legs, bending the elbow more coming forward', () => {
    const { rearArm, elbowBend } = walkFrame(0.5);
    expect(rearArm).toBeGreaterThan(0.3);
    expect(elbowBend(rearArm)).toBeGreaterThan(elbowBend(-rearArm));
  });
});

describe('marchKneeBend', () => {
  it('never hyperextends the knee', () => {
    samples.forEach((progress) => {
      expect(marchKneeBend(progress, true)).toBeLessThan(0);
      expect(marchKneeBend(progress, false)).toBeLessThan(0);
    });
  });

  it('joins stance and swing without a jump', () => {
    expect(marchKneeBend(1, false)).toBeCloseTo(MARCH_KNEE_MIN_BEND);
    expect(marchKneeBend(0, true)).toBeCloseTo(MARCH_KNEE_MIN_BEND);
    expect(marchKneeBend(1, true)).toBeCloseTo(MARCH_KNEE_MIN_BEND);
    expect(marchKneeBend(0, false)).toBeCloseTo(MARCH_KNEE_MIN_BEND);
  });

  it('bends much more in the swing than in the stance', () => {
    expect(marchKneeBend(0.5, true)).toBeLessThan(marchKneeBend(0.5, false) - 0.4);
  });
});
