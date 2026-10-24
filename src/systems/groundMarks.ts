import type { Graphics } from 'pixi.js';
import { LEFTOVERS } from '../config';
import { leftoverAlpha, leftoverGone } from './leftovers';

/**
 * Marks left on the ground (blood stains, scorch marks): each fades and is gone `markMs` after it was made (config
 * LEFTOVERS, as corpses and stuck arrows). Host and co-op guest each age their own, as they draw their own.
 */
export class GroundMarks {
  private marks: { sprite: Graphics; ageMs: number }[] = [];

  public add(sprite: Graphics): void {
    this.marks.push({ sprite, ageMs: 0 });
  }

  public update(deltaMs: number): void {
    const { markMs, fadeMs } = LEFTOVERS;
    this.marks = this.marks.filter((mark) => {
      mark.ageMs += deltaMs;
      if (leftoverGone(mark.ageMs, markMs)) {
        mark.sprite.destroy();
        return false;
      }
      mark.sprite.alpha = leftoverAlpha(mark.ageMs, markMs, fadeMs);
      return true;
    });
  }
}
