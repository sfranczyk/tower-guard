import Peer, { type DataConnection } from 'peerjs';
import type { NetMessage } from './protocol';
import { makeRoomCode, peerIdFor } from './roomCode';

/**
 * The links between the browsers of a co-op game: the host has one to each guest (up to three), a guest one to
 * the host. PeerJS (WebRTC data channel, with PeerJS's free public broker only for finding each other) over the
 * internet, or a BroadcastChannel between tabs of this browser for development (`?net=local`).
 */
export interface Transport {
  send(message: NetMessage): void;
  onMessage(handler: (message: NetMessage) => void): void;
  /** The other side left or the connection dropped. */
  onClose(handler: () => void): void;
  close(): void;
}

export type TransportMode = 'peer' | 'local';

/**
 * The room as the scenes see it (net/coopLink.ts builds it): the host's links to all guests, or the guest's link to
 * the host. Messages say which player sent them (a guest hears everything from the host, player 0).
 */
export interface RoomLink {
  /** Host: to every guest; guest: to the host. */
  send(message: NetMessage): void;
  /** Host: to one guest (by player index). */
  sendTo(player: number, message: NetMessage): void;
  onMessage(handler: (message: NetMessage, from: number) => void): void;
  close(): void;
}

/** A room the host opened: its code, and each guest as they join (until the room is closed). */
export interface HostedRoom {
  code: string;
  onGuest(handler: (guest: Transport) => void): void;
  close(): void;
}

/** Hands guests to the handler, holding the ones that come before it's set. */
const guestDoor = (): { arrive: (guest: Transport) => void; onGuest: (handler: (guest: Transport) => void) => void } => {
  let handler: ((guest: Transport) => void) | undefined;
  const waiting: Transport[] = [];
  return {
    arrive: (guest) => (handler ? handler(guest) : waiting.push(guest)),
    onGuest: (next) => {
      handler = next;
      waiting.splice(0).forEach(next);
    },
  };
};

/** Calls registered handlers (messages can arrive before the scene subscribes, so they're queued until then). */
class Channel implements Transport {
  private messageHandler?: (message: NetMessage) => void;
  private closeHandlers: Array<() => void> = [];
  private queue: NetMessage[] = [];
  private closed = false;

  public constructor(
    private readonly sender: (message: NetMessage) => void,
    private readonly closer: () => void,
  ) {}

  public send(message: NetMessage): void {
    if (!this.closed) {
      this.sender(message);
    }
  }

  public onMessage(handler: (message: NetMessage) => void): void {
    this.messageHandler = handler;
    const queued = this.queue;
    this.queue = [];
    queued.forEach(handler);
  }

  public onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  public close(): void {
    if (!this.closed) {
      this.closed = true;
      this.closer();
    }
  }

  public receive(message: NetMessage): void {
    if (this.messageHandler) {
      this.messageHandler(message);
    } else {
      this.queue.push(message);
    }
  }

  public dropped(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.closeHandlers.forEach((handler) => handler());
  }
}

/** One connection; closing it also ends `peer` when given (a guest's own peer, not the host's room). */
const fromConnection = (connection: DataConnection, peer?: Peer): Channel => {
  const channel = new Channel((message) => connection.send(message), () => {
    connection.close();
    peer?.destroy();
  });
  connection.on('data', (data) => channel.receive(data as NetMessage));
  connection.on('close', () => channel.dropped());
  connection.on('error', () => channel.dropped());
  return channel;
};

/** Opens a room under a fresh code (a new one if that code is taken) and takes guests as they connect. */
const hostPeerRoom = (): Promise<HostedRoom> => new Promise((resolve, reject) => {
  const attempt = (triesLeft: number): void => {
    const code = makeRoomCode();
    const peer = new Peer(peerIdFor(code));
    let opened = false;
    peer.on('open', () => {
      opened = true;
      const door = guestDoor();
      peer.on('connection', (connection) => {
        connection.on('open', () => door.arrive(fromConnection(connection)));
      });
      resolve({ code, onGuest: door.onGuest, close: () => peer.destroy() });
    });
    peer.on('error', (error) => {
      if (!opened && error.type === 'unavailable-id' && triesLeft > 0) {
        peer.destroy();
        attempt(triesLeft - 1);
      } else if (!opened) {
        peer.destroy();
        reject(new Error(`Couldn't open a room (${error.type}).`));
      }
    });
  };
  attempt(3);
});

const joinPeerRoom = (code: string): Promise<Transport> => new Promise((resolve, reject) => {
  const peer = new Peer();
  peer.on('open', () => {
    // JSON, so absent fields stay absent (the default binary packing turns them into null).
    const connection = peer.connect(peerIdFor(code), { reliable: true, serialization: 'json' });
    connection.on('open', () => resolve(fromConnection(connection, peer)));
  });
  peer.on('error', (error) => {
    peer.destroy();
    reject(new Error(error.type === 'peer-unavailable' ? 'No room with that code.' : `Couldn't connect (${error.type}).`));
  });
});

/** Between tabs: one BroadcastChannel per room, the host `'host'` and each guest a random id; the host writes to one guest at a time. */
interface LocalEnvelope {
  from: string;
  /** Host → this guest only (else to every guest: the room closing). */
  to?: string;
  message?: NetMessage;
  bye?: boolean;
}

const hostLocalRoom = (): Promise<HostedRoom> => {
  const code = makeRoomCode();
  const broadcast = new BroadcastChannel(`tower-guard-${code}`);
  let closed = false;
  const post = (envelope: LocalEnvelope): void => {
    if (!closed) {
      broadcast.postMessage(envelope);
    }
  };
  const guests = new Map<string, Channel>();
  const door = guestDoor();
  broadcast.onmessage = (event: MessageEvent<LocalEnvelope>) => {
    const { from, message, bye } = event.data;
    if (from === 'host') {
      return;
    }
    const known = guests.get(from);
    if (bye) {
      guests.delete(from);
      known?.dropped();
    } else if (known && message) {
      known.receive(message);
    } else if (message?.t === 'hello') {
      const channel = new Channel((next) => post({ from: 'host', to: from, message: next }), () => {
        guests.delete(from);
        post({ from: 'host', to: from, bye: true });
      });
      guests.set(from, channel);
      door.arrive(channel);
    }
  };
  return Promise.resolve({
    code,
    onGuest: door.onGuest,
    close: () => {
      if (!closed) {
        closed = true;
        post({ from: 'host', bye: true });
        broadcast.close();
      }
    },
  });
};

const joinLocalRoom = (code: string): Promise<Transport> => {
  const id = Math.random().toString(36).slice(2, 10);
  const broadcast = new BroadcastChannel(`tower-guard-${code}`);
  const channel = new Channel((message) => broadcast.postMessage({ from: id, message }), () => {
    broadcast.postMessage({ from: id, bye: true });
    broadcast.close();
  });
  broadcast.onmessage = (event: MessageEvent<LocalEnvelope>) => {
    const { from, to, message, bye } = event.data;
    if (from !== 'host' || (to !== undefined && to !== id)) {
      return;
    }
    if (bye) {
      channel.dropped();
    } else if (message) {
      channel.receive(message);
    }
  };
  return Promise.resolve(channel);
};

export const hostRoom = (mode: TransportMode): Promise<HostedRoom> => (mode === 'local' ? hostLocalRoom() : hostPeerRoom());

export const joinRoom = (code: string, mode: TransportMode): Promise<Transport> => (mode === 'local' ? joinLocalRoom(code) : joinPeerRoom(code));
