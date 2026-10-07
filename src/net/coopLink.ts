import type { GameContext } from '../core/Scene';
import { getUrlParam } from '../core/urlState';
import type { Transport, TransportMode } from './Transport';

/** `?net=local` links two tabs of this browser (no internet needed) instead of PeerJS. */
export const transportMode = (): TransportMode => (getUrlParam('net') === 'local' ? 'local' : 'peer');

/** Called when the host loses the guest while in the lobby (to show it), set by the lobby scene. */
let onPartnerLeft: (() => void) | undefined;

export const setPartnerLeftListener = (listener: (() => void) | undefined): void => {
  onPartnerLeft = listener;
};

/**
 * Both browsers are linked: two bowmen from now on. If the link drops, the guest goes back to the lobby
 * with a notice, and the host plays on alone (player 2 stands still for the rest of the wave).
 */
export const linkUp = (ctx: GameContext, role: 'host' | 'guest', code: string, transport: Transport): void => {
  const { session } = ctx;
  session.net = { role, code, transport, wind: 0 };
  session.playerCount = 2;
  transport.onClose(() => {
    if (session.net?.transport !== transport) {
      return;
    }
    session.net = undefined;
    session.playerCount = 1;
    if (role === 'guest') {
      session.coopNotice = 'The host has left the game.';
      ctx.goTo('coop');
    } else {
      ctx.ui.setStatus('Your partner has left · you play on alone');
      onPartnerLeft?.();
    }
  });
};

/** Leaves co-op on purpose: closes the link (the other side is told) and goes back to playing alone. */
export const leaveCoop = (ctx: GameContext): void => {
  const { session } = ctx;
  const link = session.net;
  session.net = undefined;
  session.playerCount = 1;
  link?.transport.close();
};
