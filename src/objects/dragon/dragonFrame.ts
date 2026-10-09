import type { Vec2 } from '../../types';

/**
 * A dragon's two transforms (pure): the sprite's (position, tilt, scale; mirrored, scaleX < 0, while it faces left) and,
 * inside it, the art's own (moved while the corpse falls), so stuck arrows follow the falling body.
 */
export interface DragonFrame {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  art: { x: number; y: number; rotation: number };
}

/** Wraps an angle into (−π, π]. */
export const normalizeAngle = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Local (art) point to world. */
export const frameToWorld = (frame: DragonFrame, local: Vec2): Vec2 => {
  const { art } = frame;
  const artCos = Math.cos(art.rotation);
  const artSin = Math.sin(art.rotation);
  const moved = { x: art.x + local.x * artCos - local.y * artSin, y: art.y + local.x * artSin + local.y * artCos };
  const x = moved.x * frame.scaleX;
  const y = moved.y * frame.scaleY;
  const cos = Math.cos(frame.rotation);
  const sin = Math.sin(frame.rotation);
  return { x: frame.x + x * cos - y * sin, y: frame.y + x * sin + y * cos };
};

/** World point to local (art), the inverse of frameToWorld. */
export const frameToLocal = (frame: DragonFrame, world: Vec2): Vec2 => {
  const dx = world.x - frame.x;
  const dy = world.y - frame.y;
  const cos = Math.cos(-frame.rotation);
  const sin = Math.sin(-frame.rotation);
  const moved = { x: (dx * cos - dy * sin) / frame.scaleX - frame.art.x, y: (dx * sin + dy * cos) / frame.scaleY - frame.art.y };
  const artCos = Math.cos(-frame.art.rotation);
  const artSin = Math.sin(-frame.art.rotation);
  return { x: moved.x * artCos - moved.y * artSin, y: moved.x * artSin + moved.y * artCos };
};

/** A world angle in the sprite's own frame (its art faces +x; mirrored while it faces left). */
export const frameLocalAngle = (frame: DragonFrame, worldAngle: number): number =>
  normalizeAngle(frame.scaleX < 0 ? Math.PI - (worldAngle - frame.rotation) : worldAngle - frame.rotation);

/** A local angle back to world, the inverse of frameLocalAngle. */
export const frameWorldAngle = (frame: DragonFrame, localAngle: number): number =>
  frame.scaleX < 0 ? frame.rotation + Math.PI - localAngle : frame.rotation + localAngle;
