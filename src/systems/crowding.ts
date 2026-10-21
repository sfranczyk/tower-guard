import { CROWD } from '../config';

/**
 * Keeping soldiers from piling up into one (pure, tested). Around each target the melee attackers on each side take
 * attack posts (`meleePosts`): CROWD.slotsPerSide posts CROWD.slotSpacing px apart from their reach, CROWD.perSlot to a
 * post; the rest queue behind, CROWD.queueSpacing px apart, and don't strike. Units that keep hiding one another
 * (walking in step, standing in a pile) ease apart until both show (`spreadApart`); passing one is free. A blow lands only in front of the attacker, between
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
  /** Walking pace now (px/s, + to the right): the faster one ends up ahead when a pair is eased apart. */
  vx: number;
  /** Body width (px; bigger bodies cover more). */
  width: number;
  /** Fighting at an attack post, down, frozen, pinned, swinging…: others move off it, it doesn't move. */
  fixed: boolean;
  /** How long it has been hidden behind another (ms, from the last frame). */
  hiddenMs: number;
}

/** How close two bodies may come before one hides the other: CROWD.visibleShare of the narrower one's width. */
const visibleGap = (a: Spreadable, b: Spreadable): number => CROWD.visibleShare * Math.min(a.width, b.width);

/**
 * One frame of easing apart units that hide one another: a pair closer than `visibleGap` is hidden; once both have
 * been hidden for CROWD.hiddenMs (passing one another takes less) they step apart, up to `maxStep` px each, just until
 * both show; the faster goes ahead, the fixed don't move. Returns each one's new x and hidden time, in the order given.
 */
export const spreadApart = (units: readonly Spreadable[], maxStep: number, deltaMs: number): { xs: number[]; hiddenMs: number[] } => {
  const xs = units.map((unit) => unit.x);
  const close = (i: number, j: number): boolean =>
    !(units[i].fixed && units[j].fixed) && Math.abs(units[i].x - units[j].x) < visibleGap(units[i], units[j]);
  const hiddenMs = units.map((unit, i) => (units.some((_, j) => j !== i && close(i, j)) ? unit.hiddenMs + deltaMs : 0));
  const moved = units.map(() => 0);
  units.forEach((a, i) => units.forEach((b, j) => {
    if (j <= i || !close(i, j) || hiddenMs[i] < CROWD.hiddenMs || hiddenMs[j] < CROWD.hiddenMs) {
      return;
    }
    // The one walking more to the left goes left (at the same pace: the one already on the left).
    const iLeft = Math.abs(a.vx - b.vx) > 0.5 ? a.vx < b.vx : a.x < b.x || (a.x === b.x && i < j);
    const [left, right] = iLeft ? [i, j] : [j, i];
    const need = visibleGap(a, b) - (xs[right] - xs[left]);
    if (need <= 0) {
      return;
    }
    // Both movable: half each; one fixed: the other takes it all.
    const leftShare = units[left].fixed ? 0 : units[right].fixed ? 1 : 0.5;
    const leftStep = Math.max(0, Math.min(need * leftShare, maxStep - moved[left]));
    const rightStep = Math.max(0, Math.min(need * (1 - leftShare), maxStep - moved[right]));
    xs[left] -= leftStep;
    xs[right] += rightStep;
    moved[left] += leftStep;
    moved[right] += rightStep;
  }));
  return { xs, hiddenMs };
};
