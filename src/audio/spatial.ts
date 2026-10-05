import { GAME_WIDTH, SOUND_MAX_PAN, SOUND_MIN_GAIN } from '../config';

export interface SpatialMix {
  /** 0..1 volume factor. */
  gain: number;
  /** -1 (left) .. 1 (right). */
  pan: number;
}

/**
 * Where a sound at world x sits relative to the camera: panned across the screen, full volume while
 * visible, fading to SOUND_MIN_GAIN one screen width beyond either edge (and staying there).
 */
export const spatialMix = (worldX: number, cameraX: number, screenWidth = GAME_WIDTH): SpatialMix => {
  const screenX = worldX - cameraX;
  const fromCentre = (screenX - screenWidth / 2) / (screenWidth / 2);
  const pan = Math.max(-1, Math.min(1, fromCentre)) * SOUND_MAX_PAN;
  const offscreen = screenX < 0 ? -screenX : Math.max(0, screenX - screenWidth);
  const fade = Math.min(1, offscreen / screenWidth);
  return { gain: 1 - fade * (1 - SOUND_MIN_GAIN), pan };
};
