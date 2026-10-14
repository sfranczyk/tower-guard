import { describe, expect, it } from 'vitest';
import { SHAMAN } from '../config';
import { ENEMY_KINDS, ENEMY_TYPES, enemyTraits } from '../data/enemyKinds';
import { ActiveBuff, planBuffs, shamanBuffFor, type BuffCandidate } from './shamanBuffs';

describe('shamanBuffFor', () => {
  it('hastens the soldiers, hardens the heavies, quickens archers, arms kamikazes, mends the undead, skips flyers and casters', () => {
    expect(Object.fromEntries(ENEMY_TYPES.map((type) => [type, shamanBuffFor(ENEMY_KINDS[type].archetype, enemyTraits(type))]))).toEqual({
      basic: 'haste', fast: 'haste', tank: 'stoneskin', troll: 'stoneskin', archer: 'quickDraw', dragon: undefined,
      fireDragon: undefined, kamikaze: 'blast', zombie: 'mend', knight: 'haste', hammerKnight: 'stoneskin',
      horseKnight: 'haste', priest: undefined, shaman: undefined,
    });
  });
});

describe('planBuffs', () => {
  const at = (x: number): BuffCandidate => ({ at: { x, y: 0 }, buff: 'haste', buffed: false, missing: 0 });

  it('reaches the nearest within the radius, up to the cap', () => {
    expect(planBuffs({ x: 0, y: 0 }, [at(150), at(20), at(300), at(60), at(-40)], 180, 3)).toEqual([1, 4, 3]);
  });

  it('skips the buffed, the ones it has nothing for, and the undead that are whole', () => {
    const candidates: BuffCandidate[] = [
      { ...at(10), buffed: true },
      { ...at(20), buff: undefined },
      { ...at(30), buff: 'mend', missing: 0 },
      { ...at(40), buff: 'mend', buffed: true, missing: 5 },
    ];
    expect(planBuffs({ x: 0, y: 0 }, candidates, 180, 3)).toEqual([3]);
  });
});

describe('ActiveBuff', () => {
  it('changes only what its kind changes, and wears off', () => {
    const buff = new ActiveBuff();
    expect([buff.speedFactor, buff.damageFactor, buff.drawPace, buff.blastPower, buff.steady]).toEqual([1, 1, 1, 1, false]);
    buff.apply('blast', 1000);
    expect([buff.speedFactor, buff.blastPower]).toEqual([SHAMAN.kamikazeHaste, SHAMAN.blastPower]);
    expect(SHAMAN.kamikazeHaste).toBeLessThan(SHAMAN.haste);
    buff.apply('stoneskin', 1000);
    expect([buff.speedFactor, buff.damageFactor, buff.steady]).toEqual([1, SHAMAN.stoneskinDamage, true]);
    buff.update(1000);
    expect(buff.kind).toBeUndefined();
  });

  it('goes through the co-op snapshot', () => {
    const host = new ActiveBuff();
    host.apply('quickDraw', 2500);
    const guest = new ActiveBuff();
    guest.applyNet(host.net);
    expect([guest.kind, guest.leftMs]).toEqual(['quickDraw', 2500]);
    guest.applyNet(undefined);
    expect(guest.kind).toBeUndefined();
  });
});
