import type { Vec2 } from '../types';
import { createRandom } from '../utils/math';
import { DRAGON_COLORS, type DragonPose, type WingPose } from './dragon';
import { DEATH_GRAVITY } from './dragonRiderFall';
import { GIB_GROUND_Y } from './stickmanGibs';

/**
 * The exploded dragon (pure, sprite space, ground at GIB_GROUND_Y): about twenty-five polygon chunks cut from
 * the pose at the blast (each wing in four, the body in six wedges, neck and tail in short segments, the
 * head) thrown away from the blast. They bounce, then tip over to lie flat and stop. Seeded, so tests and
 * replays are deterministic.
 */

/** A chunk of the exploded dragon. */
export interface DragonPiece {
  /** Outline relative to the centre (unrotated). */
  outline: Vec2[];
  color: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  /** Angle at which it lies flat: long axis horizontal, broad side down (modulo 2π). */
  flatAngle: number;
  /** Has hit the ground at least once. */
  grounded: boolean;
  resting: boolean;
}

const BOUNCE = 0.3;
const FRICTION = 0.7;
const SPIN_DAMPING = 0.6;
/** How fast a chunk on the ground tips over to lie flat (1/s). */
const TIP_OVER = 16;

/** Centre of the body ellipse (radii 66 × 24, see drawDragon). */
const bodyCenter = (pose: DragonPose): Vec2 => ({ x: 0, y: 4 + pose.bob });

/** Splits a tapered band along `spine` into chunks of `perChunk` segments. */
const ribbonChunks = (spine: Vec2[], widthFrom: number, widthTo: number, perChunk: number): Vec2[][] => {
  const sides = spine.map((point, index) => {
    const next = spine[Math.min(spine.length - 1, index + 1)];
    const previous = spine[Math.max(0, index - 1)];
    const length = Math.hypot(next.x - previous.x, next.y - previous.y) || 1;
    const half = (widthFrom + ((widthTo - widthFrom) * index) / (spine.length - 1)) / 2;
    const normal = { x: -(next.y - previous.y) / length, y: (next.x - previous.x) / length };
    return {
      left: { x: point.x + normal.x * half, y: point.y + normal.y * half },
      right: { x: point.x - normal.x * half, y: point.y - normal.y * half },
    };
  });
  const chunks: Vec2[][] = [];
  for (let start = 0; start < spine.length - 1; start += perChunk) {
    const part = sides.slice(start, Math.min(spine.length, start + perChunk + 1));
    chunks.push([...part.map((side) => side.left), ...part.reverse().map((side) => side.right)]);
  }
  return chunks;
};

const wingChunks = (wing: WingPose): Vec2[][] => {
  const [trail0, trail1, trail2] = wing.trail;
  return [[wing.shoulder, wing.wrist, trail2], [wing.wrist, trail1, trail2], [wing.wrist, trail0, trail1], [wing.wrist, wing.tip, trail0]];
};

/** Six wedges of the body: the top ones in the body colour, the bottom ones in the belly colour. */
const bodyChunks = (pose: DragonPose): Array<{ outline: Vec2[]; color: number }> => {
  const center = bodyCenter(pose);
  return Array.from({ length: 6 }, (_, wedge) => {
    const from = -Math.PI / 2 + (wedge * Math.PI) / 3;
    const arc = Array.from({ length: 5 }, (__, index) => {
      const angle = from + (index * Math.PI) / 12;
      return { x: center.x + Math.cos(angle) * 66, y: center.y + Math.sin(angle) * 24 };
    });
    const middle = from + Math.PI / 6;
    return { outline: [center, ...arc], color: Math.sin(middle) > 0.1 ? DRAGON_COLORS.belly : DRAGON_COLORS.body };
  });
};

const headChunk = (pose: DragonPose): Vec2[] => {
  const nose = { x: Math.cos(pose.headTilt), y: Math.sin(pose.headTilt) };
  const along = (distance: number, side: number): Vec2 => ({
    x: pose.head.x + nose.x * distance - nose.y * side,
    y: pose.head.y + nose.y * distance + nose.x * side,
  });
  return [along(-10, -8), along(6, -9), along(30, -2), along(31, 3), along(6, 9), along(-10, 8)];
};

/** Angle of a shape's long (principal) axis. */
const principalAxis = (points: Vec2[]): number => {
  let xx = 0;
  let yy = 0;
  let xy = 0;
  points.forEach(({ x, y }) => {
    xx += x * x;
    yy += y * y;
    xy += x * y;
  });
  return Math.atan2(2 * xy, xx - yy) / 2;
};

export class DragonGibSimulation {
  public readonly pieces: DragonPiece[];
  public timeMs = 0;

  /** `pose` is the dragon at the blast, drawn with its origin at `offsetY`. */
  public constructor(pose: DragonPose, offsetY: number, seed = 3, force = 1) {
    const random = createRandom(seed);
    const neckChunks = ribbonChunks([{ x: 30, y: -2 + pose.bob }, ...pose.neck], 26, 13, 2);
    const tailChunks = ribbonChunks(pose.tail, 4, 22, 2);
    const shapes: Array<{ outline: Vec2[]; color: number }> = [
      ...wingChunks(pose.farWing).map((outline) => ({ outline, color: DRAGON_COLORS.wingFar })),
      ...tailChunks.map((outline, index) => ({ outline, color: index % 2 ? DRAGON_COLORS.body : DRAGON_COLORS.bodyDark })),
      ...bodyChunks(pose),
      ...neckChunks.map((outline, index) => ({ outline, color: index % 2 ? DRAGON_COLORS.bodyDark : DRAGON_COLORS.body })),
      { outline: headChunk(pose), color: DRAGON_COLORS.body },
      ...wingChunks(pose.nearWing).map((outline) => ({ outline, color: DRAGON_COLORS.wingNear })),
    ];
    const center = bodyCenter(pose);
    const blast = { x: center.x, y: center.y + offsetY };
    this.pieces = shapes.map(({ outline, color }) => {
      const points = outline.map((point) => ({ x: point.x, y: point.y + offsetY }));
      const middle = {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
      };
      const local = points.map((point) => ({ x: point.x - middle.x, y: point.y - middle.y }));
      const dx = middle.x - blast.x;
      const dy = middle.y - blast.y;
      const distance = Math.hypot(dx, dy) || 1;
      const speed = (70 + random() * 120) * force;
      return {
        outline: local,
        color,
        x: middle.x,
        y: middle.y,
        vx: (dx / distance) * speed + (random() - 0.5) * 60,
        vy: (dy / distance) * speed - (160 + random() * 180) * Math.sqrt(force),
        angle: 0,
        spin: (random() - 0.5) * 12,
        flatAngle: DragonGibSimulation.broadSideDown(local, -principalAxis(local)),
        grounded: false,
        resting: false,
      };
    });
  }

  public get settled(): boolean {
    return this.pieces.every((piece) => piece.resting);
  }

  public step(deltaMs: number): void {
    let remaining = deltaMs / 1000;
    while (remaining > 0) {
      const dt = Math.min(remaining, 1 / 120);
      remaining -= dt;
      this.timeMs += dt * 1000;
      this.pieces.forEach((piece) => DragonGibSimulation.stepPiece(piece, dt));
    }
  }

  /** Outline of a piece in sprite space (rotated and placed). */
  public static outlineOf(piece: DragonPiece): Vec2[] {
    const cos = Math.cos(piece.angle);
    const sin = Math.sin(piece.angle);
    return piece.outline.map((point) => ({ x: piece.x + point.x * cos - point.y * sin, y: piece.y + point.x * sin + point.y * cos }));
  }

  /** Of the two flat angles (`flat`, `flat` + π), the one with less of the shape below its centre. */
  private static broadSideDown(outline: Vec2[], flat: number): number {
    const depth = (angle: number): number =>
      Math.max(...outline.map((point) => point.x * Math.sin(angle) + point.y * Math.cos(angle)));
    return depth(flat) <= depth(flat + Math.PI) ? flat : flat + Math.PI;
  }

  /** How far below the ground a piece reaches (negative = above it). */
  private static sink(piece: DragonPiece): number {
    return Math.max(...DragonGibSimulation.outlineOf(piece).map((point) => point.y)) - GIB_GROUND_Y;
  }

  private static stepPiece(piece: DragonPiece, dt: number): void {
    if (piece.resting) {
      return;
    }
    piece.vy += DEATH_GRAVITY * dt;
    piece.x += piece.vx * dt;
    piece.y += piece.vy * dt;
    piece.angle += piece.spin * dt;
    // Once it has hit the ground it tips over onto its broad side (also between small bounces).
    const flat = piece.flatAngle + Math.round((piece.angle - piece.flatAngle) / (2 * Math.PI)) * 2 * Math.PI;
    if (piece.grounded) {
      piece.angle += (flat - piece.angle) * Math.min(1, TIP_OVER * dt);
    }
    const overlap = DragonGibSimulation.sink(piece);
    if (overlap <= 0) {
      return;
    }
    piece.grounded = true;
    piece.y -= overlap;
    if (piece.vy > 0) {
      piece.vy = -piece.vy * BOUNCE;
    }
    piece.vx *= FRICTION;
    piece.spin *= SPIN_DAMPING;
    if (Math.abs(piece.vy) < 40 && Math.abs(piece.vx) < 12 && Math.abs(piece.spin) < 0.6 && Math.abs(flat - piece.angle) < 0.02) {
      piece.angle = flat;
      piece.y -= DragonGibSimulation.sink(piece);
      piece.vx = 0;
      piece.vy = 0;
      piece.spin = 0;
      piece.resting = true;
    }
  }

}
