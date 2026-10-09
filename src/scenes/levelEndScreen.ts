import type { GameContext, RunState } from '../core/Scene';
import type { HostSync } from '../net/HostSync';
import { levelEndInfo, type LevelOutcome } from './levelEnd';

/**
 * Shows the end of a level. A cleared level with levels left offers the next one (`nextRun`: health carries over);
 * otherwise it's the end of the run and the button goes back to the setup. Returns what the button (and Space) does.
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
      ctx.goTo('sandbox');
    };
  ui.showEndScreen({ ...info, buttonLabel: next ? 'Next level' : 'Back to sandbox setup', onButton: action });
  return action;
};
