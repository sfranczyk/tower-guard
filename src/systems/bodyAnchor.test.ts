import { describe, expect, it } from 'vitest';
import { fromBodyAnchor, toBodyAnchor, type BodyTransform, type Torso } from './bodyAnchor';

const transform: BodyTransform = { x: 400, y: 490, scale: 2 / 3, bodyX: 0, bodyY: -25, rotation: -0.06, scaleX: -0.5, scaleY: 0.52 };
const standing: Torso = { hip: { x: 0, y: 0 }, shoulder: { x: 0, y: -35 } };

describe('body anchor', () => {
  it('round-trips a point and angle for the same pose', () => {
    const anchor = toBodyAnchor({ x: 405, y: 470 }, 0.3, transform, standing);
    const { position, rotation } = fromBodyAnchor(anchor, transform, standing);
    expect(position.x).toBeCloseTo(405);
    expect(position.y).toBeCloseTo(470);
    expect(Math.cos(rotation)).toBeCloseTo(Math.cos(0.3));
    expect(Math.sin(rotation)).toBeCloseTo(Math.sin(0.3));
  });

  it('follows the torso when the body lies down', () => {
    const upright: BodyTransform = { ...transform, rotation: 0, scaleX: 0.5 };
    // Arrow in the chest, flying horizontally (angle 0 = +x).
    const anchor = toBodyAnchor({ x: 400, y: 490 - 25 * (2 / 3) - 20 * 0.52 * (2 / 3) }, 0, upright, standing);
    // Torso now lying on its back: shoulder to the left of the hip.
    const lying: Torso = { hip: { x: 0, y: 47 }, shoulder: { x: -35, y: 47 } };
    const { position, rotation } = fromBodyAnchor(anchor, upright, lying);
    // The chest point moved left of the hip and the arrow turned from horizontal to vertical.
    expect(position.x).toBeLessThan(400);
    expect(Math.abs(Math.cos(rotation))).toBeLessThan(0.05);
  });

  it('stays on the same body side when the sprite is mirrored', () => {
    const anchor = toBodyAnchor({ x: 395, y: 470 }, Math.PI, transform, standing);
    expect(anchor.along).toBeGreaterThan(0);
    const { position } = fromBodyAnchor(anchor, transform, standing);
    expect(position.x).toBeCloseTo(395);
  });
});
