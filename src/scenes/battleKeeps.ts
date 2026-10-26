import { GROUND_Y, MOBA_KEEPS, MOBA_WORLD_WIDTH, SURVIVAL_WORLD_WIDTH, WORLD_WIDTH } from '../config';
import type { GameContext, GameSession } from '../core/Scene';
import { BATTLEGROUNDS, type Battleground } from '../data/battlegrounds';
import { runBattleground } from '../data/sandbox';
import { enemyKeepHealth } from '../data/difficulty';
import type { Team } from '../data/moba';
import Tower from '../objects/Tower';
import { enemyKeepX, playerKeepX, useBattlefield, worldWidth } from '../systems/battlefield';

/**
 * Lays out the level's field before anything is placed on it (host and guest alike): a survival level's is shorter, a
 * MOBA one longer, and the view never wider than it (a big window letterboxes). Returns the level's battleground
 * (MOBA: always the Green Meadow).
 */
export const prepareField = (ctx: GameContext, survival: boolean): Battleground => {
  const { sandbox, run, moba } = ctx.session;
  if (moba) {
    useBattlefield(MOBA_WORLD_WIDTH, MOBA_KEEPS.inset);
  } else {
    useBattlefield(survival ? SURVIVAL_WORLD_WIDTH : WORLD_WIDTH);
  }
  ctx.ui.limitViewWidth(worldWidth());
  return BATTLEGROUNDS[moba ? 'greenMeadow' : runBattleground(sandbox, run.levelIndex)];
};

/**
 * The level's two keeps at their health: a tower on each per player of its side (co-op: a second, lower one for the
 * second bowman). MOBA: both alike and whole, at the room's keep health; survival: no enemy keep (`absent`).
 */
export const createKeeps = (session: GameSession, battleground: Battleground, teams: readonly Team[], absent: boolean): { playerTower: Tower; enemyTower: Tower } => {
  const { sandbox, run, moba } = session;
  const hillColor = battleground.hills[0];
  const towers = (team: Team): number => teams.filter((each) => each === team).length;
  const playerKeep = moba ? { max: sandbox.moba.keepHealth, now: sandbox.moba.keepHealth } : { max: sandbox.keepHealth, now: run.keepHealth };
  const enemyKeep = moba ? playerKeep : { max: enemyKeepHealth(sandbox.difficulty, sandbox.keepHealth), now: run.enemyKeepHealth };
  return {
    playerTower: new Tower(playerKeepX(), GROUND_Y, { hillColor, enemy: false, towers: towers('blue') }, playerKeep.max, playerKeep.now),
    enemyTower: new Tower(enemyKeepX(), GROUND_Y, { hillColor, enemy: true, absent, towers: towers('red') || 1 }, enemyKeep.max, enemyKeep.now),
  };
};
