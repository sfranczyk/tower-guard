import { WIND_SHIFT } from '../config';

/**
 * Wind of a windy map (`Battleground.wind`, the strongest): rolled for each level and, now and then, changing
 * mid-level (`WIND_SHIFT`). Pure; GameScene applies a change (arrows, aim, enemy archers, snow, status) and the co-op
 * host sends it to the guest.
 */

/** A fresh wind: direction and strength rolled up to the map's strongest (px/s² on a normal arrow). */
export const rollWind = (strongest: number, random: () => number = Math.random): number =>
  Math.round((random() * 2 - 1) * strongest);

/** A new wind that's noticeably different from `current` (at least WIND_SHIFT.minChange × strongest away). */
export const shiftedWind = (current: number, strongest: number, random: () => number = Math.random): number => {
  let next = rollWind(strongest, random);
  for (let tries = 0; tries < 8 && Math.abs(next - current) < WIND_SHIFT.minChange * strongest; tries += 1) {
    next = rollWind(strongest, random);
  }
  return next;
};

/** Every WIND_SHIFT.everyMs the wind has a WIND_SHIFT.chance of changing. */
export class WindShifts {
  private sinceMs = 0;

  public constructor(private readonly strongest: number, private readonly random: () => number = Math.random) {}

  /** The new wind when it changes this frame, else undefined (never on a calm map). */
  public update(deltaMs: number, current: number): number | undefined {
    if (this.strongest <= 0) {
      return undefined;
    }
    this.sinceMs += deltaMs;
    if (this.sinceMs < WIND_SHIFT.everyMs) {
      return undefined;
    }
    this.sinceMs -= WIND_SHIFT.everyMs;
    return this.random() < WIND_SHIFT.chance ? shiftedWind(current, this.strongest, this.random) : undefined;
  }
}
