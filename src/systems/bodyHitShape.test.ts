import { describe, expect, it } from 'vitest';
import { archerBody, attackBody, bandageBody, castBody, runBody, standBody, walkBody } from '../rendering/designs/bodyPoses';
import { headCentre, PLAIN_HEAD, type HeadHit } from '../rendering/designs/skinKit';
import { getCheerPose } from '../rendering/stickmanCheer';
import { getFallPose, type FallKind } from '../rendering/stickmanFall';
import { getPinnedPose } from '../rendering/stickmanPinned';
import type { JointPose } from '../rendering/stickmanPose';
import type { Bounds } from '../types';
import { spriteToWorld, type BodyTransform } from './bodyAnchor';
import { bodyBounds, headBounds, separate, torsoOf } from './bodyHitShape';

const standing: BodyTransform = { x: 500, y: 480, scale: 2 / 3, bodyX: 0, bodyY: -27, rotation: 0, scaleX: -0.5, scaleY: 0.52 };
const box = (left: number, top: number, right: number, bottom: number): Bounds =>
  ({ x: left, y: top, width: right - left, height: bottom - top, left, right, top, bottom });
const overlap = (a: Bounds, b: Bounds): number =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/** Every pose the game draws a stickman in, a few frames each. */
const POSES: Record<string, (p: number) => JointPose> = {
  stand: () => standBody('overhead'),
  walk: (p) => walkBody(p, { lean: 0 }),
  march: (p) => walkBody(p, { lean: 0, style: 'march' }),
  zombie: (p) => walkBody(p, { lean: 0, zombie: true }),
  run: (p) => runBody(p, undefined, 0),
  overhead: (p) => attackBody(p, 'overhead'),
  uppercut: (p) => attackBody(p, 'uppercut'),
  twoHanded: (p) => attackBody(p, 'twoHanded'),
  swordRise: (p) => attackBody(p, 'swordRise'),
  thrust: (p) => attackBody(p, 'thrust'),
  grab: (p) => attackBody(p, 'grab'),
  cast: (p) => castBody(p),
  archer: (p) => archerBody(-0.4, p, 1),
  bandage: (p) => bandageBody(p, 0),
  pinned: (p) => getPinnedPose(p * 2800),
  cheer: (p) => getCheerPose('cheerJump', p * 1200),
  ...Object.fromEntries((['death', 'deathCrumple', 'deathStiff', 'knockback', 'getUp'] as FallKind[]).map((kind) => [kind, (p: number) => getFallPose(kind, p)])),
};
const HEADS: Record<string, HeadHit> = { plain: PLAIN_HEAD, goblin: { up: -4, fwd: 5, radius: 12 }, ogre: { up: -6, fwd: 4, radius: 9.5 } };

describe('body hit shape', () => {
  it('cuts the body off the top when the head is above, off the side when it lies beside', () => {
    expect(separate(box(0, 10, 20, 60), box(2, 0, 18, 15))).toEqual(box(0, 15, 20, 60));
    expect(separate(box(0, 0, 60, 20), box(55, 2, 70, 18))).toEqual(box(0, 0, 55, 20));
    expect(separate(box(0, 0, 60, 20), box(-10, 2, 5, 18))).toEqual(box(5, 0, 60, 20));
    expect(separate(box(0, 20, 20, 60), box(0, 0, 20, 15))).toEqual(box(0, 20, 20, 60));
  });

  it('standing: the body from the feet up to the head, touching at the neck', () => {
    const shape = { transform: standing, size: 1, pose: standBody('overhead') };
    const head = headBounds(shape);
    const body = bodyBounds(shape);
    expect(body.top).toBeCloseTo(head.bottom);
    expect(body.bottom).toBeGreaterThan(480);
    expect(head.right - head.left).toBeCloseTo(2 * 10 * 0.5 * (2 / 3));
  });

  it('the head box sits on the skull the look draws, wherever the pose puts it', () => {
    const pose = attackBody(0.55, 'twoHanded');
    const goblin = HEADS.goblin;
    const head = headBounds({ transform: standing, size: 1, pose, head: goblin });
    const skull = spriteToWorld(headCentre(pose, goblin), standing);
    expect((head.left + head.right) / 2).toBeCloseTo(skull.x);
    expect((head.top + head.bottom) / 2).toBeCloseTo(skull.y);
    expect(head.width).toBeCloseTo(2 * 12 * 0.5 * (2 / 3));
    // Leaning into the swing, the skull is well forward (facing left: −x) of where it is standing.
    const upright = headBounds({ transform: standing, size: 1, pose: standBody('overhead'), head: goblin });
    expect(head.right).toBeLessThan(upright.left + 2);
  });

  it('head and body never overlap, in every pose and look', () => {
    Object.entries(POSES).forEach(([name, poseAt]) => Object.entries(HEADS).forEach(([look, hit]) => {
      for (let i = 0; i <= 20; i++) {
        const shape = { transform: standing, size: 1.3, pose: poseAt(i / 20), head: hit };
        expect(overlap(headBounds(shape), bodyBounds(shape)), `${name} ${look} ${i}`).toBe(0);
      }
    }));
  });

  it('with no pose drawn: upright from the feet up to the head, which a bigger body scales', () => {
    const head = headBounds({ transform: standing, size: 1 });
    const body = bodyBounds({ transform: standing, size: 1 });
    expect(body.bottom).toBe(480);
    expect(body.width).toBe(14);
    expect(body.top).toBeCloseTo(head.bottom);
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
