import { FIRE_DRAGON_STRAFE, WORLD_WIDTH } from '../config';
import { FIRE_BREATH, FIRE_REACH } from '../rendering/dragonFire';
import { clamp } from '../utils/math';
import type { HoverSide } from './dragonFlight';

/**
 * The fire dragon's strafing run, as geometry (pure; systems/dragonManoeuvre.ts flies it): where it sets up and how
 * high, so that with the fire lit as it sets off the bowman ends up in the middle of the burnt strip. The stream
 * stays at the mouth and moves with it (rendering/dragonFire.ts), so the strip is the dragon's run shifted forward.
 * Tuning: FIRE_DRAGON_STRAFE.
 */

/** 'setup': flying to its start; 'rear': holding there, head reared back (the breath's wind-up); 'run': the pass; 'out': braking past him. */
export type StrafeStage = 'setup' | 'rear' | 'run' | 'out';

export interface StrafeState {
  stage: StrafeStage;
  /** The side of its target it starts on (it faces him, flying the other way, −side). */
  side: HoverSide;
  /** Time in the current stage (ms). */
  stageMs: number;
  /** The height (y) it flies the pass at. */
  y: number;
  /** Set on entering 'rear': the fire is to be lit (DragonEnemy takes it). */
  ignite: boolean;
}

/** Where the mouth is on the dragon (px, world scale): forward of its centre and below it. */
export interface MouthOffset {
  ahead: number;
  drop: number;
}

/** In front of the bowman, not past the enemy keep's side of the world. */
const EDGE_MARGIN = 70;

/** The stream's length in world px at `scale` (the dragon's draw scale). */
export const streamLength = (scale: number): number => FIRE_REACH * scale;

/** The pass's height (y): the mouth this far above `groundY` that the fire meets the ground at reachShare of the stream. */
export const strafeAltitude = (groundY: number, mouth: MouthOffset, stream: number): number =>
  groundY - FIRE_DRAGON_STRAFE.reachShare * stream * Math.sin(FIRE_DRAGON_STRAFE.aim) - mouth.drop;

/** How far ahead of the dragon's centre the fire meets the ground on the pass (px). */
export const groundReach = (mouth: MouthOffset, stream: number): number =>
  mouth.ahead + FIRE_DRAGON_STRAFE.reachShare * stream * Math.cos(FIRE_DRAGON_STRAFE.aim);

/** Distance flown from rest in `ms`, accelerating at accel up to speed (px). */
export const runDistance = (ms: number): number => {
  const { speed, accel } = FIRE_DRAGON_STRAFE;
  const t = Math.max(0, ms) / 1000;
  const toTop = speed / Math.max(1, accel);
  return t <= toTop ? 0.5 * accel * t * t : 0.5 * speed * toTop + speed * (t - toTop);
};

/** How long the burnt strip is (px): the pass flown while the fire pours out. */
export const stripLength = (): number => runDistance(FIRE_BREATH.flameMs);

/**
 * Where it sets up (x): it sets off as the flames come out, half the burnt strip plus its reach in front of
 * `targetX`, so he's in the strip's middle. On the player's side it may go up to edgeOut past the world's edge.
 */
export const strafeStartX = (targetX: number, side: HoverSide, reach: number): number =>
  clamp(unclampedStartX(targetX, side, reach), -FIRE_DRAGON_STRAFE.edgeOut, WORLD_WIDTH - EDGE_MARGIN);

const unclampedStartX = (targetX: number, side: HoverSide, reach: number): number =>
  targetX + side * (reach + stripLength() / 2);

/** The side it starts from: the one it's on now, unless the world's edge leaves no room there (and does on the other). */
export const strafeSide = (dragonX: number, targetX: number, reach: number): HoverSide => {
  const side: HoverSide = dragonX >= targetX ? 1 : -1;
  const roomy = (candidate: HoverSide): boolean =>
    Math.abs(strafeStartX(targetX, candidate, reach) - unclampedStartX(targetX, candidate, reach)) < 1;
  return roomy(side) || !roomy(-side as HoverSide) ? side : (-side as HoverSide);
};

/** At the end of a hover: a strafing run (true) or another hover point (false), by FIRE_DRAGON_STRAFE.weight. */
export const pickStrafe = (rng: () => number): boolean => rng() < FIRE_DRAGON_STRAFE.weight;

export const startStrafe = (side: HoverSide, y: number): StrafeState => ({ stage: 'setup', side, stageMs: 0, y, ignite: false });

/** The pass is over: the dragon (at `dragonX`) is passBeyond past its target and has stopped pouring fire. */
export const passDone = (strafe: StrafeState, dragonX: number, targetX: number): boolean =>
  (dragonX - targetX) * -strafe.side >= FIRE_DRAGON_STRAFE.passBeyond && strafe.stageMs >= FIRE_BREATH.flameMs + FIRE_BREATH.recoverMs;
