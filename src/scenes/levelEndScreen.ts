import type { GameContext, RunState } from '../core/Scene';
import type { HostSync } from '../net/HostSync';
import type { EndInfo } from '../net/protocol';
import type { Team } from '../data/moba';
import { levelEndInfo, mobaEndInfo, type LevelOutcome } from './levelEnd';

/**
 * Shows the end of a level. A cleared level with levels left offers the next one (`nextRun`: bowmen heal by the difficulty, the keep is whole);
 * otherwise it's the end of the run and the button goes back to the main menu (co-op: both to the lobby); a new run is
 * set up only from there. Returns what the button (and Space) does.
 */
export const showLevelEnd = (ctx: GameContext, outcome: LevelOutcome, nextRun: () => RunState, hostSync?: HostSync): (() => void) => {
  const { session, ui } = ctx;
  const { info, next } = levelEndInfo(outcome, session.sandbox);
  hostSync?.sendEnd(info);
  const action = next
    ? () => {
      session.run = nextRun();
      ctx.goTo('game');
    }
    : () => {
      // Co-op: the guest goes back to the lobby and waits for the next battle.
      session.net?.transport.send({ t: 'lobby' });
      ctx.goTo(session.net ? 'coop' : 'menu');
    };
  const backLabel = session.net ? 'Back to the lobby' : 'Return to menu';
  ui.dialogs.showEndScreen({ ...info, buttonLabel: next ? 'Next level' : backLabel, onButton: action });
  return action;
};

/** MOBA: the match is over (`winner` brought the other keep down); back to the menu, or (co-op) everyone to the lobby. */
export const showMobaEnd = (ctx: GameContext, winner: Team, viewer: Team, stats: EndInfo['stats'], hostSync?: HostSync): (() => void) => {
  const { session, ui } = ctx;
  const info = mobaEndInfo(winner, viewer, stats);
  hostSync?.sendEnd(info);
  const action = (): void => {
    session.net?.transport.send({ t: 'lobby' });
    ctx.goTo(session.net ? 'coop' : 'menu');
  };
  ui.dialogs.showEndScreen({ ...info, buttonLabel: session.net ? 'Back to the lobby' : 'Return to menu', onButton: action });
  return action;
};
