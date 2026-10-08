import { BATTLEGROUNDS } from '../data/battlegrounds';
import type { SandboxSettings } from '../data/sandbox';
import type { EndInfo } from '../net/protocol';

/** How a wave ended and what's left standing, for the end screen. */
export interface WaveOutcome {
  won: boolean;
  /** Won by clearing the wave (not by bringing the enemy keep down). */
  waveCleared: boolean;
  waveIndex: number;
  defeated: number;
  totalEnemies: number;
  keep: { health: number; max: number };
  enemyKeepDestroyed: boolean;
  playerKeepDestroyed: boolean;
  /** Each player's health, player 1 first. */
  playerHealths: readonly number[];
}

/**
 * The end screen of a wave (pure, tested): a cleared wave with waves left offers the next one (`next`), otherwise
 * it's the end of the run: victory (all waves or the enemy keep) or defeat, with what fell.
 */
export const waveEndInfo = (outcome: WaveOutcome, sandbox: SandboxSettings): { info: EndInfo; next: boolean } => {
  const { won, waveIndex } = outcome;
  const coop = outcome.playerHealths.length > 1;
  const stats = [
    { label: 'enemies defeated', value: `${outcome.defeated} / ${outcome.totalEnemies}` },
    { label: 'keep', value: `${Math.ceil(outcome.keep.health)} / ${outcome.keep.max}` },
    ...outcome.playerHealths.map((health, index) => ({
      label: coop ? `player ${index + 1}` : 'bowman',
      value: `${Math.ceil(health)} / ${sandbox.bowmanHealth}`,
    })),
  ];
  if (won && outcome.waveCleared && waveIndex + 1 < sandbox.waveCount) {
    return {
      next: true,
      info: {
        title: `Level ${waveIndex + 1} cleared!`,
        outcome: 'win',
        stats,
        copy: `Next: level ${waveIndex + 2} of ${sandbox.waveCount} at ${BATTLEGROUNDS[sandbox.waves[waveIndex + 1].battleground].name}.`,
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
        ? (outcome.enemyKeepDestroyed ? 'The enemy keep has fallen.' : sandbox.waveCount === 1 ? 'The level is held off.' : `All ${sandbox.waveCount} levels held off.`)
        : `${outcome.playerKeepDestroyed ? 'The keep has fallen' : coop ? 'Both bowmen have fallen' : 'The bowman has fallen'}. Adjust the sandbox and try again.`,
    },
  };
};
