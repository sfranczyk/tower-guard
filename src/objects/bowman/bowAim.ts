import type { IPushStrength, Vec2 } from '../../types';
import { approach, clamp } from '../../utils/math';

/** Raising the bow when a draw starts, and lowering it after the shot. */
const BOW_RAISE_MS = 200;
const BOW_LOWER_MS = 380;
/** After a loosed shot (`loose`), the string springs back straight this fast. */
const STRING_SNAP_MS = 90;

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
  /** Kept raised (`ready` → 1) without a draw, as after a shot until the next draw. */
  public held = false;
  /** The string's tension still showing after `loose` (no arrow on it), springing back to 0. */
  public slack = 0;

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
    this.slack = 0;
    this.held = false;
  }

  /** The arrow is away: the draw ends, the string springs back from where it was (see `slack`). */
  public loose(): void {
    this.slack = this.power;
    this.power = 0;
  }

  /** The string tension to draw: the draw, or the slack springing back after a shot. */
  public get shownTension(): number {
    return this.power > 0 ? this.power : this.slack;
  }

  /** Not drawing: carries the bow pointing the way he faces (±1). */
  public carry(facing: number): void {
    this.direction = { x: facing, y: 0 };
  }

  /** The bow comes up while the player draws and goes back down after the shot. */
  public raise(deltaMs: number): void {
    const drawing = this.power > 0 || this.held;
    this.slack = approach(this.slack, 0, deltaMs / STRING_SNAP_MS);
    this.ready = approach(this.ready, drawing ? 1 : 0, deltaMs / (drawing ? BOW_RAISE_MS : BOW_LOWER_MS));
  }

  /** A copy for callers. */
  public snapshot(): BowmanAim {
    return { direction: { ...this.direction }, power: this.power, strength: { ...this.strength } };
  }
}
