import { BACKDROP_WIDTH, GAME_HEIGHT, GAME_WIDTH, MAX_VIEW_SCALE, MAX_VIEW_WIDTH } from '../config';

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

/** Fits the view into the available CSS area: scale up to MAX_VIEW_SCALE, then widen the view. */
export const fitView = (availableWidth: number, availableHeight: number): ViewFit => {
  const scale = Math.max(0.01, Math.min(availableWidth / GAME_WIDTH, availableHeight / GAME_HEIGHT, MAX_VIEW_SCALE));
  const viewWidth = Math.max(GAME_WIDTH, Math.min(MAX_VIEW_WIDTH, Math.floor(availableWidth / scale)));
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
