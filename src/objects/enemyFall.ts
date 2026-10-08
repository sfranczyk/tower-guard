import { FALL_DURATION_MS, type FallKind } from '../rendering/stickmanFall';
import type { HitInfo } from './Enemy';

/**
 * An enemy's falls (pure, tested): which death a hit plays, and the fall's own clock: a knockback slides it away from
 * the blast, lies a while and gets up; a death plays to its last frame and stays there.
 */

/** Time a knocked-down (surviving) enemy lies on the ground before getting up. */
export const KNOCKDOWN_LIE_MS = 450;

/** A playing fall animation. Dead enemies stay in their last frame. */
export interface FallState {
  kind: FallKind;
  timeMs: number;
  /** +1: fall-space +x is world +x; −1: mirrored. */
  facing: number;
  /** Knockback only: get up after lying down this long, then fight on. */
  getUpAfterMs?: number;
  /** Knockback only: extra world px it slides away from the blast over the fall, and how much is done. */
  push?: { total: number; applied: number };
}

/** Share (0..1) of a knockback's extra push done at fall progress `p`: mostly in the flight, a little slide. */
export const pushShare = (p: number): number => {
  const smooth = (value: number): number => value * value * (3 - 2 * value);
  if (p <= 0.12) {
    return 0.1 * smooth(p / 0.12);
  }
  if (p <= 0.72) {
    return 0.1 + 0.8 * ((p - 0.12) / 0.6);
  }
  return 0.9 + 0.1 * smooth(Math.min(1, (p - 0.72) / 0.28));
};

/** The death a killing hit plays (`roll` 0..1 picks between two): headshot and lightning stiff, a blast throws it back. */
export const deathKind = (cause: HitInfo['cause'], roll = Math.random()): FallKind => {
  if (cause === 'headshot' || cause === 'lightning') {
    return 'deathStiff';
  }
  if (cause === 'explosion') {
    return 'knockback';
  }
  if (cause === 'burn') {
    return 'deathCrumple';
  }
  return roll < 0.5 ? 'death' : 'deathCrumple';
};

/** A fresh fall facing the hit from `fromX` (the enemy at `x`); a knockback with `push` px to slide. */
export const startFallState = (kind: FallKind, fromX: number, x: number, getUpAfterMs?: number, push = 0): FallState => ({
  kind,
  timeMs: 0,
  facing: fromX >= x ? 1 : -1,
  getUpAfterMs,
  push: kind === 'knockback' && push > 0 ? { total: push, applied: 0 } : undefined,
});

/** How far through its fall it is (0..1). */
export const fallProgress = (fall: Readonly<FallState>): number => Math.min(1, fall.timeMs / FALL_DURATION_MS[fall.kind]);

/**
 * One step of a fall: the fall after it (undefined once a knocked-down survivor stands again: `stoodUp`), and how
 * far (px) it slides away from the blast this step (in the fall's facing: the world x changes by −facing × slide).
 */
export const stepFall = (fall: Readonly<FallState>, deltaMs: number): { fall?: FallState; slide: number; stoodUp: boolean } => {
  const timeMs = fall.timeMs + deltaMs;
  const duration = FALL_DURATION_MS[fall.kind];
  let slide = 0;
  let push = fall.push;
  if (push) {
    const target = push.total * pushShare(Math.min(1, timeMs / duration));
    slide = target - push.applied;
    push = { ...push, applied: target };
  }
  if (fall.kind === 'knockback' && fall.getUpAfterMs !== undefined && timeMs >= duration + fall.getUpAfterMs) {
    return { fall: { kind: 'getUp', timeMs: 0, facing: fall.facing }, slide, stoodUp: false };
  }
  if (fall.kind === 'getUp' && timeMs >= duration) {
    return { fall: undefined, slide, stoodUp: true };
  }
  return { fall: { ...fall, timeMs, push }, slide, stoodUp: false };
};
