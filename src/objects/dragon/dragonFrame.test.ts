import { describe, expect, it } from 'vitest';
import { frameAnchor, frameLocalAngle, frameToLocal, frameToWorld, frameWorldAngle, frameZoneBounds, resolveFrameAnchor, type DragonFrame } from './dragonFrame';

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

  it('anchors a point and angle that resolve back to where they were', () => {
    FRAMES.forEach((frame) => {
      const anchor = frameAnchor(frame, { x: 520, y: 190 }, 0.4);
      const { position, rotation } = resolveFrameAnchor(frame, anchor);
      expect(position.x).toBeCloseTo(520);
      expect(position.y).toBeCloseTo(190);
      expect(Math.cos(rotation - 0.4)).toBeCloseTo(1);
    });
  });

  it('boxes a zone round its world points, padded by the scale', () => {
    const frame = FRAMES[0];
    const bounds = frameZoneBounds(frame, { points: [{ x: 0, y: 0 }, { x: 20, y: 10 }], padding: 4, headshot: false, part: 'body' }, 0.5);
    expect(bounds.left).toBeCloseTo(500 - 2);
    expect(bounds.right).toBeCloseTo(510 + 2);
  });
});
