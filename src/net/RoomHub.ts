import type { NetMessage } from './protocol';
import { compactOrder, firstFreeSeat } from './seats';
import type { HostedRoom, RoomLink, Transport } from './Transport';

/** A refused guest gets this long to read the `full` message before the link closes. */
const REFUSE_CLOSE_MS = 600;

/**
 * Co-op host: the room's guests by seat (player index; seat 0 is the host's own) as one RoomLink. A guest takes
 * the lowest free seat (a full room refuses them); a guest who leaves frees their seat, and `compact` closes the gaps
 * (only between battles: net/coopLink.ts).
 */
export class RoomHub implements RoomLink {
  private seats: Array<Transport | undefined> = [undefined];
  private handler?: (message: NetMessage, from: number) => void;
  private queue: Array<[NetMessage, number]> = [];
  public onJoin?: (seat: number) => void;
  public onLeave?: (seat: number) => void;

  public constructor(private readonly room: HostedRoom, private readonly maxPlayers: number) {}

  /** Lets guests in (once `onJoin` / `onLeave` are set). */
  public open(): void {
    this.room.onGuest((guest) => this.admit(guest));
  }

  /** Who sits where (the host's seat always taken). */
  public present(): boolean[] {
    return this.seats.map((guest, seat) => seat === 0 || guest !== undefined);
  }

  /** Closes the gaps; the result maps each new seat to the old one. */
  public compact(): number[] {
    const order = compactOrder(this.present());
    this.seats = order.map((seat) => this.seats[seat]);
    return order;
  }

  public send(message: NetMessage): void {
    this.seats.forEach((guest) => guest?.send(message));
  }

  public sendTo(player: number, message: NetMessage): void {
    this.seats[player]?.send(message);
  }

  public onMessage(handler: (message: NetMessage, from: number) => void): void {
    this.handler = handler;
    this.queue.splice(0).forEach(([message, from]) => handler(message, from));
  }

  public close(): void {
    this.seats.forEach((guest) => guest?.close());
    this.seats = [undefined];
    this.room.close();
  }

  private admit(guest: Transport): void {
    const seat = firstFreeSeat(this.present(), this.maxPlayers);
    if (seat === undefined) {
      guest.send({ t: 'full' });
      setTimeout(() => guest.close(), REFUSE_CLOSE_MS);
      return;
    }
    this.seats[seat] = guest;
    guest.onMessage((message) => {
      const from = this.seats.indexOf(guest);
      if (from > 0 && message.t !== 'hello') {
        this.deliver(message, from);
      }
    });
    guest.onClose(() => {
      const from = this.seats.indexOf(guest);
      if (from <= 0) {
        return;
      }
      this.seats[from] = undefined;
      while (this.seats.length > 1 && this.seats[this.seats.length - 1] === undefined) {
        this.seats.pop();
      }
      this.onLeave?.(from);
    });
    this.onJoin?.(seat);
  }

  private deliver(message: NetMessage, from: number): void {
    if (this.handler) {
      this.handler(message, from);
    } else {
      this.queue.push([message, from]);
    }
  }
}

/** Co-op guest: the link to the host as a RoomLink (everything comes from player 0). */
export const guestLink = (transport: Transport): RoomLink => ({
  send: (message) => transport.send(message),
  sendTo: (_player, message) => transport.send(message),
  onMessage: (handler) => transport.onMessage((message) => handler(message, 0)),
  close: () => transport.close(),
});
