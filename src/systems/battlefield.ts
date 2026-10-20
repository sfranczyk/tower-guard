import { KEEP_INSET, WORLD_WIDTH } from '../config';

/**
 * The current level's battlefield: WORLD_WIDTH for a battle, SURVIVAL_WORLD_WIDTH for a survival level (GameScene sets
 * it as the level starts, host and guest alike, and puts it back as it ends). Everything spanning the field asks here.
 */
let width = WORLD_WIDTH;

export const worldWidth = (): number => width;
/** The enemy keep's x (absent on a survival level, but its spot still bounds the field). */
export const enemyKeepX = (): number => width - KEEP_INSET;

export const useBattlefield = (fieldWidth: number = WORLD_WIDTH): void => {
  width = fieldWidth;
};
