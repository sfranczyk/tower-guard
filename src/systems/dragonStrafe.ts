import { FIRE_DRAGON_STRAFE } from '../config';
import { FIRE_BREATH, FIRE_REACH } from '../rendering/dragonFire';
import { clamp } from '../utils/math';
import type { HoverSide } from './dragonFlight';
import { worldWidth } from './battlefield';

/**
 * The fire dragon's strafing run, as geometry (pure; systems/dragonManoeuvre.ts flies it): where it starts and how
 * low it flies the pass, so that with the fire lit as it sets off (rearing its head while it dives to the pass's
 * height, the flames out after the wind-up) the bowman ends up in the middle of the burnt strip. The stream
 * stays at the mouth and moves with it (rendering/dragonFire.ts), so the strip is the dragon's run shifted forward.
 * Tuning: FIRE_DRAGON_STRAFE.
 */

/**
 * 'lurk': flying to its start (higher, a hover point like any other) and waiting there a moment; 'run': the pass,
 * diving to its height; 'out': braking past him.
 */
export type StrafeStage = 'lurk' | 'run' | 'out';

export interface StrafeState {
  stage: StrafeStage;
  /** The side of its target it starts on (it faces him, flying the other way, −side). */
  side: HoverSide;
  /** Time in the current stage (ms). */
  stageMs: number;
  /** The height (y) it flies the pass at. */
  y: number;
  /** Lurking: at its start, and how long it still waits there (ms). */
  arrived: boolean;
  lurkLeftMs: number;
  /** Lurking: where it waits (x; it never backs away from its target, only follows him), and where he was then. */
  startX: number;
  lurkTargetX: number;
  /** Lurking: he came at it, so it sets off as soon as it faces him. */
  go: boolean;
  /** Set on setting off: the fire is to be lit (DragonEnemy takes it). */
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

/** How long the burnt strip is (px): the pass flown while the fire pours out (after the wind-up). */
export const stripLength = (): number =>
  runDistance(FIRE_BREATH.windUpMs + FIRE_BREATH.flameMs) - runDistance(FIRE_BREATH.windUpMs);

/** How far in front of its target it starts a pass (px): its reach, the wind-up's flight and half the strip. */
export const strafeDistance = (reach: number): number => reach + runDistance(FIRE_BREATH.windUpMs) + stripLength() / 2;

/**
 * Where it starts a pass (x), strafeDistance in front of `targetX`, so he's in the strip's middle. On the player's
 * side it may go up to edgeOut past the world's edge.
 */
export const strafeStartX = (targetX: number, side: HoverSide, reach: number): number =>
  clamp(unclampedStartX(targetX, side, reach), -FIRE_DRAGON_STRAFE.edgeOut, worldWidth() - EDGE_MARGIN);

const unclampedStartX = (targetX: number, side: HoverSide, reach: number): number => targetX + side * strafeDistance(reach);

/** The side it starts from: the one it's on now, unless the world's edge leaves no room there (and does on the other). */
export const strafeSide = (dragonX: number, targetX: number, reach: number): HoverSide => {
  const side: HoverSide = dragonX >= targetX ? 1 : -1;
  const roomy = (candidate: HoverSide): boolean =>
    Math.abs(strafeStartX(targetX, candidate, reach) - unclampedStartX(targetX, candidate, reach)) < 1;
  return roomy(side) || !roomy(-side as HoverSide) ? side : (-side as HoverSide);
};

/** At the end of a hover: a strafing run (true) or another hover point (false), by FIRE_DRAGON_STRAFE.weight. */
export const pickStrafe = (rng: () => number): boolean => rng() < FIRE_DRAGON_STRAFE.weight;

/** Whether a dragon at `dragonX` is close enough to its start to set off right away (readyRange). */
export const readyToStrafe = (dragonX: number, targetX: number, side: HoverSide, reach: number): boolean =>
  Math.abs(dragonX - strafeStartX(targetX, side, reach)) <= FIRE_DRAGON_STRAFE.readyRange;

/** A pass at `targetX`: lurking first, or (`now`) setting off right away. */
export const startStrafe = (
  side: HoverSide, targetX: number, reach: number, y: number, now: boolean, rng: () => number,
): StrafeState => ({
  stage: now ? 'run' : 'lurk', side, stageMs: 0, y, arrived: false, ignite: now,
  startX: strafeStartX(targetX, side, reach), lurkTargetX: targetX, go: false,
  lurkLeftMs: FIRE_DRAGON_STRAFE.lurkMinMs + rng() * Math.max(0, FIRE_DRAGON_STRAFE.lurkMaxMs - FIRE_DRAGON_STRAFE.lurkMinMs),
});

/**
 * Lurking, one frame: its start follows the target when he moves away but never backs off when he comes closer;
 * true when it should set off rather than retreat: he came closer by readyRange, or ran under it to its other side
 * (then it turns to face him first).
 */
export const lurkStep = (strafe: StrafeState, dragonX: number, targetX: number, reach: number): boolean => {
  if ((dragonX - targetX) * strafe.side < 0) {
    strafe.side = -strafe.side as HoverSide;
    strafe.startX = dragonX;
    return true;
  }
  const wanted = strafeStartX(targetX, strafe.side, reach);
  if ((wanted - strafe.startX) * strafe.side < 0) {
    strafe.startX = wanted;
  }
  return (targetX - strafe.lurkTargetX) * strafe.side > FIRE_DRAGON_STRAFE.readyRange;
};

/** Flying at `vx` it has to brake now not to stop past edgeOut beyond the world's edge (or the far edge's margin). */
export const nearWorldEdge = (x: number, vx: number): boolean => {
  const stopsAt = x + (vx * Math.abs(vx)) / (2 * Math.max(1, FIRE_DRAGON_STRAFE.accel));
  return stopsAt < -FIRE_DRAGON_STRAFE.edgeOut || stopsAt > worldWidth() - EDGE_MARGIN;
};

/** The pass is over: the dragon (at `dragonX`) is passBeyond past its target and has stopped pouring fire. */
export const passDone = (strafe: StrafeState, dragonX: number, targetX: number): boolean =>
  (dragonX - targetX) * -strafe.side >= FIRE_DRAGON_STRAFE.passBeyond
  && strafe.stageMs >= FIRE_BREATH.windUpMs + FIRE_BREATH.flameMs + FIRE_BREATH.recoverMs;
