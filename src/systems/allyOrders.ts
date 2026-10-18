import { ALLIES, ENEMY_TOWER_X } from '../config';

/**
 * What the player's soldiers are told (pure, tested; the HUD's order button, key V cycles them): hold the line in front
 * of the keep (`ALLIES.holdX`, stepping out to fight what comes within `ALLIES.engageRange` of it), advance on the enemy
 * keep fighting whatever they meet, or fall back to the keep (`ALLIES.retreatX`, fighting only what reaches them).
 */
export type AllyOrder = 'hold' | 'advance' | 'retreat';

export const ALLY_ORDERS: readonly AllyOrder[] = ['hold', 'advance', 'retreat'];

export const ALLY_ORDER_LABELS: Readonly<Record<AllyOrder, string>> = {
  hold: 'Hold the line',
  advance: 'Advance',
  retreat: 'Fall back',
};

/** The order after `order` (the button cycles them). */
export const nextOrder = (order: AllyOrder): AllyOrder => ALLY_ORDERS[(ALLY_ORDERS.indexOf(order) + 1) % ALLY_ORDERS.length];

/** Advancing soldiers stop this far short of the enemy keep's centre. */
const ADVANCE_SHORT_OF_KEEP = 90;

/**
 * Where a soldier of `order` stands when no enemy is his to fight: the `rank`-th soldier (0 = front) a little behind
 * the one before, so they don't stand in each other.
 */
export const orderPost = (order: AllyOrder, rank = 0): number => {
  const front = order === 'hold' ? ALLIES.holdX : order === 'retreat' ? ALLIES.retreatX : ENEMY_TOWER_X - ADVANCE_SHORT_OF_KEEP;
  return front - rank * ALLIES.spacing;
};

/**
 * Which enemy (index into `foeXs`) a soldier at `allyX` goes for under `order`, with his post at `post` and his blow
 * reaching `reach`: the nearest of those his order lets him fight, or undefined (then he walks to his post).
 * - hold: within `ALLIES.engageRange` of the post, or already in reach;
 * - advance: any ahead of him (or in reach);
 * - retreat: only one in reach.
 */
export const pickFoe = (allyX: number, post: number, order: AllyOrder, foeXs: readonly number[], reach: number): number | undefined => {
  const allowed = (x: number): boolean => {
    if (Math.abs(x - allyX) <= reach) {
      return true;
    }
    if (order === 'advance') {
      return x > allyX;
    }
    return order === 'hold' && Math.abs(x - post) <= ALLIES.engageRange;
  };
  let best: number | undefined;
  foeXs.forEach((x, index) => {
    if (allowed(x) && (best === undefined || Math.abs(x - allyX) < Math.abs(foeXs[best] - allyX))) {
      best = index;
    }
  });
  return best;
};

/**
 * Banners: where the `rank`-th soldier (0 = front) stands escorting a comrade at `bearerX` who carries a banner home:
 * between him and the enemy, a little ahead of him.
 */
export const escortPost = (bearerX: number, rank = 0): number => bearerX + (rank + 1) * ALLIES.spacing;
