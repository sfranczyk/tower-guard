import type { GameContext, GameSession, NetLink } from '../core/Scene';
import { getUrlParam } from '../core/urlState';
import { normalizeLoadout, type Loadout } from '../data/loadout';
import type { NetMessage } from './protocol';
import { RoomHub, guestLink } from './RoomHub';
import { hasGaps, seatCount } from './seats';
import type { HostedRoom, RoomLink, Transport, TransportMode } from './Transport';

/** `?net=local` links tabs of this browser (no internet needed) instead of PeerJS. */
export const transportMode = (): TransportMode => (getUrlParam('net') === 'local' ? 'local' : 'peer');

/** A co-op room holds the host and up to three guests. */
export const MAX_PLAYERS = 4;

/** Each player's bowman (rendering/bowmanBody.ts BOWMAN_LOOKS), for the lobby's labels. */
const LOOK_NAMES = ['Ranger', 'Keep warden', 'Steppe archer', 'Huntsman'];

/** "Host · Ranger", "Player 3 · Steppe archer". */
export const playerLabel = (index: number): string => `${index === 0 ? 'Host' : `Player ${index + 1}`} · ${LOOK_NAMES[index] ?? 'Archer'}`;

/** Called when someone joins or leaves the room or picks a quiver (the lobby and the battle setup show it). */
let onRoomChange: (() => void) | undefined;

export const setRoomListener = (listener: (() => void) | undefined): void => {
  onRoomChange = listener;
};

/** Host: sends the roster round again (after a join, a leave or a new quiver). */
const announcers = new WeakMap<NetLink, () => void>();
/** Host: the RoomHub behind the link (for closing up seats). */
const hubs = new WeakMap<NetLink, RoomHub>();

/**
 * The link as the scenes see it: room messages (quivers, the roster) are taken out here (they can come in any
 * scene), the rest go to whichever handler the current scene set (queued until it sets one).
 */
const takeRoomMessages = (link: RoomLink, take: (message: NetMessage, from: number) => boolean): RoomLink => {
  let handler: ((message: NetMessage, from: number) => void) | undefined;
  let queue: Array<[NetMessage, number]> = [];
  link.onMessage((message, from) => {
    if (take(message, from)) {
      return;
    }
    if (handler) {
      handler(message, from);
    } else {
      queue.push([message, from]);
    }
  });
  return {
    send: (message) => link.send(message),
    sendTo: (player, message) => link.sendTo(player, message),
    onMessage: (next) => {
      handler = next;
      const queued = queue;
      queue = [];
      queued.forEach(([message, from]) => next(message, from));
    },
    close: () => link.close(),
  };
};

/**
 * The host opened a room: guests join it while it's open (up to three), each takes the lowest free seat and picks
 * their own quiver. A guest who leaves mid-battle leaves their bowman standing still for the rest of the level;
 * back in the lobby or the setup the seats close up (`settleSeats`).
 */
export const hostCoop = (ctx: GameContext, room: HostedRoom, ownLoadout: Loadout): void => {
  const { session } = ctx;
  const net: NetLink = {
    role: 'host', code: room.code, transport: undefined as unknown as RoomLink, wind: 0, loadouts: [ownLoadout], localIndex: 0, present: [true], inBattle: false,
  };
  session.net = net;
  session.playerCount = 1;
  const hub = new RoomHub(room, MAX_PLAYERS);
  const announce = (): void => {
    net.present = hub.present();
    net.loadouts.length = net.present.length;
    session.playerCount = seatCount(net.present);
    const loadouts = net.present.map((_, seat) => net.loadouts[seat] ?? null);
    net.present.forEach((taken, seat) => {
      if (taken && seat > 0) {
        hub.sendTo(seat, { t: 'roster', you: seat, present: net.present, loadouts });
      }
    });
    onRoomChange?.();
  };
  announcers.set(net, announce);
  hubs.set(net, hub);
  net.transport = takeRoomMessages(hub, (message, from) => {
    if (message.t !== 'loadout') {
      return false;
    }
    net.loadouts[from] = normalizeLoadout(message.loadout);
    announce();
    return true;
  });
  hub.onJoin = (seat) => {
    net.loadouts[seat] = undefined;
    announce();
  };
  hub.onLeave = (seat) => {
    net.loadouts[seat] = undefined;
    if (net.inBattle) {
      ctx.ui.setStatus(`${playerLabel(seat)} has left · ${hub.present().some((taken, other) => taken && other > 0) ? 'the others play on' : 'you play on alone'}`);
    } else {
      net.loadouts = hub.compact().map((old) => net.loadouts[old]);
    }
    announce();
  };
  hub.open();
};

/**
 * This browser joined a room: the host's roster tells it its seat and everyone's quivers. If the link drops (or the
 * room was full), back to the lobby with a notice.
 */
export const joinCoop = (ctx: GameContext, code: string, transport: Transport, ownLoadout: Loadout): void => {
  const { session } = ctx;
  let notice = 'The host has left the game.';
  const net: NetLink = {
    role: 'guest', code, transport: guestLink(transport), wind: 0, loadouts: [undefined, ownLoadout], localIndex: 1, present: [], inBattle: false,
  };
  // First: a roster may already be waiting.
  session.net = net;
  session.playerCount = 1;
  net.transport = takeRoomMessages(net.transport, (message) => {
    if (message.t === 'roster') {
      const own = net.loadouts[net.localIndex] ?? ownLoadout;
      net.localIndex = message.you;
      net.present = message.present;
      net.loadouts = message.loadouts.map((loadout, seat) => (seat === message.you ? own : loadout ? normalizeLoadout(loadout) : undefined));
      session.playerCount = seatCount(net.present);
      // Joined (or the host lost track): the host gets this player's quiver.
      if (!message.loadouts[message.you]) {
        transport.send({ t: 'loadout', loadout: own });
      }
      onRoomChange?.();
      return true;
    }
    if (message.t === 'full') {
      notice = 'That room is full (four players).';
      return true;
    }
    return false;
  });
  transport.onClose(() => {
    if (session.net !== net) {
      return;
    }
    session.net = undefined;
    session.playerCount = 1;
    session.coopNotice = notice;
    ctx.goTo('coop');
  });
};

/** Host, back in the lobby or the setup: the seats of guests who left close up (players renumbered, told by roster). */
export const settleSeats = (session: GameSession): void => {
  const { net } = session;
  if (net?.role !== 'host') {
    return;
  }
  net.inBattle = false;
  const hub = hubs.get(net);
  if (hub && hasGaps(net.present)) {
    net.loadouts = hub.compact().map((old) => net.loadouts[old]);
    announcers.get(net)?.();
  }
};

/** Host: a battle starts (seats keep their numbers until `settleSeats`). */
export const enterBattle = (session: GameSession): void => {
  if (session.net?.role === 'host') {
    session.net.inBattle = true;
  }
};

/** This player picked a new quiver: kept for the battle and passed on (the host sends it round in the roster). */
export const shareLoadout = (session: GameSession, loadout: Loadout): void => {
  const { net } = session;
  if (!net) {
    return;
  }
  net.loadouts[net.localIndex] = loadout;
  if (net.role === 'host') {
    announcers.get(net)?.();
  } else {
    net.transport.send({ t: 'loadout', loadout });
  }
};

/** The other players in the room (not this one), with their quivers (undefined until picked). */
export const otherPlayers = (session: GameSession): Array<{ index: number; loadout?: Loadout }> => {
  const { net } = session;
  if (!net) {
    return [];
  }
  return net.present.flatMap((taken, index) => (taken && index !== net.localIndex ? [{ index, loadout: net.loadouts[index] }] : []));
};

/** The other players' quivers as the lobby and the Quiver page list them (ui/quiverPage.ts PartnerQuiver). */
export const otherQuivers = (session: GameSession): Array<{ label: string; loadout?: Loadout }> =>
  otherPlayers(session).map(({ index, loadout }) => ({ label: playerLabel(index), loadout }));

/** Whether player `index` is still in the room (always, alone). */
export const isPresent = (session: GameSession, index: number): boolean => !session.net || session.net.present[index] === true;

/** The quiver player `index` fights with: their own in co-op, else the battle setup's. */
export const loadoutOf = (session: GameSession, index: number): Loadout =>
  session.net?.loadouts[index] ?? session.sandbox.loadout;

/** Leaves co-op on purpose: closes the links (the others are told) and goes back to playing alone. */
export const leaveCoop = (ctx: GameContext): void => {
  const { session } = ctx;
  const link = session.net;
  session.net = undefined;
  session.playerCount = 1;
  link?.transport.close();
};
