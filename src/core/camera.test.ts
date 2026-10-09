import { describe, expect, it } from 'vitest';
import { CAMERA_LOOK, aimLookAhead, easeTowards, nextLookShift } from './camera';

const WIDTH = 1134;

describe('aimLookAhead', () => {
  it("doesn't move the view for a short shot", () => {
    expect(aimLookAhead(0, WIDTH)).toBe(0);
    expect(aimLookAhead(WIDTH * CAMERA_LOOK.deadZone, WIDTH)).toBe(0);
    expect(aimLookAhead(-150, WIDTH)).toBe(0);
  });

  it('slides more the farther the shot goes, towards it', () => {
    let previous = 0;
    for (let offset = 260; offset <= 1200; offset += 20) {
      const shift = aimLookAhead(offset, WIDTH);
      expect(shift).toBeGreaterThanOrEqual(previous);
      previous = shift;
    }
    expect(aimLookAhead(-600, WIDTH)).toBeCloseTo(-aimLookAhead(600, WIDTH));
  });

  it('brings a long shot into view with the bowman near the opposite edge, never past it', () => {
    const max = WIDTH / 2 - CAMERA_LOOK.edgeMargin;
    const far = WIDTH - 2 * CAMERA_LOOK.edgeMargin;
    expect(aimLookAhead(far, WIDTH)).toBeCloseTo(max);
    expect(aimLookAhead(3000, WIDTH)).toBeCloseTo(max);
    // In between the landing spot stays inside the view.
    [400, 600, 800].forEach((offset) => expect(offset - aimLookAhead(offset, WIDTH)).toBeLessThanOrEqual(WIDTH / 2 - CAMERA_LOOK.edgeMargin + 1e-9));
  });
});

describe('nextLookShift', () => {
  it('slides out further for a longer shot', () => {
    expect(nextLookShift(0, 120, 1)).toBe(120);
    expect(nextLookShift(120, 300, 1)).toBe(300);
    expect(nextLookShift(-120, -300, -1)).toBe(-300);
  });

  it("doesn't slide back in for a shorter shot the same way", () => {
    expect(nextLookShift(300, 120, 1)).toBe(300);
    expect(nextLookShift(300, 0, 1)).toBe(300);
    expect(nextLookShift(-300, -50, -1)).toBe(-300);
  });

  it('follows the new aim once he turns to aim the other way', () => {
    expect(nextLookShift(300, 0, -1)).toBe(0);
    expect(nextLookShift(300, -200, -1)).toBe(-200);
    expect(nextLookShift(-300, 150, 1)).toBe(150);
  });
});

describe('easeTowards', () => {
  it('moves part of the way, more over a longer time, independent of the frame rate', () => {
    const one = easeTowards(0, 100, 32, 300);
    const two = easeTowards(easeTowards(0, 100, 16, 300), 100, 16, 300);
    expect(one).toBeCloseTo(two, 9);
    expect(easeTowards(0, 100, 300, 300)).toBeCloseTo(100 * (1 - Math.exp(-1)));
    expect(easeTowards(0, 100, 100000, 300)).toBeCloseTo(100);
  });
});
