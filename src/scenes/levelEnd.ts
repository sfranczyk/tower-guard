import { BATTLEGROUNDS } from '../data/battlegrounds';
import type { SandboxSettings } from '../data/sandbox';
import type { EndInfo } from '../net/protocol';

/** How a level ended and what's left standing, for the end screen. */
export interface LevelOutcome {
  won: boolean;
  /** Won by clearing the level (not by bringing the enemy keep down). */
  levelCleared: boolean;
  levelIndex: number;
  defeated: number;
  totalEnemies: number;
  keep: { health: number; max: number };
  enemyKeepDestroyed: boolean;
  playerKeepDestroyed: boolean;
  /** Each player's health, player 1 first. */
  playerHealths: readonly number[];
}

/**
 * The end screen of a level (pure, tested): a cleared level with levels left offers the next one (`next`), otherwise
 * it's the end of the run: victory (all levels or the enemy keep) or defeat, with what fell.
 */
export const levelEndInfo = (outcome: LevelOutcome, sandbox: SandboxSettings): { info: EndInfo; next: boolean } => {
  const { won, levelIndex } = outcome;
  const coop = outcome.playerHealths.length > 1;
  const stats = [
    { label: 'enemies defeated', value: `${outcome.defeated} / ${outcome.totalEnemies}` },
    { label: 'keep', value: `${Math.ceil(outcome.keep.health)} / ${outcome.keep.max}` },
    ...outcome.playerHealths.map((health, index) => ({
      label: coop ? `player ${index + 1}` : 'bowman',
      value: `${Math.ceil(health)} / ${sandbox.bowmanHealth}`,
    })),
  ];
  if (won && outcome.levelCleared && levelIndex + 1 < sandbox.levelCount) {
    return {
      next: true,
      info: {
        title: `Level ${levelIndex + 1} cleared!`,
        outcome: 'win',
        stats,
        copy: `Next: level ${levelIndex + 2} of ${sandbox.levelCount} at ${BATTLEGROUNDS[sandbox.levels[levelIndex + 1].battleground].name}.`,
      },
    };
  }
  return {
    next: false,
    info: {
      title: won ? 'Victory!' : 'Defeat',
      outcome: won ? 'win' : 'loss',
      stats,
      copy: won
        ? (outcome.enemyKeepDestroyed ? 'The enemy keep has fallen.' : sandbox.levelCount === 1 ? 'The level is held off.' : `All ${sandbox.levelCount} levels held off.`)
        : `${outcome.playerKeepDestroyed ? 'The keep has fallen' : coop ? 'Both bowmen have fallen' : 'The bowman has fallen'}. Adjust the sandbox and try again.`,
    },
  };
};
