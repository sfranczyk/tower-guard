import { describe, expect, it, vi } from 'vitest';
import type { GameContext, GameSession } from '../core/Scene';
import { DEFAULT_LOADOUT, type Loadout } from '../data/loadout';
import { enterBattle, hostCoop, isPresent, joinCoop, loadoutOf, nameOf, otherPlayers, setRoomListener, settleSeats, shareAlias, shareLoadout } from './coopLink';
import type { NetMessage } from './protocol';
import type { HostedRoom, Transport } from './Transport';

/** Two ends of a link: what one sends, the other receives (queued until it listens, like Transport's Channel); closing either drops both. */
const linkedPair = (): [Transport, Transport] => {
  const handlers: Array<((message: NetMessage) => void) | undefined> = [undefined, undefined];
  const queues: NetMessage[][] = [[], []];
  const closers: Array<Array<() => void>> = [[], []];
  let open = true;
  const end = (index: number): Transport => ({
    send: (message) => {
      if (open) {
        const copy = JSON.parse(JSON.stringify(message)) as NetMessage;
        const handler = handlers[1 - index];
        if (handler) {
          handler(copy);
        } else {
          queues[1 - index].push(copy);
        }
      }
    },
    onMessage: (handler) => {
      handlers[index] = handler;
      queues[index].splice(0).forEach(handler);
    },
    onClose: (handler) => closers[index].push(handler),
    close: () => {
      if (open) {
        open = false;
        closers[1 - index].forEach((handler) => handler());
      }
    },
  });
  return [end(0), end(1)];
};

const context = (): GameContext => ({
  session: { sandbox: { loadout: [...DEFAULT_LOADOUT] }, playerCount: 1 } as unknown as GameSession,
  ui: { setStatus: () => {} },
  goTo: vi.fn(),
}) as unknown as GameContext;

/** A room the test lets guests into by hand. */
const testRoom = (): HostedRoom & { knock(): Transport } => {
  let handler: ((guest: Transport) => void) | undefined;
  return {
    code: 'ABCDE',
    onGuest: (next) => {
      handler = next;
    },
    close: () => {},
    knock: () => {
      const [hostEnd, guestEnd] = linkedPair();
      handler?.(hostEnd);
      return guestEnd;
    },
  };
};

const hostQuiver: Loadout = ['explosive', 'normal', null];
const quivers: Loadout[] = [hostQuiver, ['fire', 'frost', 'vortex'], ['piercing', null, null], ['normal', 'fire', null]];

/** The host and `guests` guests in one room, each with their own quiver. */
const room = (guests: number): { host: GameContext; guests: GameContext[]; links: Transport[]; door: ReturnType<typeof testRoom> } => {
  const door = testRoom();
  const host = context();
  hostCoop(host, door, hostQuiver, 'Stan');
  const links: Transport[] = [];
  const joined = Array.from({ length: guests }, (_, index) => {
    const guest = context();
    const link = door.knock();
    links.push(link);
    joinCoop(guest, 'ABCDE', link, quivers[index + 1], index === 0 ? '' : `Guest ${index + 1}`);
    return guest;
  });
  return { host, guests: joined, links, door };
};

describe('co-op room', () => {
  it('seats up to three guests, each picking their own quiver and seeing everyone else\'s', () => {
    const { host, guests } = room(3);
    expect(host.session.playerCount).toBe(4);
    guests.forEach((guest, index) => {
      expect(guest.session.net!.localIndex).toBe(index + 1);
      expect(guest.session.playerCount).toBe(4);
    });
    [host, ...guests].forEach(({ session }) => {
      quivers.forEach((quiver, index) => expect(loadoutOf(session, index)).toEqual(quiver));
      expect(otherPlayers(session)).toHaveLength(3);
    });

    let heard = 0;
    setRoomListener(() => {
      heard += 1;
    });
    shareLoadout(guests[1].session, ['vortex', null, null]);
    setRoomListener(undefined);
    expect(heard).toBeGreaterThan(0);
    [host, ...guests].forEach(({ session }) => expect(loadoutOf(session, 2)).toEqual(['vortex', null, null]));
  });

  it('passes everyone\'s alias round, and a change of it', () => {
    const { host, guests } = room(3);
    [host, ...guests].forEach(({ session }) => {
      expect([0, 1, 2, 3].map((index) => nameOf(session, index))).toEqual(['Stan', 'Player 2', 'Guest 2', 'Guest 3']);
    });
    shareAlias(guests[0].session, '  Robin  ');
    shareAlias(host.session, '');
    [host, ...guests].forEach(({ session }) => {
      expect(nameOf(session, 0)).toBe('Host');
      expect(nameOf(session, 1)).toBe('Robin');
    });
  });

  it('turns a fifth player away', () => {
    vi.useFakeTimers();
    const { door } = room(3);
    const late = context();
    joinCoop(late, 'ABCDE', door.knock(), quivers[1], '');
    vi.runAllTimers();
    vi.useRealTimers();
    expect(late.session.net).toBeUndefined();
    expect(late.session.coopNotice).toMatch(/full/);
  });

  it('closes up the seats of a guest who left in the lobby, renumbering the others', () => {
    const { host, guests, links } = room(3);
    links[0].close();
    expect(host.session.playerCount).toBe(3);
    expect(guests[1].session.net!.localIndex).toBe(1);
    expect(guests[2].session.net!.localIndex).toBe(2);
    expect(loadoutOf(host.session, 1)).toEqual(quivers[2]);
    expect(nameOf(guests[2].session, 1)).toBe('Guest 2');
  });

  it('keeps a seat empty (and the bowman standing) while a battle is on, until back in the lobby', () => {
    const { host, guests, links } = room(2);
    enterBattle(host.session);
    links[0].close();
    expect(isPresent(host.session, 1)).toBe(false);
    expect(host.session.playerCount).toBe(3);
    settleSeats(host.session);
    expect(host.session.playerCount).toBe(2);
    expect(guests[1].session.net!.localIndex).toBe(1);
  });

  it('passes other messages on to the scenes, queued until one listens', () => {
    const { host, guests } = room(1);
    host.session.net!.transport.send({ t: 'lobby' });
    const received: NetMessage[] = [];
    guests[0].session.net!.transport.onMessage((message) => received.push(message));
    expect(received).toEqual([{ t: 'lobby' }]);
  });

  it('sends a guest back to the lobby when the host leaves', () => {
    const { host, guests } = room(1);
    host.session.net!.transport.close();
    expect(guests[0].session.net).toBeUndefined();
    expect(guests[0].goTo).toHaveBeenCalledWith('coop');
  });

  it('alone, the battle setup quiver counts', () => {
    const { session } = context();
    expect(loadoutOf(session, 0)).toEqual([...DEFAULT_LOADOUT]);
    expect(otherPlayers(session)).toEqual([]);
  });
});
