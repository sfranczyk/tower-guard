import { MEDIC } from '../config';

/** Someone the medic could bandage: how much health he is missing, his share left, and whether he is a bowman. */
export interface PatientCandidate {
  missing: number;
  ratio: number;
  bowman: boolean;
}

/**
 * Whom the medic goes to (pure, tested; index into `candidates`, or undefined): a bowman below
 * `MEDIC.bowmanFirstBelow` of his health first, else whoever has the smallest share of health left; nobody missing
 * less than `MEDIC.minMissing`.
 */
export const pickPatient = (candidates: readonly PatientCandidate[]): number | undefined => {
  const rank = ({ ratio, bowman }: PatientCandidate): number => (bowman && ratio < MEDIC.bowmanFirstBelow ? ratio - 1 : ratio);
  let best: number | undefined;
  candidates.forEach((candidate, index) => {
    if (candidate.missing >= MEDIC.minMissing && (best === undefined || rank(candidate) < rank(candidates[best]))) {
      best = index;
    }
  });
  return best;
};

/** Health a bandage gives over `deltaMs` (never more than is missing). */
export const bandageHeal = (deltaMs: number, missing: number): number => Math.min(missing, (MEDIC.healPerSecond * deltaMs) / 1000);
