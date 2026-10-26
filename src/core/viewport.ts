import { BACKDROP_WIDTH, GAME_HEIGHT, GAME_WIDTH, MAX_VIEW_SCALE, MAX_VIEW_WIDTH, VIEW_CULL_MARGIN } from '../config';

/**
 * The view's width in game px. Its height is always GAME_HEIGHT; the width grows from GAME_WIDTH when the
 * window is wider than 2.1:1 or big enough to pass MAX_VIEW_SCALE. DomUi fits it (fitView) and main.ts
 * resizes the renderer; scenes read `viewWidth()` every frame.
 */
export interface ViewFit {
  /** CSS px per game px. */
  scale: number;
  /** View width in game px (GAME_WIDTH..MAX_VIEW_WIDTH). */
  viewWidth: number;
  /** Canvas size in CSS px. */
  cssWidth: number;
  cssHeight: number;
}

/**
 * Fits the view into the available CSS area: scale up to MAX_VIEW_SCALE, then widen the view, up to `maxViewWidth`
 * (a battlefield narrower than MAX_VIEW_WIDTH caps it; the canvas is then narrower than the window, centred).
 */
export const fitView = (availableWidth: number, availableHeight: number, maxViewWidth = MAX_VIEW_WIDTH): ViewFit => {
  const scale = Math.max(0.01, Math.min(availableWidth / GAME_WIDTH, availableHeight / GAME_HEIGHT, MAX_VIEW_SCALE));
  const widest = Math.min(MAX_VIEW_WIDTH, maxViewWidth);
  const viewWidth = Math.max(GAME_WIDTH, Math.min(widest, Math.floor(availableWidth / scale)));
  return { scale, viewWidth, cssWidth: Math.floor(viewWidth * scale), cssHeight: Math.floor(GAME_HEIGHT * scale) };
};

let currentWidth = GAME_WIDTH;

export const viewWidth = (): number => currentWidth;

export const setViewWidth = (width: number): void => {
  currentWidth = width;
};

/**
 * Camera x that centres a stretch `span` wide (by default the BACKDROP_WIDTH behind menus and labs) in the view
 * (negative once the view is wider than it).
 */
export const centeredCameraX = (width = currentWidth, span = BACKDROP_WIDTH): number => (span - width) / 2;

/**
 * The stretch of world x the battle camera shows (GameScene sets it each frame, clears it on exit). Bodies outside it,
 * plus a margin, skip drawing and rendering (EnemyFigure, DragonEnemy); unset (menus, labs) everything counts as shown.
 */
let shownRange: { left: number; right: number } | undefined;

export const setShownRange = (left: number, right: number): void => {
  shownRange = { left, right };
};

export const clearShownRange = (): void => {
  shownRange = undefined;
};

/** Whether world `x` is on screen or within `margin` of it (always, with no range set). */
export const isShownX = (x: number, margin = VIEW_CULL_MARGIN): boolean =>
  !shownRange || (x >= shownRange.left - margin && x <= shownRange.right + margin);
