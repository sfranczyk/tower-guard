import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import { createRandom } from '../utils/math';
import { STICKMAN_HEAD } from './stickman';
import { getFallPose } from './stickmanFall';

/**
 * Explosive death: the stickman is blown into pieces (head, torso, upper/lower arms and legs) that
 * fly away from the blast, spin, fall, bounce and come to rest on the ground, with a spray of blood.
 *
 * Sprite space matches drawStickman with originY 0 (hip at 0,0, ground at y ≈ 58, facing +x).
 * The simulation is deterministic for a given seed so it can be tested and replayed.
 */

export const GIB_GROUND_Y = 58;
/** Gravity in sprite units (the enemy sprite is drawn at ~1/3 scale, so this matches ~700 px/s² in the world). */
const GIB_GRAVITY = 1800;
const BOUNCE = 0.32;
const GROUND_FRICTION = 0.72;
const SPIN_DAMPING = 0.6;
const BLOOD_DROPS = 26;

export interface GibPiece {
  /** Centre of the piece. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  /** Segment length (0 for the head). */
  length: number;
  /** Head radius (0 for segments). */
  radius: number;
  /** Drawn in the lighter "rear" colour. */
  rear: boolean;
  resting: boolean;
}

export interface BloodDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

export interface BloodStain {
  x: number;
  width: number;
}

const segment = (a: Vec2, b: Vec2, rear = false): Omit<GibPiece, 'vx' | 'vy' | 'spin'> => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  angle: Math.atan2(b.y - a.y, b.x - a.x),
  length: Math.hypot(b.x - a.x, b.y - a.y),
  radius: 0,
  rear,
  resting: false,
});

export class GibSimulation {
  public readonly pieces: GibPiece[];
  public readonly blood: BloodDrop[] = [];
  public readonly stains: BloodStain[] = [];
  public timeMs = 0;

  /**
   * @param blast where the explosion hit, in sprite space (default: front of the chest)
   * @param seed  randomness seed
   * @param force how hard the pieces are thrown (1 = default; the game randomises it)
   * @param lift  start this far above the standing pose (e.g. a rider blown off a flying dragon); the
   *              ground stays at GIB_GROUND_Y, so the pieces fall that much further
   */
  public constructor(blast: Vec2 = { x: 16, y: -20 }, seed = 1, force = 1, lift = 0) {
    const random = createRandom(seed);
    const standing = getFallPose('death', 0);
    const up = (point: Vec2): Vec2 => ({ x: point.x, y: point.y - lift });
    const pose = Object.fromEntries(Object.entries(standing).map(([key, value]) => [key, typeof value === 'number' ? value : up(value)])) as unknown as typeof standing;
    blast = up(blast);
    const shapes = [
      { ...segment(pose.hip, pose.neckTop), rear: false },
      { ...segment(pose.shoulder, pose.frontElbow) },
      { ...segment(pose.frontElbow, pose.frontHand) },
      { ...segment(pose.shoulder, pose.rearElbow, true) },
      { ...segment(pose.rearElbow, pose.rearHand, true) },
      { ...segment(pose.hip, pose.frontKnee) },
      { ...segment(pose.frontKnee, pose.frontFoot) },
      { ...segment(pose.hip, pose.rearKnee, true) },
      { ...segment(pose.rearKnee, pose.rearFoot, true) },
      { x: pose.head.x, y: pose.head.y, angle: 0, length: 0, radius: STICKMAN_HEAD.radius, rear: false, resting: false },
    ];
    this.pieces = shapes.map((shape) => {
      // Thrown away from the blast, with an upward kick and a random spin.
      const dx = shape.x - blast.x;
      const dy = shape.y - blast.y;
      const distance = Math.hypot(dx, dy) || 1;
      const speed = (160 + random() * 200) * force;
      return {
        ...shape,
        vx: (dx / distance) * speed + (random() - 0.5) * 60 * force,
        vy: (dy / distance) * speed - (260 + random() * 220) * Math.sqrt(force),
        spin: (random() - 0.5) * 26,
      };
    });
    for (let index = 0; index < BLOOD_DROPS; index += 1) {
      const angle = -Math.PI * random();
      const speed = 120 + random() * 340;
      this.blood.push({
        x: blast.x,
        y: blast.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        size: 1.5 + random() * 2.5,
      });
    }
  }

  /** True once every piece has come to rest. */
  public get settled(): boolean {
    return this.pieces.every((piece) => piece.resting);
  }

  /** Advances the simulation; large steps are split for stable bounces. */
  public step(deltaMs: number): void {
    let remaining = deltaMs / 1000;
    while (remaining > 0) {
      const dt = Math.min(remaining, 1 / 120);
      remaining -= dt;
      this.timeMs += dt * 1000;
      this.pieces.forEach((piece) => GibSimulation.stepPiece(piece, dt));
      this.stepBlood(dt);
    }
  }

  /** Lowest point of a piece (its contact point with the ground). */
  public static lowestY(piece: GibPiece): number {
    if (piece.radius > 0) {
      return piece.y + piece.radius;
    }
    return piece.y + Math.abs(Math.sin(piece.angle)) * piece.length / 2;
  }

  private static stepPiece(piece: GibPiece, dt: number): void {
    if (piece.resting) {
      return;
    }
    piece.vy += GIB_GRAVITY * dt;
    piece.x += piece.vx * dt;
    piece.y += piece.vy * dt;
    piece.angle += piece.spin * dt;

    const overlap = GibSimulation.lowestY(piece) - GIB_GROUND_Y;
    if (overlap <= 0) {
      return;
    }
    // Hit the ground: push out, bounce a little, slide with friction and tip over flat.
    piece.y -= overlap;
    if (piece.vy > 0) {
      piece.vy = -piece.vy * BOUNCE;
    }
    piece.vx *= GROUND_FRICTION;
    piece.spin *= SPIN_DAMPING;
    if (piece.radius === 0) {
      const flat = Math.round(piece.angle / Math.PI) * Math.PI;
      piece.angle += (flat - piece.angle) * Math.min(1, dt * 14);
    }
    if (Math.abs(piece.vy) < 40 && Math.abs(piece.vx) < 12 && Math.abs(piece.spin) < 0.6) {
      piece.vx = 0;
      piece.vy = 0;
      piece.spin = 0;
      if (piece.radius === 0) {
        piece.angle = Math.round(piece.angle / Math.PI) * Math.PI;
      }
      piece.y = GIB_GROUND_Y - (piece.radius || 0);
      piece.resting = true;
    }
  }

  private stepBlood(dt: number): void {
    for (let index = this.blood.length - 1; index >= 0; index -= 1) {
      const drop = this.blood[index];
      drop.vy += GIB_GRAVITY * dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      if (drop.y >= GIB_GROUND_Y) {
        this.stains.push({ x: drop.x, width: drop.size * 2.4 });
        this.blood.splice(index, 1);
      }
    }
  }
}

/** Draws the current state of a gib simulation with the skeleton look, plus blood. */
export const drawStickmanGibs = (sprite: Graphics, simulation: GibSimulation, originY = 0, append = false): void => {
  if (!append) {
    sprite.clear();
    sprite.rotation = 0;
    sprite.y = originY;
  }
  const skeleton = 0xf4f7fb;
  const rear = 0xb7c1d1;

  simulation.stains.forEach((stain) => {
    sprite.ellipse(stain.x, GIB_GROUND_Y, stain.width, 1.6).fill({ color: 0x7e2637, alpha: 0.75 });
  });

  // Rear pieces first, like drawStickman's layering.
  [...simulation.pieces].sort((a, b) => Number(b.rear) - Number(a.rear)).forEach((piece) => {
    const color = piece.rear ? rear : skeleton;
    if (piece.radius > 0) {
      sprite.circle(piece.x, piece.y, piece.radius).stroke({ width: 2, color });
      return;
    }
    const half = piece.length / 2;
    const ax = piece.x - Math.cos(piece.angle) * half;
    const ay = piece.y - Math.sin(piece.angle) * half;
    const bx = piece.x + Math.cos(piece.angle) * half;
    const by = piece.y + Math.sin(piece.angle) * half;
    sprite.moveTo(ax, ay).lineTo(bx, by)
      .stroke({ width: piece.rear ? 3 : 3.5, color, cap: 'round' });
    // Bloody stumps at both ends.
    sprite.circle(ax, ay, 2.2).fill({ color: 0xc33d48 });
    sprite.circle(bx, by, 2.2).fill({ color: 0xc33d48 });
  });

  simulation.blood.forEach((drop) => {
    sprite.circle(drop.x, drop.y, drop.size).fill({ color: 0xc33d48 });
  });
};
