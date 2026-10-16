/**
 * How far down the bandaging medic is over a loop (pure, tested; the lab and the design lab play it): kneels in
 * BANDAGE_KNEEL_MS, works, gets up in BANDAGE_KNEEL_MS. In the game the kneel follows the medic's own clock
 * (Enemy.bandage) instead.
 */
export const BANDAGE_KNEEL_MS = 350;
export const BANDAGE_LOOP_MS = 3600;

/** Kneel 0..1 at `ms` into the loop. */
export const bandageKneel = (ms: number): number => {
  const t = ((ms % BANDAGE_LOOP_MS) + BANDAGE_LOOP_MS) % BANDAGE_LOOP_MS;
  return Math.max(0, Math.min(1, t / BANDAGE_KNEEL_MS, (BANDAGE_LOOP_MS - t) / BANDAGE_KNEEL_MS));
};
