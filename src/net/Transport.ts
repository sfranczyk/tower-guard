import Peer, { type DataConnection } from 'peerjs';
import type { NetMessage } from './protocol';
import { makeRoomCode, peerIdFor } from './roomCode';

/**
 * The link between the two browsers of a co-op game. PeerJS (WebRTC data channel, with PeerJS's free public
 * broker only for finding each other) over the internet, or a BroadcastChannel between two tabs of this
 * browser for development (`?net=local`).
 */
export interface Transport {
  send(message: NetMessage): void;
  onMessage(handler: (message: NetMessage) => void): void;
  /** The other side left or the connection dropped. */
  onClose(handler: () => void): void;
  close(): void;
}

export type TransportMode = 'peer' | 'local';

/** A room the host opened: its code, and the guest once someone joins. */
export interface HostedRoom {
  code: string;
  guest: Promise<Transport>;
  close(): void;
}

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

const fromConnection = (connection: DataConnection, peer: Peer): Channel => {
  const channel = new Channel((message) => connection.send(message), () => {
    connection.close();
    peer.destroy();
  });
  connection.on('data', (data) => channel.receive(data as NetMessage));
  connection.on('close', () => channel.dropped());
  connection.on('error', () => channel.dropped());
  return channel;
};

/** Opens a room under a fresh code (a new one if that code is taken) and waits for a guest. */
const hostPeerRoom = (): Promise<HostedRoom> => new Promise((resolve, reject) => {
  const attempt = (triesLeft: number): void => {
    const code = makeRoomCode();
    const peer = new Peer(peerIdFor(code));
    let opened = false;
    peer.on('open', () => {
      opened = true;
      const guest = new Promise<Transport>((resolveGuest) => {
        peer.on('connection', (connection) => {
          connection.on('open', () => resolveGuest(fromConnection(connection, peer)));
        });
      });
      resolve({ code, guest, close: () => peer.destroy() });
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

/** Between two tabs: one BroadcastChannel per room; each side ignores its own role's messages. */
const localChannel = (code: string, role: 'host' | 'guest'): { channel: Channel; broadcast: BroadcastChannel } => {
  const broadcast = new BroadcastChannel(`tower-guard-${code}`);
  const channel = new Channel((message) => broadcast.postMessage({ from: role, message }), () => {
    broadcast.postMessage({ from: role, bye: true });
    broadcast.close();
  });
  broadcast.onmessage = (event: MessageEvent<{ from: string; message?: NetMessage; bye?: boolean }>) => {
    if (event.data.from === role) {
      return;
    }
    if (event.data.bye) {
      channel.dropped();
    } else if (event.data.message) {
      channel.receive(event.data.message);
    }
  };
  return { channel, broadcast };
};

const hostLocalRoom = (): Promise<HostedRoom> => {
  const code = makeRoomCode();
  const { channel, broadcast } = localChannel(code, 'host');
  const guest = new Promise<Transport>((resolveGuest) => {
    channel.onMessage((message) => {
      if (message.t === 'hello') {
        resolveGuest(channel);
      }
    });
  });
  return Promise.resolve({ code, guest, close: () => broadcast.close() });
};

const joinLocalRoom = (code: string): Promise<Transport> => {
  const { channel } = localChannel(code, 'guest');
  return Promise.resolve(channel);
};

export const hostRoom = (mode: TransportMode): Promise<HostedRoom> => (mode === 'local' ? hostLocalRoom() : hostPeerRoom());

export const joinRoom = (code: string, mode: TransportMode): Promise<Transport> => (mode === 'local' ? joinLocalRoom(code) : joinPeerRoom(code));
