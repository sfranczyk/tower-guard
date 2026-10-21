import type { BowmanSnap, DragonSnap, EnemySnap, Snapshot } from './protocol';

/**
 * A snapshot on the wire: positional arrays of quantised integers instead of objects with float fields (about a
 * third of the JSON). Positions in tenths of a pixel, speeds and 0..1 values in thousandths; the rarely set fields
 * (afflictions, throws, buffs, a bow's draw) ride along as one trailing object, rounded to three decimals.
 */
export interface WireSnapshot {
  /** Bowmen: x, y, vx (tenths), aim x, aim y, power (thousandths), in the keep (0/1), health (tenths), net? */
  b: Array<[number, number, number, number, number, number, number, number, BowmanSnap['net']?]>;
  /** Ground enemies: id, x, y (tenths), vx (thousandths), the rest? (an archer's bow as `w`: aim, draw, raise in thousandths) */
  e: Array<[number, number, number, number, WireEnemyRest?]>;
  /** Dragons: id, x, y (tenths), the rest. */
  d: Array<[number, number, number, Partial<DragonSnap>]>;
  /** Keep and enemy keep health. */
  k: [number, number];
  c?: number;
}

type WireEnemyRest = Partial<EnemySnap> & { w?: [number, number, number] };

const TENTHS = 10;
const THOUSANDTHS = 1000;

const q = (value: number, scale: number): number => Math.round(value * scale);

/** Numbers in nested plain data rounded to three decimals; undefined fields left out. */
export const roundDeep = <T>(value: T): T => {
  if (typeof value === 'number') {
    return (Math.round(value * THOUSANDTHS) / THOUSANDTHS) as T;
  }
  if (Array.isArray(value)) {
    return value.map(roundDeep) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value).forEach(([key, field]) => {
      if (field !== undefined) {
        out[key] = roundDeep(field);
      }
    });
    return out as T;
  }
  return value;
};

/** The fields besides the ones in the array; undefined when none is set. */
const rest = <T extends object>(value: T, skip: readonly string[]): Partial<T> | undefined => {
  const out = roundDeep(Object.fromEntries(Object.entries(value).filter(([key]) => !skip.includes(key)))) as Partial<T>;
  return Object.keys(out).length > 0 ? out : undefined;
};

export const encodeSnapshot = (snap: Snapshot): WireSnapshot => ({
  b: snap.bowmen.map((b) => {
    const row: WireSnapshot['b'][number] = [
      q(b.x, TENTHS), q(b.y, TENTHS), q(b.vx, TENTHS), q(b.ax, THOUSANDTHS), q(b.ay, THOUSANDTHS),
      q(b.power, THOUSANDTHS), b.inTower ? 1 : 0, q(b.health, TENTHS),
    ];
    if (b.net) {
      row.push(roundDeep(b.net));
    }
    return row;
  }),
  e: snap.enemies.map((e) => {
    const row: WireSnapshot['e'][number] = [e.id, q(e.x, TENTHS), q(e.y, TENTHS), q(e.vx, THOUSANDTHS)];
    const more: WireEnemyRest | undefined = rest(e, ['id', 'x', 'y', 'vx', 'aim', 'tension', 'ready']);
    if (e.aim !== undefined) {
      const bow: [number, number, number] = [q(e.aim, THOUSANDTHS), q(e.tension ?? 0, THOUSANDTHS), q(e.ready ?? 0, THOUSANDTHS)];
      row.push({ ...more, w: bow });
    } else if (more) {
      row.push(more);
    }
    return row;
  }),
  d: snap.dragons.map((d) => [d.id, q(d.x, TENTHS), q(d.y, TENTHS), rest(d, ['id', 'x', 'y']) ?? {}]),
  k: [snap.keep, snap.enemyKeep],
  ...(snap.clock !== undefined ? { c: Math.round(snap.clock) } : {}),
});

export const decodeSnapshot = (wire: WireSnapshot): Snapshot => ({
  bowmen: wire.b.map(([x, y, vx, ax, ay, power, inTower, health, net]) => ({
    x: x / TENTHS, y: y / TENTHS, vx: vx / TENTHS, ax: ax / THOUSANDTHS, ay: ay / THOUSANDTHS,
    power: power / THOUSANDTHS, inTower: inTower === 1, health: health / TENTHS, net,
  })),
  enemies: wire.e.map(([id, x, y, vx, more]) => {
    const { w, ...others } = more ?? {};
    const bow = w ? { aim: w[0] / THOUSANDTHS, tension: w[1] / THOUSANDTHS, ready: w[2] / THOUSANDTHS } : {};
    return { ...others, ...bow, id, x: x / TENTHS, y: y / TENTHS, vx: vx / THOUSANDTHS };
  }),
  dragons: wire.d.map(([id, x, y, more]) => ({ ...(more as DragonSnap), id, x: x / TENTHS, y: y / TENTHS })),
  keep: wire.k[0],
  enemyKeep: wire.k[1],
  clock: wire.c,
});
