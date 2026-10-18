import { BANNERS, ENEMY_TOWER_X, PLAYER_TOWER_X } from '../config';
import type { EnemyArchetype } from '../data/enemyKinds';

/**
 * The run's Banners option (pure, tested): each keep has a banner. A carrier of the other team who reaches it takes
 * it; killed, he drops it where he fell, and it lies there (it never goes back by itself) until any carrier of either
 * team picks it up. Brought to the carrier's own keep, a foe's banner wins the level for his team, his own goes back
 * up. The scene (scenes/BattleBanners.ts) steps it and draws it; the AIs ask it who carries what.
 */

/** Whose banner (and which team a unit fights for): the player's side or the enemy's. */
export type BannerSide = 'player' | 'enemy';

export const BANNER_SIDES: readonly BannerSide[] = ['player', 'enemy'];

export const otherSide = (side: BannerSide): BannerSide => (side === 'player' ? 'enemy' : 'player');

/** Who may carry a banner: soldiers on foot who fight hand to hand, and riders (not archers, bombers, casters, dragons). */
const CARRIER_ARCHETYPES: readonly EnemyArchetype[] = ['fighter', 'runner', 'heavy', 'grabber', 'cavalry'];

export const canCarryBanner = (archetype: EnemyArchetype): boolean => CARRIER_ARCHETYPES.includes(archetype);

/** Where `side`'s banner stands at home: in front of its keep. */
export const bannerHomeX = (side: BannerSide): number =>
  side === 'player' ? PLAYER_TOWER_X + BANNERS.standOffset : ENEMY_TOWER_X - BANNERS.standOffset;

/** A carrier of `team` at `x` has reached his own keep. */
export const reachedKeep = (team: BannerSide, x: number): boolean =>
  team === 'player' ? x <= PLAYER_TOWER_X + BANNERS.deliverReach : x >= ENEMY_TOWER_X - BANNERS.deliverReach;

/** Who walks with his team's bearer to guard him: fighters and archers, not bombers, zombies, casters or dragons. */
const ESCORT_ARCHETYPES: readonly EnemyArchetype[] = ['fighter', 'runner', 'heavy', 'cavalry', 'archer'];

export const escortsBanner = (archetype: EnemyArchetype): boolean => ESCORT_ARCHETYPES.includes(archetype);

/** Where the `rank`-th enemy (0 = nearest) escorting a bearer at `bearerX` walks: behind him, towards the player's side. */
export const enemyEscortPost = (bearerX: number, rank: number): number => bearerX - (rank + 1) * BANNERS.escortSpacing;

export type BannerPlace<U> = { at: 'home' } | { at: 'carried'; by: U } | { at: 'dropped'; x: number };

/** Where a banner is, as the HUD tells it. */
export type BannerAt = BannerPlace<unknown>['at'];

export const BANNER_STATE_LABELS: Readonly<Record<BannerAt, string>> = { home: 'at the keep', carried: 'carried off', dropped: 'on the ground' };

export interface BannerEvent<U> {
  /** taken: off its stand or the ground; dropped: its carrier fell; returned: back at home; captured: the level ends. */
  kind: 'taken' | 'dropped' | 'returned' | 'captured';
  side: BannerSide;
  by?: U;
  x: number;
}

export interface BannerUnit {
  readonly x: number;
}

/** What the banners need to know of a unit. */
export interface BannerRules<U> {
  team(unit: U): BannerSide;
  /** Alive, on its feet and of a kind that carries (canCarryBanner). */
  canCarry(unit: U): boolean;
  /** Still alive (a fallen carrier drops the banner). */
  alive(unit: U): boolean;
  /** Where his banner falls when he does (default: where he stands; one set in the ground stays there). */
  dropX?(unit: U): number;
}

export class Banners<U extends BannerUnit> {
  private readonly places: Record<BannerSide, BannerPlace<U>> = { player: { at: 'home' }, enemy: { at: 'home' } };
  /** Who goes to pick up a dropped banner (the nearest carrier of each team), and where it lies. */
  private fetchers = new Map<U, number>();
  private result: 'won' | 'lost' | undefined;

  public constructor(private readonly rules: BannerRules<U>) {}

  public place(side: BannerSide): BannerPlace<U> {
    return this.places[side];
  }

  /** Where `side`'s banner is now. */
  public x(side: BannerSide): number {
    const place = this.places[side];
    return place.at === 'home' ? bannerHomeX(side) : place.at === 'dropped' ? place.x : place.by.x;
  }

  /** The banner `unit` carries, if any. */
  public carriedBy(unit: U): BannerSide | undefined {
    return BANNER_SIDES.find((side) => {
      const place = this.places[side];
      return place.at === 'carried' && place.by === unit;
    });
  }

  /** The foe carrying `team`'s banner off: the one `team` must stop. */
  public thief(team: BannerSide): U | undefined {
    const place = this.places[team];
    return place.at === 'carried' && this.rules.team(place.by) !== team ? place.by : undefined;
  }

  /** `team`'s own man carrying a banner (his comrades escort him). */
  public bearer(team: BannerSide): U | undefined {
    return BANNER_SIDES.map((side) => this.places[side])
      .map((place) => (place.at === 'carried' && this.rules.team(place.by) === team ? place.by : undefined))
      .find((unit) => unit !== undefined);
  }

  /** Where `unit` goes to pick up a dropped banner, if it is the one of its team sent for it. */
  public fetchX(unit: U): number | undefined {
    return this.fetchers.get(unit);
  }

  /** Won (a foe's banner brought home), lost (ours brought to theirs), or still on. */
  public get outcome(): 'won' | 'lost' | undefined {
    return this.result;
  }

  /** One frame: fallen carriers drop, carriers who got home deliver, carriers within reach take. */
  public step(units: readonly U[]): BannerEvent<U>[] {
    const events: BannerEvent<U>[] = [];
    BANNER_SIDES.forEach((side) => {
      const place = this.places[side];
      if (place.at === 'carried') {
        const { by } = place;
        if (!this.rules.alive(by)) {
          const x = this.rules.dropX?.(by) ?? by.x;
          this.places[side] = { at: 'dropped', x };
          events.push({ kind: 'dropped', side, by, x });
        } else if (reachedKeep(this.rules.team(by), by.x)) {
          if (this.rules.team(by) === side) {
            this.places[side] = { at: 'home' };
            events.push({ kind: 'returned', side, by, x: by.x });
          } else {
            this.result ??= side === 'enemy' ? 'won' : 'lost';
            events.push({ kind: 'captured', side, by, x: by.x });
          }
        }
        return;
      }
      const x = this.x(side);
      // At home only a foe takes it; lying on the ground anyone who carries.
      const taker = this.nearest(units, x, (unit) => place.at === 'dropped' || this.rules.team(unit) !== side);
      if (taker && Math.abs(taker.x - x) <= BANNERS.pickupRadius) {
        this.places[side] = { at: 'carried', by: taker };
        events.push({ kind: 'taken', side, by: taker, x });
      }
    });
    this.fetchers = new Map();
    BANNER_SIDES.forEach((side) => {
      const place = this.places[side];
      if (place.at !== 'dropped') {
        return;
      }
      BANNER_SIDES.forEach((team) => {
        const fetcher = this.nearest(units, place.x, (unit) => this.rules.team(unit) === team && !this.fetchers.has(unit));
        if (fetcher) {
          this.fetchers.set(fetcher, place.x);
        }
      });
    });
    return events;
  }

  /** The nearest free carrier to `x` that `allowed` lets through. */
  private nearest(units: readonly U[], x: number, allowed: (unit: U) => boolean): U | undefined {
    let best: U | undefined;
    units.forEach((unit) => {
      if (this.rules.canCarry(unit) && this.carriedBy(unit) === undefined && allowed(unit)
        && (best === undefined || Math.abs(unit.x - x) < Math.abs(best.x - x))) {
        best = unit;
      }
    });
    return best;
  }
}
