import { describe, expect, it } from 'vitest';
import { frameLocalAngle, frameToLocal, frameToWorld, frameWorldAngle, type DragonFrame } from './dragonFrame';

const FRAMES: DragonFrame[] = [
  { x: 500, y: 200, rotation: 0, scaleX: 0.5, scaleY: 0.5, art: { x: 0, y: 0, rotation: 0 } },
  { x: 800, y: 150, rotation: 0.2, scaleX: -0.5, scaleY: 0.5, art: { x: 3, y: 40, rotation: 0.7 } },
];

describe('dragonFrame', () => {
  it('maps points to world and back', () => {
    FRAMES.forEach((frame) => {
      const local = { x: 30, y: -12 };
      const back = frameToLocal(frame, frameToWorld(frame, local));
      expect(back.x).toBeCloseTo(local.x);
      expect(back.y).toBeCloseTo(local.y);
    });
  });

  it('maps angles to local and back', () => {
    FRAMES.forEach((frame) => {
      expect(frameLocalAngle(frame, frameWorldAngle(frame, 0.6))).toBeCloseTo(0.6);
    });
  });

  it('mirrors the angle while facing left', () => {
    expect(frameLocalAngle(FRAMES[1], Math.PI + FRAMES[1].rotation)).toBeCloseTo(0);
  });
});
