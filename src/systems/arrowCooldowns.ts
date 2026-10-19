import { ARROW_COOLDOWN } from '../config';
import type { ArrowType } from '../data/loadout';

/**
 * One player's arrow cooldowns: after a shot that type waits ARROW_COOLDOWN[type] seconds (read at the shot, so
 * `?tune` changes apply to the next one). Ticks with the battle (stops while paused).
 */
export class ArrowCooldowns {
  private readonly left = new Map<ArrowType, { ms: number; total: number }>();

  public tick(deltaMs: number): void {
    this.left.forEach((entry, type) => {
      entry.ms -= deltaMs;
      if (entry.ms <= 0) {
        this.left.delete(type);
      }
    });
  }

  /** Ready to loose, or at most `slackMs` from it. */
  public ready(type: ArrowType, slackMs = 0): boolean {
    return (this.left.get(type)?.ms ?? 0) <= slackMs;
  }

  public start(type: ArrowType): void {
    const total = ARROW_COOLDOWN[type] * 1000;
    if (total > 0) {
      this.left.set(type, { ms: total, total });
    }
  }

  /** Share of the cooldown still to wait: 1 just after the shot, 0 when ready. */
  public remaining(type: ArrowType): number {
    const entry = this.left.get(type);
    return entry ? entry.ms / entry.total : 0;
  }
}
