import { describe, expect, it } from 'vitest';
import { FIRE_PATCH, WEATHER_ARROWS } from '../config';
import { frostFreezesAtOnce, groundFireChance, rollArrowMishap, weatherArrowNote } from './weatherArrows';

/** Plays back the given numbers, then repeats the last. */
const sequence = (...values: number[]): (() => number) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};

describe('rollArrowMishap', () => {
  it('blasts explosive arrows in a sandstorm and douses fire arrows in the rain', () => {
    expect(rollArrowMishap('sandstorm', 'explosive', sequence(0, 0))?.kind).toBe('blast');
    expect(rollArrowMishap('storm', 'fire', sequence(0, 0))?.kind).toBe('douse');
  });

  it('leaves other arrows and other weather alone', () => {
    expect(rollArrowMishap('sandstorm', 'fire', sequence(0))).toBeUndefined();
    expect(rollArrowMishap('storm', 'explosive', sequence(0))).toBeUndefined();
    expect(rollArrowMishap('snow', 'frost', sequence(0))).toBeUndefined();
    expect(rollArrowMishap('clear', 'explosive', sequence(0))).toBeUndefined();
  });

  it('goes by its chance', () => {
    expect(rollArrowMishap('sandstorm', 'explosive', sequence(WEATHER_ARROWS.sandstormBlastChance - 0.01, 0))).toBeDefined();
    expect(rollArrowMishap('sandstorm', 'explosive', sequence(WEATHER_ARROWS.sandstormBlastChance))).toBeUndefined();
    expect(rollArrowMishap('storm', 'fire', sequence(WEATHER_ARROWS.rainDouseChance - 0.01, 0))).toBeDefined();
    expect(rollArrowMishap('storm', 'fire', sequence(WEATHER_ARROWS.rainDouseChance))).toBeUndefined();
  });

  it('strikes between minMs and maxMs after the shot', () => {
    expect(rollArrowMishap('storm', 'fire', sequence(0, 0))?.atMs).toBe(WEATHER_ARROWS.minMs);
    expect(rollArrowMishap('storm', 'fire', sequence(0, 1))?.atMs).toBe(WEATHER_ARROWS.maxMs);
  });
});

describe('ground fire and frost by weather', () => {
  it('catches less in the rain and never in the snow', () => {
    expect(groundFireChance('clear')).toBe(FIRE_PATCH.chance);
    expect(groundFireChance('storm')).toBe(WEATHER_ARROWS.rainGroundFire);
    expect(groundFireChance('snow')).toBe(0);
  });

  it('freezes at once only on snow', () => {
    expect(frostFreezesAtOnce('snow')).toBe(true);
    expect(frostFreezesAtOnce('storm')).toBe(false);
  });

  it('has a note only for weather that changes the arrows', () => {
    expect(weatherArrowNote('fair')).toBeUndefined();
    expect(weatherArrowNote('sandstorm')).toMatch(/explosive/);
  });
});
