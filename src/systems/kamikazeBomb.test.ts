import { describe, expect, it } from 'vitest';
import { KAMIKAZE_BOMB } from '../config';
import { BombFuses, bombChance, bombGoesOff } from './kamikazeBomb';

describe('bombChance', () => {
  it('always goes off in a blast, a fatal fall or on reaching its target', () => {
    expect(bombChance('blast', false)).toBe(1);
    expect(bombChance('fall', false)).toBe(1);
    expect(bombChance('contact', false)).toBe(1);
  });

  it('fire and lightning are a gamble', () => {
    expect(bombChance('fire', false)).toBe(KAMIKAZE_BOMB.fireChance);
    expect(bombChance('lightning', false)).toBe(KAMIKAZE_BOMB.lightningChance);
    expect(bombGoesOff('fire', false, KAMIKAZE_BOMB.fireChance - 0.01)).toBe(true);
    expect(bombGoesOff('fire', false, KAMIKAZE_BOMB.fireChance)).toBe(false);
  });

  it('never goes off frozen in ice', () => {
    expect(bombGoesOff('blast', true, 0)).toBe(false);
    expect(bombGoesOff('fall', true, 0)).toBe(false);
  });
});

describe('BombFuses', () => {
  it('sets each bomb off chainDelayMs after it was lit, in order', () => {
    const fuses = new BombFuses<string>();
    fuses.light('a');
    fuses.light('b');
    expect(fuses.tick(KAMIKAZE_BOMB.chainDelayMs - 1)).toEqual([]);
    fuses.light('c');
    expect(fuses.tick(1)).toEqual(['a', 'b']);
    expect(fuses.tick(KAMIKAZE_BOMB.chainDelayMs)).toEqual(['c']);
    expect(fuses.tick(1000)).toEqual([]);
  });
});
