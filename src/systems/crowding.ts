import { CROWD } from '../config';

/**
 * Keeping soldiers from piling up into one (pure, tested). Around each target the melee attackers on each side take
 * attack posts (`meleePosts`): CROWD.slotsPerSide posts CROWD.slotSpacing px apart from their reach, CROWD.perSlot to a
 * post; the rest queue behind, CROWD.queueSpacing px apart, and don't strike. Everyone not at an attack post keeps at
 * least CROWD.minGap px from the next one (`spreadApart`). A blow lands only in front of the attacker, between
 * CROWD.minReachShare of its strike reach and the full reach (`weaponReaches`): standing on it or behind it, it misses.
 */

export interface MeleeAttacker<T> {
  id: T;
  x: number;
  /** Who it goes for (the same object for everyone after the same target). */
  target: unknown;
  targetX: number;
  /** How close it comes to strike (EnemyAI's MELEE_REACH or its own `reach.bowman`). */
  reach: number;
}

export interface MeleePost {
  target: unknown;
  /** How far from the target, on its own side, it stands. */
  distance: number;
  /** At an attack post (may strike), or queuing behind. */
  attacks: boolean;
}

/** Each attacker's post: the nearest on each side of a target take the attack posts, the rest queue behind them. */
export const meleePosts = <T>(attackers: readonly MeleeAttacker<T>[]): Map<T, MeleePost> => {
  const posts = new Map<T, MeleePost>();
  const sideOf = (attacker: MeleeAttacker<T>): number => (attacker.x >= attacker.targetX ? 1 : -1);
  const perSlot = Math.max(1, Math.round(CROWD.perSlot));
  const slots = Math.max(0, Math.round(CROWD.slotsPerSide));
  const attackPlaces = slots * perSlot;
  const lastSlot = CROWD.slotSpacing * Math.max(0, slots - 1);
  const targets = new Set(attackers.map((attacker) => attacker.target));
  targets.forEach((target) => [1, -1].forEach((side) => {
    attackers
      .filter((attacker) => attacker.target === target && sideOf(attacker) === side)
      .sort((a, b) => Math.abs(a.x - a.targetX) - Math.abs(b.x - b.targetX))
      .forEach((attacker, rank) => {
        const attacks = rank < attackPlaces;
        const distance = attacks
          ? attacker.reach + CROWD.slotSpacing * Math.floor(rank / perSlot)
          : attacker.reach + lastSlot + CROWD.queueGap + CROWD.queueSpacing * (rank - attackPlaces);
        posts.set(attacker.id, { target, distance, attacks });
      });
  }));
  return posts;
};

/** Whether a blow from `attackerX`, facing `facing` (±1), with `strikeReach` reaches `targetX`. */
export const weaponReaches = (attackerX: number, facing: number, targetX: number, strikeReach: number): boolean => {
  const ahead = (targetX - attackerX) * Math.sign(facing || 1);
  return ahead >= strikeReach * CROWD.minReachShare && ahead <= strikeReach;
};

export interface Spreadable {
  x: number;
  /** Fighting at an attack post, down, frozen, pinned, swinging…: others move off it, it doesn't move. */
  fixed: boolean;
}

/**
 * One frame of moving apart: neighbours closer than CROWD.minGap step apart, each by at most `maxStep` px (the fixed
 * ones not at all). Returns the new x of each, in the order given; over a few frames a pile spreads into a row.
 */
export const spreadApart = (units: readonly Spreadable[], maxStep: number): number[] => {
  const xs = units.map((unit) => unit.x);
  const order = units.map((_, index) => index).sort((a, b) => units[a].x - units[b].x || a - b);
  const moved = units.map(() => 0);
  for (let k = 1; k < order.length; k += 1) {
    const left = order[k - 1];
    const right = order[k];
    const gap = xs[right] - xs[left];
    if (gap >= CROWD.minGap || (units[left].fixed && units[right].fixed)) {
      continue;
    }
    const need = CROWD.minGap - gap;
    // Both movable: half each; one fixed: the other takes it all.
    const leftShare = units[left].fixed ? 0 : units[right].fixed ? 1 : 0.5;
    const leftStep = Math.min(need * leftShare, maxStep - moved[left]);
    const rightStep = Math.min(need * (1 - leftShare), maxStep - moved[right]);
    xs[left] -= Math.max(0, leftStep);
    xs[right] += Math.max(0, rightStep);
    moved[left] += Math.max(0, leftStep);
    moved[right] += Math.max(0, rightStep);
  }
  return xs;
};
