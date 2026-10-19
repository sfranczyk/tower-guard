/**
 * The co-op room's seats, by player index: seat 0 is the host, a guest takes the lowest free one. Pure.
 * `present[i]` says whether seat i is taken (the host's always is).
 */

/** The lowest free seat for a new guest, or undefined when all `max` are taken. */
export const firstFreeSeat = (present: readonly boolean[], max: number): number | undefined => {
  for (let seat = 1; seat < max; seat += 1) {
    if (!present[seat]) {
      return seat;
    }
  }
  return undefined;
};

/** How many bowmen a battle needs: up to the last taken seat (a gap left mid-run keeps its bowman). */
export const seatCount = (present: readonly boolean[]): number => Math.max(1, present.lastIndexOf(true) + 1);

/** The taken seats in order: closing the gaps moves seat `order[i]` to seat i. */
export const compactOrder = (present: readonly boolean[]): number[] =>
  present.flatMap((taken, seat) => (taken || seat === 0 ? [seat] : []));

/** Whether there are gaps to close. */
export const hasGaps = (present: readonly boolean[]): boolean => compactOrder(present).length < seatCount(present);
