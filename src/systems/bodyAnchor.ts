import type { Vec2 } from '../types';

/**
 * Pins something (e.g. a stuck arrow) to a stickman's torso so it follows every pose: walking,
 * attacking, falling and lying. The anchor is stored relative to the hip→shoulder line in the body
 * sprite's own space, and resolved back to world space each frame from the current pose.
 */

/** Where the body sprite sits in the world: container position/scale plus the sprite's own transform. */
export interface BodyTransform {
  /** Owner container position (world). */
  x: number;
  y: number;
  /** Owner container scale (uniform). */
  scale: number;
  /** Body sprite position inside the container. */
  bodyX: number;
  bodyY: number;
  /** Body sprite rotation and scale (scaleX < 0 = mirrored). */
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/** Hip and shoulder of the current pose, in body-sprite space. */
export interface Torso {
  hip: Vec2;
  shoulder: Vec2;
}

export interface BodyAnchor {
  /** Distance along the hip→shoulder line. */
  along: number;
  /** Distance to the side of it (positive = to the left of hip→shoulder in sprite space). */
  side: number;
  /** Angle relative to the hip→shoulder direction. */
  angle: number;
}

const spriteToWorld = (point: Vec2, t: BodyTransform): Vec2 => {
  const x = point.x * t.scaleX;
  const y = point.y * t.scaleY;
  const cos = Math.cos(t.rotation);
  const sin = Math.sin(t.rotation);
  return {
    x: t.x + (t.bodyX + x * cos - y * sin) * t.scale,
    y: t.y + (t.bodyY + x * sin + y * cos) * t.scale,
  };
};

const worldToSprite = (point: Vec2, t: BodyTransform): Vec2 => {
  const qx = (point.x - t.x) / t.scale - t.bodyX;
  const qy = (point.y - t.y) / t.scale - t.bodyY;
  const cos = Math.cos(-t.rotation);
  const sin = Math.sin(-t.rotation);
  return {
    x: (qx * cos - qy * sin) / t.scaleX,
    y: (qx * sin + qy * cos) / t.scaleY,
  };
};

const spriteAngleToWorld = (angle: number, t: BodyTransform): number =>
  Math.atan2(Math.sin(angle) * t.scaleY, Math.cos(angle) * t.scaleX) + t.rotation;

const worldAngleToSprite = (angle: number, t: BodyTransform): number => {
  const relative = angle - t.rotation;
  return Math.atan2(Math.sin(relative) / t.scaleY, Math.cos(relative) / t.scaleX);
};

const torsoFrame = ({ hip, shoulder }: Torso): { u: Vec2; v: Vec2; angle: number } => {
  const dx = shoulder.x - hip.x;
  const dy = shoulder.y - hip.y;
  const length = Math.hypot(dx, dy) || 1;
  const u = { x: dx / length, y: dy / length };
  return { u, v: { x: -u.y, y: u.x }, angle: Math.atan2(u.y, u.x) };
};

/** Records a world point and angle relative to the torso of the current pose. */
export const toBodyAnchor = (point: Vec2, angle: number, transform: BodyTransform, torso: Torso): BodyAnchor => {
  const local = worldToSprite(point, transform);
  const { u, v, angle: torsoAngle } = torsoFrame(torso);
  const dx = local.x - torso.hip.x;
  const dy = local.y - torso.hip.y;
  return {
    along: dx * u.x + dy * u.y,
    side: dx * v.x + dy * v.y,
    angle: worldAngleToSprite(angle, transform) - torsoAngle,
  };
};

/** World position and angle of an anchor for the current pose. */
export const fromBodyAnchor = (
  anchor: BodyAnchor,
  transform: BodyTransform,
  torso: Torso,
): { position: Vec2; rotation: number } => {
  const { u, v, angle: torsoAngle } = torsoFrame(torso);
  const local = {
    x: torso.hip.x + u.x * anchor.along + v.x * anchor.side,
    y: torso.hip.y + u.y * anchor.along + v.y * anchor.side,
  };
  return {
    position: spriteToWorld(local, transform),
    rotation: spriteAngleToWorld(anchor.angle + torsoAngle, transform),
  };
};
