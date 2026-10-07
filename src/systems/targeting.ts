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
