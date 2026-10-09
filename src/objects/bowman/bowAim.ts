import type { IPushStrength, Vec2 } from '../../types';
import { approach, clamp } from '../../utils/math';

/** Raising the bow when a draw starts, and lowering it after the shot. */
const BOW_RAISE_MS = 200;
const BOW_LOWER_MS = 380;

export interface BowmanAim {
  direction: Vec2;
  power: number;
  strength: IPushStrength;
}

/**
 * The bowman's aim and bow (pure, tested): the direction and power of the draw, and how far the bow is raised
 * (`ready`: 0 = held low, 1 = raised to aim; it follows whether the player is drawing).
 */
export class BowAim {
  public direction: Vec2 = { x: 1, y: 0 };
  public power = 0;
  private strength: IPushStrength = { value: 0, max: 1, distance: 0 };
  public ready = 0;

  public get angle(): number {
    return Math.atan2(this.direction.y, this.direction.x);
  }

  /** Aims along `direction` (kept if it is zero) with `power` (0..1). */
  public set(direction: Vec2, power: number): void {
    const length = Math.hypot(direction.x, direction.y);
    if (length > Number.EPSILON) {
      this.direction = { x: direction.x / length, y: direction.y / length };
    }
    this.power = clamp(power, 0, 1);
    this.strength = { value: this.power, max: 1, distance: this.power };
  }

  /** The draw is lost (frozen, caught, thrown, killed): no power, the bow down. */
  public drop(): void {
    this.power = 0;
    this.ready = 0;
  }

  /** Not drawing: carries the bow pointing the way he faces (±1). */
  public carry(facing: number): void {
    this.direction = { x: facing, y: 0 };
  }

  /** The bow comes up while the player draws and goes back down after the shot. */
  public raise(deltaMs: number): void {
    const drawing = this.power > 0;
    this.ready = approach(this.ready, drawing ? 1 : 0, deltaMs / (drawing ? BOW_RAISE_MS : BOW_LOWER_MS));
  }

  /** A copy for callers. */
  public snapshot(): BowmanAim {
    return { direction: { ...this.direction }, power: this.power, strength: { ...this.strength } };
  }
}
