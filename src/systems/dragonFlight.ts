import { DRAGON_ALTITUDE, DRAGON_HOVER_OFFSET, DRAGON_TURN_PAST, WORLD_WIDTH } from '../config';
import { clamp } from '../utils/math';

/**
 * Dragon flight as pure functions (objects/DragonEnemy.ts uses them): where it hovers, which side of its target
 * it keeps to, how it flies there (a killed dragon's fall is rendering/dragonDeath.ts).
 */

/** Keep at least this far in front of the bowman, and this far inside either edge of the world. */
const MIN_HOVER_GAP = 170;
const EDGE_MARGIN = 70;

/** Which side of its target a dragon hovers on: 1 = to the right (facing left), −1 = to the left (facing right). */
export type HoverSide = 1 | -1;

/** Where the dragon wants to hover: `offset` (default DRAGON_HOVER_OFFSET) from its target on `side`, inside the world. */
export const hoverX = (targetX: number, offset = DRAGON_HOVER_OFFSET, side: HoverSide = 1): number =>
  clamp(targetX + side * Math.max(MIN_HOVER_GAP, offset), EDGE_MARGIN, WORLD_WIDTH - EDGE_MARGIN);

/** Whether there is room to hover on `side` of the target (the world's edge doesn't push it too close or past). */
const fits = (targetX: number, offset: number, side: HoverSide): boolean =>
  (hoverX(targetX, offset, side) - targetX) * side >= MIN_HOVER_GAP;

/**
 * The side to hover on next: it keeps its side until the target gets DRAGON_TURN_PAST behind it (then it turns
 * round to face it), or until there's no room on that side by the world's edge (and there is on the other).
 */
export const nextHoverSide = (dragonX: number, targetX: number, side: HoverSide, offset = DRAGON_HOVER_OFFSET): HoverSide => {
  const behind = (targetX - dragonX) * side > DRAGON_TURN_PAST;
  const preferred: HoverSide = behind ? (-side as HoverSide) : side;
  if (fits(targetX, offset, preferred)) {
    return preferred;
  }
  const other = -preferred as HoverSide;
  return fits(targetX, offset, other) ? other : preferred;
};

/** Cruising height (default DRAGON_ALTITUDE) with a slow drift up and down (y, smaller = higher). */
export const cruiseAltitude = (timeMs: number, altitude = DRAGON_ALTITUDE): number => altitude + Math.sin(timeMs / 1300) * 12;

/** Moves `current` towards `target` at `speed` px/s without overshooting. */
export const flyTowards = (current: number, target: number, speed: number, deltaMs: number): number => {
  const step = (speed * deltaMs) / 1000;
  const gap = target - current;
  return Math.abs(gap) <= step ? target : current + Math.sign(gap) * step;
};

/**
 * The turn's progress: `facing` (−1 = left … 1 = right, drawn as the sprite's x scale) moves towards `towards`
 * over DRAGON_TURN_MS (`turnMs`) end to end, eased so the dragon swings round rather than snapping.
 */
export const stepFacing = (facing: number, towards: HoverSide, deltaMs: number, turnMs: number): number => {
  const step = (2 * deltaMs) / Math.max(1, turnMs);
  return Math.abs(towards - facing) <= step ? towards : facing + Math.sign(towards - facing) * step;
};

/** The x scale drawn for a `facing` mid-turn: eased, and never quite 0 (the sprite stays a sliver, not gone). */
export const facingScale = (facing: number): number => {
  const eased = Math.sin((clamp(facing, -1, 1) * Math.PI) / 2);
  return Math.abs(eased) < 0.06 ? (facing < 0 ? -0.06 : 0.06) : eased;
};
