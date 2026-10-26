import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { NetMessage } from './protocol';
import { makeRoomCode, peerIdFor } from './roomCode';

/**
 * The links between the browsers of a co-op game: the host has one to each guest (up to three), a guest one to
 * the host. PeerJS (WebRTC data channel, with PeerJS's free public broker only for finding each other) over the
 * internet, or a BroadcastChannel between tabs of this browser for development (`?net=local`).
 */
export interface Transport {
  /** Reliable and in order (events, actions, the lobby). */
  send(message: NetMessage): void;
  /**
   * Lossy, unordered, newest wins (snapshots, held controls): dropped rather than queued when the link is congested,
   * so a lost or late packet never holds up the next one. Without it, `send`.
   */
  sendState?(message: NetMessage): void;
  /** Bytes sent and received so far (the ?debug readout). */
  traffic?(): Traffic;
  onMessage(handler: (message: NetMessage) => void): void;  /** The other side left or the connection dropped. */
  onClose(handler: () => void): void;
  close(): void;
}

export type TransportMode = 'peer' | 'local';

export interface Traffic {
  sent: number;
  received: number;
}

/**
 * The room as the scenes see it (net/coopLink.ts builds it): the host's links to all guests, or the guest's link to
 * the host. Messages say which player sent them (a guest hears everything from the host, player 0).
 */
export interface RoomLink {
  /** Host: to every guest; guest: to the host. */
  send(message: NetMessage): void;
  /** Host: to one guest (by player index). */
  sendTo(player: number, message: NetMessage): void;
  /** Like `send`, lossy (Transport.sendState). */
  sendState(message: NetMessage): void;
  /** Host: to one guest (by player index); guest: everything from the host. */
  traffic(player?: number): Traffic;
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
  private readonly counted: Traffic = { sent: 0, received: 0 };

  public constructor(
    private readonly sender: (message: NetMessage) => number,
    private readonly closer: () => void,
    private readonly stateSender: (message: NetMessage) => number = sender,
  ) {}

  public send(message: NetMessage): void {
    if (!this.closed) {
      this.counted.sent += this.sender(message);
    }
  }

  public sendState(message: NetMessage): void {
    if (!this.closed) {
      this.counted.sent += this.stateSender(message);
    }
  }

  public traffic(): Traffic {
    return { ...this.counted };
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

  public receive(message: NetMessage, bytes = 0): void {
    this.counted.received += bytes;
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

/** The lossy channel beside PeerJS's own: pre-agreed id on both sides, so it needs no extra signalling. */
const STATE_CHANNEL_ID = 101;
/** State is dropped while this much is still waiting to go out (else a slow uplink queues seconds of old frames). */
const STATE_BACKLOG_BYTES = 16 * 1024;
/** ... and on the reliable channel, when the lossy one isn't open. */
const RELIABLE_BACKLOG_BYTES = 64 * 1024;

const openStateChannel = (connection: DataConnection): RTCDataChannel | undefined => {
  try {
    return connection.peerConnection.createDataChannel('state', {
      negotiated: true, id: STATE_CHANNEL_ID, ordered: false, maxRetransmits: 0,
    });
  } catch {
    return undefined;
  }
};

/** One connection; closing it also ends `peer` when given (a guest's own peer, not the host's room). */
const fromConnection = (connection: DataConnection, peer?: Peer): Channel => {
  const stateChannel = openStateChannel(connection);
  const sendRaw = (message: NetMessage): number => {
    const text = JSON.stringify(message);
    connection.send(text);
    return text.length;
  };
  const sendState = (message: NetMessage): number => {
    if (stateChannel?.readyState === 'open') {
      if (stateChannel.bufferedAmount > STATE_BACKLOG_BYTES) {
        return 0;
      }
      const text = JSON.stringify(message);
      stateChannel.send(text);
      return text.length;
    }
    return (connection.dataChannel?.bufferedAmount ?? 0) > RELIABLE_BACKLOG_BYTES ? 0 : sendRaw(message);
  };
  const channel = new Channel(sendRaw, () => {
    stateChannel?.close();
    connection.close();
    peer?.destroy();
  }, sendState);
  const receive = (data: unknown): void => {
    if (typeof data === 'string') {
      channel.receive(JSON.parse(data) as NetMessage, data.length);
    }
  };
  connection.on('data', receive);
  stateChannel?.addEventListener('message', (event: MessageEvent) => receive(event.data));
  connection.on('close', () => channel.dropped());
  connection.on('error', () => channel.dropped());
  return channel;
};

/** PeerJS and its WebRTC shims load only when a room is opened or joined (a separate chunk, not in the first download). */
const loadPeer = async (): Promise<typeof Peer> => (await import('peerjs')).default;

/** Opens a room under a fresh code (a new one if that code is taken) and takes guests as they connect. */
const hostPeerRoom = async (): Promise<HostedRoom> => {
  const Peer = await loadPeer();
  return new Promise((resolve, reject) => {
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
};

const joinPeerRoom = async (code: string): Promise<Transport> => {
  const Peer = await loadPeer();
  return new Promise((resolve, reject) => {
    const peer = new Peer();
    peer.on('open', () => {
      // Raw strings, JSON-encoded here (absent fields stay absent; the default binary packing turns them into null).
      const connection = peer.connect(peerIdFor(code), { reliable: true, serialization: 'raw' });
      connection.on('open', () => resolve(fromConnection(connection, peer)));
    });
    peer.on('error', (error) => {
      peer.destroy();
      reject(new Error(error.type === 'peer-unavailable' ? 'No room with that code.' : `Couldn't connect (${error.type}).`));
    });
  });
};

/** Between tabs: one BroadcastChannel per room, the host `'host'` and each guest a random id; the host writes to one guest at a time. */
interface LocalEnvelope {
  from: string;
  /** Host → this guest only (else to every guest: the room closing). */
  to?: string;
  message?: NetMessage;
  bye?: boolean;
}

/** Between tabs nothing is encoded; the readout counts what it would be over the internet. */
const localSize = (message: NetMessage): number => JSON.stringify(message).length;

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
      known.receive(message, localSize(message));
    } else if (message?.t === 'hello') {
      const channel = new Channel((next) => {
        post({ from: 'host', to: from, message: next });
        return localSize(next);
      }, () => {
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
  const channel = new Channel((message) => {
    broadcast.postMessage({ from: id, message });
    return localSize(message);
  }, () => {
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
      channel.receive(message, localSize(message));
    }
  };
  return Promise.resolve(channel);
};

export const hostRoom = (mode: TransportMode): Promise<HostedRoom> => (mode === 'local' ? hostLocalRoom() : hostPeerRoom());

export const joinRoom = (code: string, mode: TransportMode): Promise<Transport> => (mode === 'local' ? joinLocalRoom(code) : joinPeerRoom(code));
