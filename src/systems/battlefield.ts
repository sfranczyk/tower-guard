import { KEEP_INSET, WORLD_WIDTH } from '../config';

/**
 * The current level's battlefield: WORLD_WIDTH for a battle, SURVIVAL_WORLD_WIDTH for a survival level (GameScene sets
 * it as the level starts, host and guest alike, and puts it back as it ends). Everything spanning the field asks here.
 */
let width = WORLD_WIDTH;

export const worldWidth = (): number => width;
/**
 * The enemy keep's x. A survival level has no enemy keep (its Tower is built `absent`): there this is only the far
 * post enemies retreat to and rally at, and the end of the ground the terrain flattens for.
 */
export const enemyKeepX = (): number => width - KEEP_INSET;

export const useBattlefield = (fieldWidth: number = WORLD_WIDTH): void => {
  width = fieldWidth;
};
