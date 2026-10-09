import { FIRE_DRAGON_BREATH_INTERVAL_MS } from '../../config';
import { FIRE_BREATH_MS, isBreathingFire } from '../../rendering/dragonFire';

/** Local aim limits of the fire (radians, + = down) and how fast the head turns to follow. */
const FIRE_AIM_MIN = 0.2;
const FIRE_AIM_MAX = 1.25;
const FIRE_TURN_PER_S = 1.2;

/**
 * The fire dragon's breath (pure): time into the current breath (undefined between breaths), the wait until the next,
 * and the fire's local aim, turning towards its target while it breathes.
 */
export class DragonBreath {
  public timeMs?: number;
  public aim = 0.6;
  private target = 0.6;
  private cooldownMs = 0;

  /** Pouring out fire right now (past the rear-back). */
  public get isPouring(): boolean {
    return this.timeMs !== undefined && isBreathingFire(this.timeMs);
  }

  /** Aims at `localAngle` and, unless already breathing or still catching its breath, starts a breath. */
  public breathe(localAngle: number): void {
    this.target = Math.min(FIRE_AIM_MAX, Math.max(FIRE_AIM_MIN, localAngle));
    if (this.timeMs === undefined && this.cooldownMs <= 0) {
      this.timeMs = 0;
      this.aim = this.target;
      this.cooldownMs = FIRE_DRAGON_BREATH_INTERVAL_MS;
    }
  }

  /** Advances the breath (it runs to the end once started) and the wait until the next; the head follows the target. */
  public step(deltaMs: number): void {
    this.cooldownMs = Math.max(0, this.cooldownMs - deltaMs);
    if (this.timeMs === undefined) {
      return;
    }
    this.timeMs += deltaMs;
    const turn = (FIRE_TURN_PER_S * deltaMs) / 1000;
    this.aim += Math.max(-turn, Math.min(turn, this.target - this.aim));
    if (this.timeMs >= FIRE_BREATH_MS) {
      this.timeMs = undefined;
    }
  }

  /** The fire goes out (killed, or choked by turbulence). */
  public stop(): void {
    this.timeMs = undefined;
  }

  /** Co-op guest: the host's breath. */
  public apply(timeMs: number | undefined, aim: number): void {
    this.timeMs = timeMs;
    this.aim = aim;
    this.target = aim;
  }
}
