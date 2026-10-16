/**
 * Which bowman an enemy goes for (pure, tested). With two players each enemy picks the nearest bowman who is
 * alive and out in the open; when there's none (all hiding in the keep, or dead) it goes for the keep.
 */

export interface TargetCandidate {
  readonly x: number;
  readonly isInTower: boolean;
  readonly isDead: boolean;
}

/** The nearest exposed, living bowman to `fromX`, or undefined (then the keep is the target). */
export const nearestExposedBowman = <T extends TargetCandidate>(bowmen: readonly T[], fromX: number): T | undefined =>
  bowmen
    .filter((bowman) => !bowman.isDead && !bowman.isInTower)
    .reduce<T | undefined>((best, bowman) => (!best || Math.abs(bowman.x - fromX) < Math.abs(best.x - fromX) ? bowman : best), undefined);

/** Bowmen still standing (for "is anyone left?" and the like). */
export const livingBowmen = <T extends TargetCandidate>(bowmen: readonly T[]): T[] => bowmen.filter((bowman) => !bowman.isDead);

/** One of the player's soldiers as an enemy sees him. */
export interface AllyCandidate {
  readonly x: number;
  isAlive(): boolean;
}

/** What a melee enemy goes for: a bowman out in the open or a soldier, whichever is nearer. */
export type MeleeTarget<B, A> = { bowman: B; ally?: undefined } | { ally: A; bowman?: undefined };

/**
 * The nearest exposed, living bowman or living soldier to `fromX` (soldiers standing in front of the bowman stop the
 * enemies there), or undefined (then the keep is the target).
 */
export const nearestMeleeTarget = <B extends TargetCandidate, A extends AllyCandidate>(
  bowmen: readonly B[], allies: readonly A[], fromX: number,
): MeleeTarget<B, A> | undefined => {
  const bowman = nearestExposedBowman(bowmen, fromX);
  const ally = allies
    .filter((candidate) => candidate.isAlive())
    .reduce<A | undefined>((best, candidate) => (!best || Math.abs(candidate.x - fromX) < Math.abs(best.x - fromX) ? candidate : best), undefined);
  if (ally && (!bowman || Math.abs(ally.x - fromX) < Math.abs(bowman.x - fromX))) {
    return { ally };
  }
  return bowman ? { bowman } : undefined;
};
