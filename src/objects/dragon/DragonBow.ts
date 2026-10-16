import { DRAGON_DRAW_MS, DRAGON_FLIGHT, DRAGON_SHOT_INTERVAL_MS } from '../../config';

const RELAX_MS = 400;

/**
 * The dragon archer's bow (pure): world aim angle and draw. It looses every DRAGON_SHOT_INTERVAL_MS, drawing over the
 * last DRAGON_DRAW_MS of it.
 */
export class DragonBow {
  public aimAngle = Math.PI;
  public tension = 0;
  private shotTimerMs = DRAGON_SHOT_INTERVAL_MS * 0.5;

  /**
   * One frame of aiming at `worldAngle` (already slowed by afflictions): true on the frame the arrow is loosed.
   * `pace` < 1 (in flight) brings the next shot round slower.
   */
  public draw(worldAngle: number, deltaMs: number, pace = 1): boolean {
    this.aimAngle = worldAngle;
    this.shotTimerMs -= deltaMs * pace;
    this.tension = Math.max(0, Math.min(1, 1 - this.shotTimerMs / DRAGON_DRAW_MS));
    if (this.shotTimerMs > 0) {
      return false;
    }
    this.shotTimerMs = DRAGON_SHOT_INTERVAL_MS;
    this.tension = 0;
    return true;
  }

  /** The dragon was hit: the rider loses his draw a little (DRAGON_FLIGHT.hitShotDelayMs later). */
  public flinch(): void {
    if (this.shotTimerMs < DRAGON_DRAW_MS) {
      this.shotTimerMs = Math.min(DRAGON_DRAW_MS, this.shotTimerMs + DRAGON_FLIGHT.hitShotDelayMs);
      this.tension = Math.max(0, Math.min(1, 1 - this.shotTimerMs / DRAGON_DRAW_MS));
    }
  }

  /** Out of range or turning: ease the string back. */
  public relax(deltaMs: number): void {
    this.tension = Math.max(0, this.tension - deltaMs / RELAX_MS);
    this.shotTimerMs = Math.max(this.shotTimerMs, DRAGON_DRAW_MS);
  }
}
