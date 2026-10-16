import { WIND_SHIFT } from '../config';

/**
 * Wind of a windy map (`Battleground.wind`, the strongest) in steps: WIND_STEPS each way and calm between (the status
 * line's one to three arrows). Rolled for each level, and every WIND_SHIFT.everyMs it may change by one step, by two,
 * or wildly (to any step three or more away). Pure; GameScene applies a change (arrows, aim, enemy archers, snow,
 * status) and the co-op host sends it to the guest.
 */

export const WIND_STEPS = 3;

/** The wind (px/s² on a normal arrow) of a step: −WIND_STEPS (strongest leftwards) to WIND_STEPS. */
export const windOfStep = (step: number, strongest: number): number => Math.round((step * strongest) / WIND_STEPS);

/** The step nearest to a wind. */
export const stepOfWind = (wind: number, strongest: number): number =>
  strongest > 0 ? Math.round((wind / strongest) * WIND_STEPS) : 0;

/** A fresh wind for a level: any step, calm included, equally likely. */
export const rollWind = (strongest: number, random: () => number = Math.random): number =>
  windOfStep(Math.floor(random() * (2 * WIND_STEPS + 1)) - WIND_STEPS, strongest);

/**
 * One change chance: by one step (WIND_SHIFT.stepChance), by two (bigChance), wildly (wildChance), else none
 * (undefined). The direction is random where both ways stay on the scale.
 */
export const shiftedStep = (step: number, random: () => number = Math.random): number | undefined => {
  const roll = random();
  const { stepChance, bigChance, wildChance } = WIND_SHIFT;
  const fits = roll < stepChance
    ? (distance: number) => distance === 1
    : roll < stepChance + bigChance
      ? (distance: number) => distance === 2
      : roll < stepChance + bigChance + wildChance
        ? (distance: number) => distance >= 3
        : undefined;
  if (!fits) {
    return undefined;
  }
  const options: number[] = [];
  for (let next = -WIND_STEPS; next <= WIND_STEPS; next += 1) {
    if (fits(Math.abs(next - step))) {
      options.push(next);
    }
  }
  return options.length > 0 ? options[Math.min(options.length - 1, Math.floor(random() * options.length))] : undefined;
};

/** Gives the wind a change chance every WIND_SHIFT.everyMs. */
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
    const next = shiftedStep(stepOfWind(current, this.strongest), this.random);
    return next === undefined ? undefined : windOfStep(next, this.strongest);
  }
}
