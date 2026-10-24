/**
 * Which variant of a sound a play uses. Each variant has a weight (its relative chance; equal weights = uniform);
 * the variant played last is skipped while another one has weight, so the same take never plays twice in a row.
 * Pure: `random` is a number in [0, 1).
 */
export const pickVariant = (weights: readonly number[], last: number | undefined, random: number): number => {
  const usable = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0));
  const others = usable.map((weight, index) => (index === last ? 0 : weight));
  const pool = others.some((weight) => weight > 0) ? others : usable;
  const total = pool.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    return -1; // Every chance is 0: the sound stays silent.
  }
  let rest = random * total;
  for (let index = 0; index < pool.length; index += 1) {
    if (pool[index] <= 0) {
      continue;
    }
    rest -= pool[index];
    if (rest < 0) {
      return index;
    }
  }
  return pool.reduce((found, weight, index) => (weight > 0 ? index : found), -1);
};

/** Each variant's share of the weights (0..1), as shown in the sound test panel (the no-repeat rule aside). */
export const variantShares = (weights: readonly number[]): number[] => {
  const usable = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0));
  const total = usable.reduce((sum, weight) => sum + weight, 0);
  return usable.map((weight) => (total > 0 ? weight / total : 0));
};
