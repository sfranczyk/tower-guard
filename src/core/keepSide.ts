/**
 * Where the player's own keep shows on screen (settings drawer, kept in this browser): left as drawn, or right, which
 * mirrors the whole battle view, the mouse and the walking keys (GameScene). In MOBA a red player's keep is the right
 * one in the world, so for them "left" is the mirrored view.
 */
export type KeepSide = 'left' | 'right';

const STORAGE_KEY = 'towerGuard.keepSide';

export const loadKeepSide = (): KeepSide => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'right' ? 'right' : 'left';
  } catch {
    return 'left';
  }
};

export const saveKeepSide = (side: KeepSide): void => {
  try {
    localStorage.setItem(STORAGE_KEY, side);
  } catch {
    // Not kept (private window, blocked storage): it holds for this visit.
  }
};

/** Whether the view is mirrored: the keep `ownKeepOnRight` in the world is wanted on the other side of the screen. */
export const isMirrored = (side: KeepSide, ownKeepOnRight: boolean): boolean => (side === 'right') !== ownKeepOnRight;

/** A screen x as seen in the mirrored view (and back: mirroring twice gives the same x). */
export const mirrorX = (x: number, width: number): number => width - x;
