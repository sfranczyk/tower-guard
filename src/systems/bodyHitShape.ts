import { headCentre, PLAIN_HEAD, type HeadHit } from '../rendering/designs/skinKit';
import { STICKMAN_HEAD } from '../rendering/stickman';
import type { JointPose } from '../rendering/stickmanPose';
import type { Bounds, Vec2 } from '../types';
import { boundsAround } from '../utils/math';
import { spriteToWorld, type BodyTransform, type Torso } from './bodyAnchor';

/**
 * Where a stickman (ground enemy, soldier, bowman) can be hit, in world space (pure, tested): its head where its look
 * draws the skull, and its body round the joints of the pose drawn now (walking, swinging, kneeling, falling, lying);
 * the two touch at the neck and never overlap. Also the torso arrows stuck in it ride.
 */

/** How the figure is drawn now: its sprite's transform, its size (1 = a man), the pose drawn and the look's skull. */
export interface BodyShape {
  transform: BodyTransform;
  size: number;
  pose?: JointPose;
  head?: HeadHit;
}

/** The standing figure's hip and shoulder (sprite space), which stuck arrows ride when no joint pose is drawn. */
const STANDING_TORSO: Torso = { hip: { x: 0, y: 0 }, shoulder: { x: 0, y: -35 } };
/** Torso piece of a gib simulation is hip→neck top (43); anchors use hip→shoulder (35). */
const TORSO_TO_NECK = 43;
const TORSO_TO_SHOULDER = 35;
/** The body box reaches this far (sprite units) round the joints: the flesh and clothes on the bones. */
const BODY_PAD = 6;

const boxOf = (left: number, top: number, right: number, bottom: number): Bounds =>
  ({ x: left, y: top, width: right - left, height: bottom - top, left, right, top, bottom });

/** World units per sprite unit across the figure. */
const unitOf = ({ scaleX, scale }: BodyTransform): number => Math.abs(scaleX) * scale;

/** Box round the drawn skull (follows the pose, the look's head, scale and facing). */
export const headBounds = ({ transform, pose, head = PLAIN_HEAD }: BodyShape): Bounds => {
  const centre = pose ? headCentre(pose, head) : { x: STICKMAN_HEAD.x + head.fwd, y: STICKMAN_HEAD.y - head.up };
  return boundsAround([spriteToWorld(centre, transform)], head.radius * unitOf(transform));
};

/**
 * `body` cut back to `head`'s edge where they overlap, on the side the head is: off the top when it sits above (standing),
 * off a side when it lies beside it (lying). Arrows then hit one or the other, and the head wins a tie at the edge.
 */
export const separate = (body: Bounds, head: Bounds): Bounds => {
  const overlaps = body.left < head.right && head.left < body.right && body.top < head.bottom && head.top < body.bottom;
  if (!overlaps) {
    return body;
  }
  const dx = (head.left + head.right - body.left - body.right) / (body.width || 1);
  const dy = (head.top + head.bottom - body.top - body.bottom) / (body.height || 1);
  let { left, top, right, bottom } = body;
  if (Math.abs(dy) >= Math.abs(dx)) {
    if (dy < 0) {
      top = Math.min(head.bottom, bottom);
    } else {
      bottom = Math.max(head.top, top);
    }
  } else if (dx < 0) {
    left = Math.min(head.right, right);
  } else {
    right = Math.max(head.left, left);
  }
  return boxOf(left, top, right, bottom);
};

/** Box round the body (torso and legs of the drawn pose, or upright from the feet), up to the head's edge. */
export const bodyBounds = (shape: BodyShape): Bounds => {
  const { transform, pose, size } = shape;
  let body: Bounds;
  if (pose) {
    const points = [pose.hip, pose.shoulder, pose.neckTop, pose.frontKnee, pose.rearKnee, pose.frontFoot, pose.rearFoot];
    body = boundsAround(points.map((point) => spriteToWorld(point, transform)), BODY_PAD * unitOf(transform));
  } else {
    const width = 14 * size;
    const left = transform.x - width / 2;
    body = boxOf(left, transform.y - 34 * size, left + width, transform.y);
  }
  return separate(body, headBounds(shape));
};

/** The torso stuck arrows ride: the joint pose's, the standing figure's, or (blown apart) its flying torso piece. */
export const torsoOf = (pose: JointPose | undefined, torsoPiece?: { x: number; y: number; angle: number }): Torso => {
  if (torsoPiece) {
    const dir: Vec2 = { x: Math.cos(torsoPiece.angle), y: Math.sin(torsoPiece.angle) };
    const hip = { x: torsoPiece.x - (dir.x * TORSO_TO_NECK) / 2, y: torsoPiece.y - (dir.y * TORSO_TO_NECK) / 2 };
    return { hip, shoulder: { x: hip.x + dir.x * TORSO_TO_SHOULDER, y: hip.y + dir.y * TORSO_TO_SHOULDER } };
  }
  return pose ? { hip: pose.hip, shoulder: pose.shoulder } : STANDING_TORSO;
};
