import { STICKMAN_HEAD } from '../rendering/stickman';
import type { FallPose } from '../rendering/stickmanFall';
import { spriteToWorld, type BodyTransform, type Torso } from '../systems/bodyAnchor';
import type { Bounds, Vec2 } from '../types';
import { boundsAround } from '../utils/math';

/**
 * Where a ground enemy can be hit, in world space (pure, tested): its head and its body, standing (an upright box from
 * the feet to the head) or as the joint pose it's falling, lying or flailing in; and the torso arrows stuck in it ride.
 */

/** How the enemy is drawn now: its sprite's transform, its size (1 = a man) and the joint pose, if it's in one. */
export interface EnemyShape {
  transform: BodyTransform;
  size: number;
  pose?: FallPose;
}

/** The standing figure's hip and shoulder (sprite space), which stuck arrows ride when no joint pose is drawn. */
const STANDING_TORSO: Torso = { hip: { x: 0, y: 0 }, shoulder: { x: 0, y: -35 } };
/** Torso piece of a gib simulation is hip→neck top (43); anchors use hip→shoulder (35). */
const TORSO_TO_NECK = 43;
const TORSO_TO_SHOULDER = 35;

/** Box around the drawn head (follows bob, lean, scale and falls). */
export const headBounds = ({ transform, pose }: EnemyShape): Bounds => {
  const center = spriteToWorld(pose ? pose.head : STICKMAN_HEAD, transform);
  return boundsAround([center], STICKMAN_HEAD.radius * Math.abs(transform.scaleX) * transform.scale);
};

/** Box around the body: the joints of a falling or lying pose, or upright from the feet up into the head box. */
export const bodyBounds = (shape: EnemyShape): Bounds => {
  const { transform, pose, size } = shape;
  if (pose) {
    const points = [pose.hip, pose.shoulder, pose.head, pose.frontKnee, pose.rearKnee, pose.frontFoot, pose.rearFoot];
    return boundsAround(points.map((point) => spriteToWorld(point, transform)), 2);
  }
  const width = 14 * size;
  // Reach up to (and 1 px into) the head box so there's no gap at the neck for arrows to slip through.
  const top = Math.min(transform.y - 28 * size, headBounds(shape).bottom - 1);
  const left = transform.x - width / 2;
  return { x: left, y: top, width, height: transform.y - top, left, right: left + width, top, bottom: transform.y };
};

/** The torso stuck arrows ride: the joint pose's, the standing figure's, or (blown apart) its flying torso piece. */
export const torsoOf = (pose: FallPose | undefined, torsoPiece?: { x: number; y: number; angle: number }): Torso => {
  if (torsoPiece) {
    const dir: Vec2 = { x: Math.cos(torsoPiece.angle), y: Math.sin(torsoPiece.angle) };
    const hip = { x: torsoPiece.x - (dir.x * TORSO_TO_NECK) / 2, y: torsoPiece.y - (dir.y * TORSO_TO_NECK) / 2 };
    return { hip, shoulder: { x: hip.x + dir.x * TORSO_TO_SHOULDER, y: hip.y + dir.y * TORSO_TO_SHOULDER } };
  }
  return pose ? { hip: pose.hip, shoulder: pose.shoulder } : STANDING_TORSO;
};
