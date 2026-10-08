import { describe, expect, it } from 'vitest';
import type { GameContext, GameSession } from '../core/Scene';
import { DEFAULT_LOADOUT, type Loadout } from '../data/loadout';
import { linkUp, loadoutOf, partnerLoadout, setPartnerLoadoutListener, shareLoadout } from './coopLink';
import type { NetMessage } from './protocol';
import type { Transport } from './Transport';

/** Two ends of a link: what one sends, the other receives. */
const linkedPair = (): [Transport, Transport] => {
  const handlers: Array<((message: NetMessage) => void) | undefined> = [undefined, undefined];
  const end = (index: number): Transport => ({
    send: (message) => handlers[1 - index]?.(JSON.parse(JSON.stringify(message)) as NetMessage),
    onMessage: (handler) => {
      handlers[index] = handler;
    },
    onClose: () => {},
    close: () => {},
  });
  return [end(0), end(1)];
};

const context = (): GameContext => ({
  session: { sandbox: { loadout: [...DEFAULT_LOADOUT] }, playerCount: 1 } as unknown as GameSession,
  ui: { setStatus: () => {} },
  goTo: () => {},
}) as unknown as GameContext;

const hostQuiver: Loadout = ['explosive', 'normal', null, null, null];
const guestQuiver: Loadout = ['fire', 'frost', 'vortex', null, null];

describe('co-op quivers', () => {
  it('each player picks their own and sees the other one', () => {
    const [hostEnd, guestEnd] = linkedPair();
    const host = context();
    const guest = context();
    linkUp(host, 'host', 'ABCDE', hostEnd, hostQuiver);
    linkUp(guest, 'guest', 'ABCDE', guestEnd, guestQuiver);
    expect(partnerLoadout(host.session)).toBeUndefined();

    let heard = 0;
    setPartnerLoadoutListener(() => {
      heard += 1;
    });
    shareLoadout(host.session, hostQuiver);
    shareLoadout(guest.session, guestQuiver);
    setPartnerLoadoutListener(undefined);
    expect(heard).toBe(2);

    expect(partnerLoadout(host.session)).toEqual(guestQuiver);
    expect(partnerLoadout(guest.session)).toEqual(hostQuiver);
    // Both sides agree on who fights with what.
    [host, guest].forEach(({ session }) => {
      expect(loadoutOf(session, 0)).toEqual(hostQuiver);
      expect(loadoutOf(session, 1)).toEqual(guestQuiver);
    });
  });

  it('keeps quiver messages away from the scenes, and passes the rest on (queued until a scene listens)', () => {
    const [hostEnd, guestEnd] = linkedPair();
    const host = context();
    const guest = context();
    linkUp(host, 'host', 'ABCDE', hostEnd, hostQuiver);
    linkUp(guest, 'guest', 'ABCDE', guestEnd, guestQuiver);
    host.session.net!.transport.send({ t: 'welcome' });
    shareLoadout(host.session, ['piercing', null, null, null, null]);

    const received: NetMessage[] = [];
    guest.session.net!.transport.onMessage((message) => received.push(message));
    expect(received).toEqual([{ t: 'welcome' }]);
    expect(partnerLoadout(guest.session)).toEqual(['piercing', null, null, null, null]);
  });

  it('alone, the battle setup quiver counts', () => {
    const { session } = context();
    expect(loadoutOf(session, 0)).toEqual([...DEFAULT_LOADOUT]);
    expect(partnerLoadout(session)).toBeUndefined();
  });
});
