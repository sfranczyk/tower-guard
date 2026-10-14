import type { GameContext, GameSession } from '../core/Scene';
import { getUrlParam } from '../core/urlState';
import { normalizeLoadout, type Loadout } from '../data/loadout';
import type { NetMessage } from './protocol';
import type { Transport, TransportMode } from './Transport';

/** `?net=local` links two tabs of this browser (no internet needed) instead of PeerJS. */
export const transportMode = (): TransportMode => (getUrlParam('net') === 'local' ? 'local' : 'peer');

/** Called when the host loses the guest while in the lobby (to show it), set by the lobby scene. */
let onPartnerLeft: (() => void) | undefined;
/** Called when the partner's quiver arrives or changes (the lobby and the battle setup show it). */
let onPartnerLoadout: (() => void) | undefined;

export const setPartnerLeftListener = (listener: (() => void) | undefined): void => {
  onPartnerLeft = listener;
};

export const setPartnerLoadoutListener = (listener: (() => void) | undefined): void => {
  onPartnerLoadout = listener;
};

/** This browser's player index in co-op: the host is player 1 (0), the guest player 2 (1). */
const ownIndex = (role: 'host' | 'guest'): number => (role === 'host' ? 0 : 1);

/**
 * The transport as the scenes see it: quiver messages are taken out here (they can come in any scene), the rest
 * go to whichever handler the current scene set (queued until it sets one).
 */
const withLoadouts = (transport: Transport, take: (message: NetMessage) => boolean): Transport => {
  let handler: ((message: NetMessage) => void) | undefined;
  let queue: NetMessage[] = [];
  transport.onMessage((message) => {
    if (take(message)) {
      return;
    }
    if (handler) {
      handler(message);
    } else {
      queue.push(message);
    }
  });
  return {
    send: (message) => transport.send(message),
    onMessage: (next) => {
      handler = next;
      const queued = queue;
      queue = [];
      queued.forEach((message) => next(message));
    },
    onClose: (next) => transport.onClose(next),
    close: () => transport.close(),
  };
};

/**
 * Both browsers are linked: two bowmen from now on, each with their own quiver (`ownLoadout` is this player's).
 * If the link drops, the guest goes back to the lobby with a notice, and the host plays on alone (player 2 stands
 * still for the rest of the level).
 */
export const linkUp = (ctx: GameContext, role: 'host' | 'guest', code: string, raw: Transport, ownLoadout: Loadout): void => {
  const { session } = ctx;
  const loadouts: Array<Loadout | undefined> = [undefined, undefined];
  loadouts[ownIndex(role)] = ownLoadout;
  const transport = withLoadouts(raw, (message) => {
    if (message.t !== 'loadout') {
      return false;
    }
    loadouts[1 - ownIndex(role)] = normalizeLoadout(message.loadout);
    onPartnerLoadout?.();
    return true;
  });
  session.net = { role, code, transport, wind: 0, loadouts };
  session.playerCount = 2;
  raw.onClose(() => {
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

/** This player picked a new quiver: kept for the battle and sent to the partner. */
export const shareLoadout = (session: GameSession, loadout: Loadout): void => {
  const { net } = session;
  if (!net) {
    return;
  }
  net.loadouts[ownIndex(net.role)] = loadout;
  net.transport.send({ t: 'loadout', loadout });
};

/** The partner's quiver (undefined until it arrives, or alone). */
export const partnerLoadout = (session: GameSession): Loadout | undefined => {
  const { net } = session;
  return net ? net.loadouts[1 - ownIndex(net.role)] : undefined;
};

/** The quiver player `index` fights with: their own in co-op, else the battle setup's. */
export const loadoutOf = (session: GameSession, index: number): Loadout =>
  session.net?.loadouts[index] ?? session.sandbox.loadout;

/** Leaves co-op on purpose: closes the link (the other side is told) and goes back to playing alone. */
export const leaveCoop = (ctx: GameContext): void => {
  const { session } = ctx;
  const link = session.net;
  session.net = undefined;
  session.playerCount = 1;
  link?.transport.close();
};
