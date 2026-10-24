/**
 * How a leftover on the field (a corpse, a stuck arrow) fades (pure, tested): fully shown until `lifeMs − fadeMs`
 * after it was left, then fading to 0 at `lifeMs`, when it is gone.
 */
export const leftoverAlpha = (ageMs: number, lifeMs: number, fadeMs: number): number => {
  if (ageMs >= lifeMs) {
    return 0;
  }
  const fadeFrom = lifeMs - Math.max(0, fadeMs);
  return ageMs <= fadeFrom ? 1 : (lifeMs - ageMs) / (lifeMs - fadeFrom);
};

/** The leftover is gone (`ageMs` past its `lifeMs`). */
export const leftoverGone = (ageMs: number, lifeMs: number): boolean => ageMs >= lifeMs;
