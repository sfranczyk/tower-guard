import { describe, expect, it } from 'vitest';
import { FROST_FREEZE_BRUTE_MS, FROST_FREEZE_MS, PIN_DURATION_MS, PIN_DURATION_ZOMBIE_MS } from '../config';
import { burnDurationMs, freezeDurationMs } from '../systems/afflictions';
import { resistsVortex } from '../systems/vortex';
import { ARCHETYPES, ENEMY_KINDS, ENEMY_TYPES, RACES, enemyArchetype, enemyTraits, isFlyingType } from './enemyKinds';

describe('ENEMY_KINDS', () => {
  it('lists every enemy once, in the setup order', () => {
    expect(ENEMY_TYPES).toEqual(['basic', 'fast', 'tank', 'archer', 'dragon', 'fireDragon', 'kamikaze', 'zombie']);
  });

  it('gives each enemy its archetype and race', () => {
    const of = (type: keyof typeof ENEMY_KINDS) => [ENEMY_KINDS[type].archetype, ENEMY_KINDS[type].race];
    expect(of('basic')).toEqual(['fighter', 'human']);
    expect(of('archer')).toEqual(['archer', 'human']);
    expect(of('kamikaze')).toEqual(['kamikaze', 'human']);
    expect(of('fast')).toEqual(['runner', 'goblin']);
    expect(of('tank')).toEqual(['heavy', 'ogre']);
    expect(of('zombie')).toEqual(['grabber', 'undead']);
    expect(of('dragon')).toEqual(['skyArcher', 'dragon']);
    expect(of('fireDragon')).toEqual(['fireBreather', 'dragon']);
  });

  it('makes every enemy of a magical race magical (dragons), and only those for now', () => {
    ENEMY_TYPES.forEach((type) => {
      const { race, magical } = ENEMY_KINDS[type];
      if (RACES[race].magical) {
        expect(magical).toBe(true);
      }
    });
    expect(ENEMY_TYPES.filter((type) => ENEMY_KINDS[type].magical)).toEqual(['dragon', 'fireDragon']);
  });

  it('flies exactly the dragons', () => {
    expect(ENEMY_TYPES.filter(isFlyingType)).toEqual(['dragon', 'fireDragon']);
    expect(Object.entries(ARCHETYPES).filter(([, info]) => info.flies).map(([name]) => name)).toEqual(['skyArcher', 'fireBreather']);
  });

  it('lets only clubbers carry a club and only kamikazes detonate', () => {
    expect(ENEMY_TYPES.filter((type) => enemyArchetype(type).club)).toEqual(['basic', 'fast', 'tank']);
    expect(ENEMY_TYPES.filter((type) => enemyArchetype(type).detonates)).toEqual(['kamikaze']);
    expect(ENEMY_TYPES.filter((type) => enemyArchetype(type).breathesFire)).toEqual(['fireDragon']);
  });

  it('takes its traits from its race, with its own overrides', () => {
    expect(enemyTraits('tank')).toEqual({ heavy: true, freezeMs: FROST_FREEZE_BRUTE_MS, burnFactor: 1, pinMs: 0 });
    expect(enemyTraits('basic')).toEqual({ heavy: false, freezeMs: FROST_FREEZE_MS, burnFactor: 1, pinMs: PIN_DURATION_MS });
    expect(enemyTraits('zombie').pinMs).toBe(PIN_DURATION_ZOMBIE_MS);
    expect(enemyTraits('dragon').burnFactor).toBe(1);
    expect(enemyTraits('fireDragon').burnFactor).toBe(0);
  });

  it('drives the arrows\' effects through the traits', () => {
    expect(ENEMY_TYPES.filter(resistsVortex)).toEqual(['tank']);
    expect(freezeDurationMs('dragon')).toBe(0);
    expect(freezeDurationMs('fireDragon')).toBe(0);
    expect(freezeDurationMs('tank')).toBe(FROST_FREEZE_BRUTE_MS);
    expect(burnDurationMs('fireDragon')).toBe(0);
    expect(burnDurationMs('zombie')).toBeGreaterThan(burnDurationMs('basic'));
  });

  it('brings tougher enemies later in a level', () => {
    expect(ENEMY_KINDS.basic.arrival).toBe(0);
    expect(ENEMY_KINDS.tank.arrival).toBeGreaterThan(ENEMY_KINDS.basic.arrival);
    expect(ENEMY_KINDS.fireDragon.arrival).toBeGreaterThan(ENEMY_KINDS.tank.arrival);
  });
});
