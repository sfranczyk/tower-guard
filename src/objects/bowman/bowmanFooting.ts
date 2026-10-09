import { GRAVITY, JUMP_BUFFER_MS, JUMP_SPEED } from '../../config';
import { walkSpeed } from '../../systems/bowmanMotion';
import { groundAt } from '../../systems/terrain';
import type { Rect, Vec2 } from '../../types';
import { clamp } from '../../utils/math';

/** A grounded bowman this close above the ground snaps onto it (walking downhill). */
const GROUND_SNAP = 4;

/**
 * The bowman on his feet (pure, tested): walking (at the frost's pace when chilled), jumping (a press is kept
 * JUMP_BUFFER_MS so it isn't lost just before landing), gravity, sticking to the wavy ground, and the board's edges.
 * Works on the position it is handed (the Bowman container).
 */
export class BowmanFooting {
  /** Signed walking speed (px/s). */
  public horizontalSpeed = 0;
  public verticalVelocity = 0;
  public jumpBuffer = 0;
  private readonly bounds: Rect;

  public constructor(bounds: Rect, private readonly bodyWidth: number) {
    this.bounds = { ...bounds };
  }

  /** Keeps `pos` on the board. */
  public constrain(pos: Vec2): void {
    const halfWidth = this.bodyWidth / 2;
    pos.x = clamp(pos.x, this.bounds.x + halfWidth, this.bounds.x + this.bounds.width - halfWidth);
  }

  /** The board's edges for his middle (a throw stays within them). */
  public get edges(): { min: number; max: number } {
    const halfWidth = this.bodyWidth / 2;
    return { min: this.bounds.x + halfWidth, max: this.bounds.x + this.bounds.width - halfWidth };
  }

  /** At the edge of the board with `direction` pointing out of it (he can't walk that way, and doesn't try). */
  public isAgainstEdge(x: number, direction: number): boolean {
    const { min, max } = this.edges;
    return (direction < 0 && x <= min) || (direction > 0 && x >= max);
  }

  /** Walks `direction` (−1..1) for `deltaSeconds`; in the keep or against the edge he just stands. */
  public move(pos: Vec2, direction: number, deltaSeconds: number, sprinting: boolean, maxSpeed: number, timeScale: number, inTower: boolean): void {
    const clampedDirection = clamp(direction, -1, 1);
    if ((inTower && clampedDirection === 0) || this.isAgainstEdge(pos.x, clampedDirection)) {
      this.horizontalSpeed = 0;
      return;
    }
    this.horizontalSpeed = walkSpeed(this.horizontalSpeed, clampedDirection, sprinting, deltaSeconds, maxSpeed, timeScale);
    pos.x += this.horizontalSpeed * deltaSeconds;
    this.constrain(pos);
  }

  /** Jump pressed: jumps now if on the ground, or as soon as he lands within JUMP_BUFFER_MS. */
  public jump(pos: Vec2): void {
    this.jumpBuffer = JUMP_BUFFER_MS;
    this.tryStartJump(pos);
  }

  /** Gravity and the ground for `deltaSeconds`; `held` (in the keep, or a vortex moving him) stops it all. */
  public updateVertical(pos: Vec2, deltaSeconds: number, held: boolean): void {
    if (held) {
      this.verticalVelocity = 0;
      this.jumpBuffer = 0;
      return;
    }
    this.jumpBuffer = Math.max(0, this.jumpBuffer - deltaSeconds * 1000);
    this.tryStartJump(pos);

    // Standing or walking: stick to the wavy ground both up and down hill (no micro-falls).
    const ground = groundAt(pos.x);
    if (this.verticalVelocity === 0 && pos.y >= ground - GROUND_SNAP) {
      pos.y = ground;
      return;
    }

    this.verticalVelocity += GRAVITY * deltaSeconds;
    pos.y += this.verticalVelocity * deltaSeconds;

    if (pos.y >= groundAt(pos.x) && this.verticalVelocity >= 0) {
      pos.y = groundAt(pos.x);
      this.verticalVelocity = 0;
    }
  }

  /** Stops dead (no walking, no rising or falling). */
  public stop(): void {
    this.horizontalSpeed = 0;
    this.verticalVelocity = 0;
  }

  private tryStartJump(pos: Vec2): void {
    if (this.jumpBuffer <= 0 || !this.isGrounded(pos)) {
      return;
    }
    this.verticalVelocity = -JUMP_SPEED;
    this.jumpBuffer = 0;
  }

  private isGrounded(pos: Vec2): boolean {
    return pos.y >= groundAt(pos.x) - 1.5 && this.verticalVelocity >= 0;
  }
}
