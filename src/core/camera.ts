/**
 * Camera look-ahead while aiming (pure, tested): the view slides towards where the shot would land, more the
 * farther it goes. A short shot that lands well inside the view doesn't move it; past that the slide grows
 * smoothly until, for a long shot, the bowman sits near one edge and the landing spot near the other.
 */

import { tunable } from './tuning';

/**
 * Shots landing within deadZone (share of the view width) from the bowman don't move the camera; edgeMargin: how
 * close to the view's edge the bowman (and, at full slide, the landing spot) may come (px); aimMs / returnMs: easing
 * time constants, sliding out while aiming and drifting back to the bowman once he moves again.
 */
export const CAMERA_LOOK = tunable('CAMERA_LOOK', 'Aim camera', {
  deadZone: 0.22,
  edgeMargin: 70,
  aimMs: 300,
  returnMs: 1500,
}, { meta: { deadZone: { max: 0.5 } }, file: 'src/core/camera.ts' });

/**
 * How far (px, signed) to shift the view's centre from the bowman for a shot landing `landingOffset` px from him
 * (negative = to the left), in a view `viewWidth` wide.
 */
export const aimLookAhead = (landingOffset: number, viewWidth: number): number => {
  const distance = Math.abs(landingOffset);
  const deadZone = viewWidth * CAMERA_LOOK.deadZone;
  // At this distance the bowman and the landing spot both sit CAMERA_LOOK.edgeMargin inside opposite edges.
  const span = viewWidth - 2 * CAMERA_LOOK.edgeMargin;
  const maxShift = viewWidth / 2 - CAMERA_LOOK.edgeMargin;
  if (distance <= deadZone || span <= deadZone) {
    return 0;
  }
  const t = Math.min(1, (distance - deadZone) / (span - deadZone));
  // Eased start, so the view begins to slide gently.
  const eased = t * t * (3 - 2 * t) * 0.5 + t * 0.5;
  return Math.sign(landingOffset) * eased * maxShift;
};

/**
 * Where the view should be slid to while aiming, given where it's slid already (`held`), what this aim alone
 * asks for (`wanted`, aimLookAhead) and which way he aims (`aimDirectionX`): the view only slides further out,
 * never back in for a shorter shot, unless he turns to aim the other way.
 */
export const nextLookShift = (held: number, wanted: number, aimDirectionX: number): number => {
  const turnedAround = held !== 0 && Math.sign(aimDirectionX) !== Math.sign(held);
  if (held === 0 || turnedAround) {
    return wanted;
  }
  return Math.abs(wanted) > Math.abs(held) && Math.sign(wanted) === Math.sign(held) ? wanted : held;
};

/** Frame-rate independent exponential easing of `current` towards `target` with time constant `tauMs`. */
export const easeTowards = (current: number, target: number, deltaMs: number, tauMs: number): number =>
  current + (target - current) * (1 - Math.exp(-Math.max(0, deltaMs) / Math.max(1, tauMs)));
