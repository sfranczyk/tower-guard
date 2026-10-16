import { KAMIKAZE_AWARENESS } from '../config';

/**
 * A kamikaze's bomb seen from the ground: where it would blast (x) and how far. `fused`: where the kamikaze is about to
 * go off (it's running there); otherwise where it stands now, a danger only when a fused blast would set it off too.
 */
export interface BombSpot<K> {
  readonly owner: K;
  readonly x: number;
  readonly radius: number;
  readonly fused: boolean;
}

/** The ground a chain of bombs would blast and whose bombs they are. */
export interface BlastZone<K> {
  readonly left: number;
  readonly right: number;
  readonly owners: ReadonlySet<K>;
}

/**
 * The ground the bombs about to go off would blast: each fused spot with every bomb standing within a blast's reach of
 * it chained on (that bomb goes off in turn, and so on). Bombs no fused blast reaches are no zone of their own.
 */
export function blastZones<K>(spots: readonly BombSpot<K>[]): BlastZone<K>[] {
  const group = spots.map((_, index) => index);
  const root = (index: number): number => (group[index] === index ? index : (group[index] = root(group[index])));
  spots.forEach((a, i) => spots.forEach((b, j) => {
    if (j > i && Math.abs(a.x - b.x) <= Math.max(a.radius, b.radius)) {
      group[root(j)] = root(i);
    }
  }));
  const chains = new Map<number, BombSpot<K>[]>();
  spots.forEach((spot, index) => chains.set(root(index), [...(chains.get(root(index)) ?? []), spot]));
  return [...chains.values()]
    .filter((chain) => chain.some((spot) => spot.fused))
    .map((chain) => ({
      left: Math.min(...chain.map((spot) => spot.x - spot.radius)),
      right: Math.max(...chain.map((spot) => spot.x + spot.radius)),
      owners: new Set(chain.map((spot) => spot.owner)),
    }));
}

/** What makes a soldier miss a kamikaze coming. */
export interface Heedlessness {
  /** Its race's `blastAwareness` (0 = never heeds one: the undead). */
  readonly awareness: number;
  readonly healthRatio: number;
  /** Under a shaman's spell: carried away. */
  readonly buffed: boolean;
  /** Mid-swing at the bowman. */
  readonly busy: boolean;
}

/** The chance it misses a kamikaze coming: each reason on its own may make it miss (KAMIKAZE_AWARENESS). */
export function missChance({ awareness, healthRatio, buffed, busy }: Heedlessness, tune = KAMIKAZE_AWARENESS): number {
  const dazed = tune.lowHealthBelow > 0 ? Math.max(0, 1 - healthRatio / tune.lowHealthBelow) * tune.lowHealthMiss : 0;
  const heeds = [1 - awareness, dazed, buffed ? tune.buffMiss : 0, busy ? tune.busyMiss : 0]
    .reduce((chance, miss) => chance * (1 - Math.min(1, Math.max(0, miss))), 1);
  return 1 - heeds;
}

/** What a soldier does about the bombs this frame: go on, get away to `toX`, or stand (hesitating to come back). */
export type DodgeStep =
  | { readonly kind: 'free' }
  | { readonly kind: 'flee'; readonly toX: number; readonly startled: boolean }
  | { readonly kind: 'hesitate' };

/** One soldier's heed of the kamikazes: which it noticed (decided once each), fleeing, then hesitating. */
export class BlastDodge<K> {
  private readonly noticed = new Map<K, boolean>();
  private fleeing = false;
  private hesitateMs = 0;

  /**
   * `kamikazes`: the living ones (their x); `zones`: blastZones of them; `awayRight`: it gets away to the right of a
   * zone (it stands on the right of what it attacks); `miss`: its miss chance now (asked once per kamikaze noticed).
   */
  public update(x: number, awayRight: boolean, kamikazes: ReadonlyMap<K, number>, zones: readonly BlastZone<K>[], miss: () => number, deltaMs: number, random = Math.random, tune = KAMIKAZE_AWARENESS): DodgeStep {
    [...this.noticed.keys()].filter((owner) => !kamikazes.has(owner)).forEach((owner) => this.noticed.delete(owner));
    kamikazes.forEach((kx, owner) => {
      if (!this.noticed.has(owner) && Math.abs(kx - x) <= tune.noticeRange) {
        this.noticed.set(owner, random() >= miss());
      }
    });
    const reach = tune.margin + (this.fleeing ? tune.hold : 0);
    const zone = zones.find((candidate) => x >= candidate.left - reach && x <= candidate.right + reach
      && [...candidate.owners].some((owner) => this.noticed.get(owner) === true));
    if (zone) {
      const startled = !this.fleeing;
      this.fleeing = true;
      this.hesitateMs = 0;
      const out = tune.margin + tune.hold / 2;
      return { kind: 'flee', toX: awayRight ? zone.right + out : zone.left - out, startled };
    }
    if (this.fleeing) {
      this.fleeing = false;
      this.hesitateMs = tune.hesitateMinMs + random() * Math.max(0, tune.hesitateMaxMs - tune.hesitateMinMs);
    }
    this.hesitateMs = Math.max(0, this.hesitateMs - deltaMs);
    return this.hesitateMs > 0 ? { kind: 'hesitate' } : { kind: 'free' };
  }
}
