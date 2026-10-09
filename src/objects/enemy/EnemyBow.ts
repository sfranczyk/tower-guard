import { ENEMY_ATTACK } from '../../config';

const BOW_RAISE_MS = 220;
const BOW_LOWER_MS = 400;
/** The string eases back this fast (tension per ms) when the draw is let off. */
const EASE_OFF_MS = 200;

/** An archer's bow as the guest needs it: world aim angle, draw tension and how far it's raised (0..1). */
export interface BowNet {
  aim: number;
  tension: number;
  ready: number;
}

/**
 * An enemy archer's bow (pure): raised (0..1), the draw (0..1), the world aim angle and the pause between shots.
 * `draw` raises it, draws and says when the arrow goes; `relax` lowers it. Enemy turns and draws the archer with it.
 */
export class EnemyBow {
  public ready = 0;
  public tension = 0;
  public aimAngle = Math.PI;
  private cooldownMs = 0;

  /** One frame of aiming at `angle` (already slowed by the archer's afflictions): true on the frame it shoots. */
  public draw(angle: number, deltaMs: number): boolean {
    this.aimAngle = angle;
    this.cooldownMs = Math.max(0, this.cooldownMs - deltaMs);
    this.ready = Math.min(1, this.ready + deltaMs / BOW_RAISE_MS);
    if (this.ready < 1 || this.cooldownMs > 0) {
      this.tension = Math.max(0, this.tension - deltaMs / EASE_OFF_MS);
      return false;
    }
    this.tension = Math.min(1, this.tension + deltaMs / ENEMY_ATTACK.archerDrawMs);
    if (this.tension < 1) {
      return false;
    }
    this.tension = 0;
    this.cooldownMs = ENEMY_ATTACK.archerCooldownMs;
    return true;
  }

  /** Lowers the bow (walking, knocked down, no target). */
  public relax(deltaMs: number): void {
    this.cooldownMs = Math.max(0, this.cooldownMs - deltaMs);
    this.tension = Math.max(0, this.tension - deltaMs / EASE_OFF_MS);
    this.ready = Math.max(0, this.ready - deltaMs / BOW_LOWER_MS);
  }

  public get net(): BowNet {
    return { aim: this.aimAngle, tension: this.tension, ready: this.ready };
  }

  /** Co-op guest: the host's bow. */
  public apply(net: { aim: number; tension?: number; ready?: number }): void {
    this.aimAngle = net.aim;
    this.tension = net.tension ?? 0;
    this.ready = net.ready ?? 0;
  }
}
