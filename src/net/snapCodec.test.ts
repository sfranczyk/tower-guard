import { describe, expect, it } from 'vitest';
import type { Snapshot } from './protocol';
import { decodeSnapshot, encodeSnapshot, roundDeep } from './snapCodec';

const snapshot = (): Snapshot => ({
  bowmen: [
    { x: 300.5, y: 420.3, vx: 12.3, ax: 0.7071067811865476, ay: -0.7071067811865476, power: 0.6234567, inTower: false, health: 100 },
    { x: 140, y: 380, vx: 0, ax: 1, ay: 0, power: 0, inTower: true, health: 42.5 },
  ],
  enemies: [
    { id: 3, x: 1500.4, y: 431.2, vx: -36.123456 },
    { id: 4, x: 1620.1, y: 431.9, vx: 0, aim: -2.7123456, tension: 0.83456, ready: 1, pinned: 512.345 },
  ],
  dragons: [{ id: 9, x: 1200.2, y: 210.7, aim: 3.1, tension: 0, fireAim: -1.234567, side: -1, fl: [0.5, 0.25, 1] }],
  keep: 480,
  enemyKeep: 500,
  clock: 41234.6,
});

describe('snapCodec', () => {
  it('round-trips a snapshot within the quantisation', () => {
    const decoded = decodeSnapshot(JSON.parse(JSON.stringify(encodeSnapshot(snapshot()))));
    expect(decoded.bowmen[0]).toMatchObject({ x: 300.5, y: 420.3, vx: 12.3, ax: 0.707, ay: -0.707, power: 0.623, inTower: false, health: 100 });
    expect(decoded.bowmen[1]).toMatchObject({ inTower: true, health: 42.5 });
    expect(decoded.enemies[0]).toEqual({ id: 3, x: 1500.4, y: 431.2, vx: -36.123 });
    expect(decoded.enemies[1]).toEqual({ id: 4, x: 1620.1, y: 431.9, vx: 0, aim: -2.712, tension: 0.835, ready: 1, pinned: 512.345 });
    expect(decoded.dragons[0]).toEqual({ id: 9, x: 1200.2, y: 210.7, aim: 3.1, tension: 0, fireAim: -1.235, side: -1, fl: [0.5, 0.25, 1] });
    expect(decoded).toMatchObject({ keep: 480, enemyKeep: 500, clock: 41235 });
  });

  it('leaves out what is not set', () => {
    const wire = encodeSnapshot({ ...snapshot(), clock: undefined });
    expect(wire.e[0]).toHaveLength(4);
    expect(wire.b[1]).toHaveLength(8);
    expect('c' in wire).toBe(false);
    expect(roundDeep({ a: undefined, b: { c: 1.23456 } })).toEqual({ b: { c: 1.235 } });
  });

  it('is much smaller than the plain snapshot', () => {
    const plain = snapshot();
    plain.enemies = Array.from({ length: 40 }, (_, i) => ({
      id: i, x: 1200 + i * 21.37, y: 431.27, vx: -36.123456 - i / 7, ...(i % 3 === 0 ? { aim: -2.7123456, tension: 0.83456, ready: 0.5 } : {}),
    }));
    expect(JSON.stringify(encodeSnapshot(plain)).length).toBeLessThan(JSON.stringify(plain).length * 0.5);
  });
});
