import { describe, expect, it } from 'vitest';
import { BANNERS, ENEMY_TOWER_X, PLAYER_TOWER_X } from '../config';
import { Banners, bannerHomeX, canCarryBanner, type BannerSide } from './banners';

interface Unit {
  x: number;
  team: BannerSide;
  alive: boolean;
  carrier: boolean;
}

const unit = (team: BannerSide, x: number, carrier = true): Unit => ({ x, team, alive: true, carrier });

const banners = (): Banners<Unit> => new Banners<Unit>({
  team: (u) => u.team,
  canCarry: (u) => u.alive && u.carrier,
  alive: (u) => u.alive,
});

describe('canCarryBanner', () => {
  it('lets foot fighters and riders carry, not archers, bombers or casters', () => {
    expect(canCarryBanner('fighter')).toBe(true);
    expect(canCarryBanner('cavalry')).toBe(true);
    expect(canCarryBanner('archer')).toBe(false);
    expect(canCarryBanner('kamikaze')).toBe(false);
    expect(canCarryBanner('healer')).toBe(false);
  });
});

describe('Banners', () => {
  it('a foe reaching a keep takes its banner; its own side does not', () => {
    const field = banners();
    const guard = unit('player', bannerHomeX('player'));
    field.step([guard]);
    expect(field.place('player').at).toBe('home');
    const raider = unit('enemy', bannerHomeX('player') + BANNERS.pickupRadius - 1);
    const events = field.step([guard, raider]);
    expect(events.map((event) => event.kind)).toEqual(['taken']);
    expect(field.carriedBy(raider)).toBe('player');
    expect(field.thief('player')).toBe(raider);
    expect(field.bearer('enemy')).toBe(raider);
  });

  it('only carriers take it', () => {
    const field = banners();
    field.step([unit('enemy', bannerHomeX('player'), false)]);
    expect(field.place('player').at).toBe('home');
  });

  it('a fallen carrier drops it where he fell; it stays there and the nearest of each team is sent for it', () => {
    const field = banners();
    const raider = unit('enemy', bannerHomeX('player'));
    field.step([raider]);
    raider.x = 900;
    raider.alive = false;
    expect(field.step([raider]).map((event) => event.kind)).toEqual(['dropped']);
    const near = unit('player', 700);
    const far = unit('player', 400);
    const foe = unit('enemy', 1200);
    field.step([near, far, foe]);
    expect(field.place('player')).toEqual({ at: 'dropped', x: 900 });
    expect(field.fetchX(near)).toBe(900);
    expect(field.fetchX(far)).toBeUndefined();
    expect(field.fetchX(foe)).toBe(900);
  });

  it('a soldier brings his own banner back home', () => {
    const field = banners();
    const raider = unit('enemy', bannerHomeX('player'));
    field.step([raider]);
    raider.alive = false;
    field.step([raider]);
    const squire = unit('player', raider.x);
    field.step([squire]);
    expect(field.carriedBy(squire)).toBe('player');
    squire.x = PLAYER_TOWER_X;
    expect(field.step([squire]).map((event) => event.kind)).toEqual(['returned']);
    expect(field.place('player').at).toBe('home');
    expect(field.outcome).toBeUndefined();
  });

  it("a foe's banner brought home wins, ours brought to theirs loses", () => {
    const won = banners();
    const squire = unit('player', bannerHomeX('enemy'));
    won.step([squire]);
    squire.x = PLAYER_TOWER_X + BANNERS.deliverReach;
    expect(won.step([squire]).map((event) => event.kind)).toEqual(['captured']);
    expect(won.outcome).toBe('won');

    const lost = banners();
    const raider = unit('enemy', bannerHomeX('player'));
    lost.step([raider]);
    raider.x = ENEMY_TOWER_X;
    lost.step([raider]);
    expect(lost.outcome).toBe('lost');
  });

  it('one carrier holds one banner', () => {
    const field = banners();
    const squire = unit('player', bannerHomeX('enemy'));
    field.step([squire]);
    const enemyBanner = field.place('enemy');
    expect(enemyBanner.at === 'carried' && enemyBanner.by).toBe(squire);
    expect(field.bearer('player')).toBe(squire);
    expect(field.thief('player')).toBeUndefined();
  });
});
