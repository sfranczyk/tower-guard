import { BATTLEGROUNDS } from '../data/battlegrounds';
import { runBattleground, runLevelCount, type SandboxSettings } from '../data/sandbox';
import type { EndInfo } from '../net/protocol';
import { otherTeam, type Team } from '../data/moba';
import { clockText } from './battleText';

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
  /** Banners: the enemy's brought to our keep (won, counts as cleared) or ours to theirs (lost). */
  banner?: 'captured' | 'lost';
  /** Each player's health, player 1 first. */
  playerHealths: readonly number[];
  /** Survival: how long the level was held (won: all of its time). */
  survivedMs?: number;
}

/**
 * The end screen of a level (pure, tested): a cleared (survival: held) level with levels left offers the next one
 * (`next`), otherwise it's the end of the run: victory (all levels or the enemy keep) or defeat, with what fell.
 */
export const levelEndInfo = (outcome: LevelOutcome, sandbox: SandboxSettings): { info: EndInfo; next: boolean } => {
  const { won, levelIndex } = outcome;
  const coop = outcome.playerHealths.length > 1;
  const survival = outcome.survivedMs !== undefined;
  const levelCount = runLevelCount(sandbox);
  const ending = BATTLEGROUNDS[runBattleground(sandbox, levelIndex)].nightCycle?.ending ?? { title: 'Dawn breaks!', until: 'sunrise', left: 'to dawn' };
  const stats = [
    ...(survival ? [{ label: 'held out', value: clockText(outcome.survivedMs!) }] : []),
    { label: 'enemies defeated', value: survival ? `${outcome.defeated}` : `${outcome.defeated} / ${outcome.totalEnemies}` },
    { label: 'keep', value: `${Math.ceil(outcome.keep.health)} / ${outcome.keep.max}` },
    ...outcome.playerHealths.map((health, index) => ({
      label: coop ? `player ${index + 1}` : 'bowman',
      value: `${Math.ceil(health)} / ${sandbox.bowmanHealth}`,
    })),
  ];
  if (won && outcome.levelCleared && levelIndex + 1 < levelCount) {
    const next = `Next: level ${levelIndex + 2} of ${levelCount} at ${BATTLEGROUNDS[runBattleground(sandbox, levelIndex + 1)].name}.`;
    return {
      next: true,
      info: {
        title: survival ? ending.title : outcome.banner === 'captured' ? 'Banner captured!' : `Level ${levelIndex + 1} cleared!`,
        outcome: 'win',
        stats,
        copy: `${survival ? `Level ${levelIndex + 1} survived, the enemy flees. ` : outcome.banner === 'captured' ? `Level ${levelIndex + 1} won. ` : ''}${next}`,
      },
    };
  }
  const victory = survival
    ? (levelCount === 1 ? `You held out until ${ending.until}; the enemy flees.` : `You held out all ${levelCount} levels.`)
    : outcome.enemyKeepDestroyed ? 'The enemy keep has fallen.' : outcome.banner === 'captured' ? 'The enemy banner is ours.' : levelCount === 1 ? 'The level is held off.' : `All ${levelCount} levels held off.`;
  return {
    next: false,
    info: {
      title: won ? 'Victory!' : 'Defeat',
      outcome: won ? 'win' : 'loss',
      stats,
      copy: won
        ? victory
        : `${outcome.playerKeepDestroyed ? 'The keep has fallen' : outcome.banner === 'lost' ? 'The enemy has carried off our banner' : coop ? `${outcome.playerHealths.length === 2 ? 'Both' : 'All'} bowmen have fallen` : 'The bowman has fallen'}${survival ? ` with ${clockText(sandbox.survival.levels[levelIndex].minutes * 60_000 - outcome.survivedMs!)} ${ending.left}` : ''}. Adjust the sandbox and try again.`,
    },
  };
};

/** MOBA's end screen as `viewer`'s team sees it (pure, tested): `winner` brought the other keep down. */
export const mobaEndInfo = (winner: Team, viewer: Team, stats: EndInfo['stats'] = []): EndInfo => ({
  title: winner === viewer ? 'Victory!' : 'Defeat',
  outcome: winner === viewer ? 'win' : 'loss',
  copy: `The ${otherTeam(winner)} keep has fallen. ${winner === viewer ? 'Your team wins the match.' : `The ${winner} team wins the match.`}`,
  stats,
  winner,
});
