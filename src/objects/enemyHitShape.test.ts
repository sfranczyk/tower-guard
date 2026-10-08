import { describe, expect, it } from 'vitest';
import { getFallPose } from '../rendering/stickmanFall';
import type { BodyTransform } from '../systems/bodyAnchor';
import { bodyBounds, headBounds, torsoOf } from './enemyHitShape';

const standing: BodyTransform = { x: 500, y: 480, scale: 2 / 3, bodyX: 0, bodyY: -25, rotation: 0, scaleX: -0.5, scaleY: 0.52 };

describe('enemy hit shape', () => {
  it('stands upright from the feet into the head box, with no gap at the neck', () => {
    const head = headBounds({ transform: standing, size: 1 });
    const body = bodyBounds({ transform: standing, size: 1 });
    expect(body.bottom).toBe(480);
    expect(body.width).toBe(14);
    expect(body.left).toBe(493);
    expect(body.top).toBeLessThan(head.bottom);
    expect(head.right - head.left).toBeCloseTo(2 * 10 * 0.5 * (2 / 3));
    expect(head.bottom).toBeLessThan(body.bottom);
  });

  it('grows with a bigger body', () => {
    expect(bodyBounds({ transform: { ...standing, scale: 1 }, size: 1.5 }).width).toBe(21);
  });

  it('follows a lying pose: wide and low', () => {
    const pose = getFallPose('death', 1);
    const body = bodyBounds({ transform: standing, size: 1, pose });
    expect(body.width).toBeGreaterThan(body.height);
    const head = headBounds({ transform: standing, size: 1, pose });
    expect(head.bottom).toBeGreaterThan(headBounds({ transform: standing, size: 1 }).bottom);
  });

  it('rides the torso of the pose, the standing one, or a flying torso piece', () => {
    expect(torsoOf(undefined)).toEqual({ hip: { x: 0, y: 0 }, shoulder: { x: 0, y: -35 } });
    const pose = getFallPose('death', 0.5);
    expect(torsoOf(pose)).toEqual({ hip: pose.hip, shoulder: pose.shoulder });
    const flying = torsoOf(pose, { x: 10, y: -20, angle: 0 });
    expect(flying.hip).toEqual({ x: 10 - 21.5, y: -20 });
    expect(flying.shoulder.x - flying.hip.x).toBeCloseTo(35);
  });
});
