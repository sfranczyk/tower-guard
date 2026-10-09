import { describe, expect, it } from 'vitest';
import { FROST_FREEZE_BRUTE_MS, FROST_FREEZE_MS, KNIGHT_ARMOR, PIN_DURATION_MS, PIN_DURATION_ZOMBIE_MS } from '../config';
import { burnDurationMs, freezeDurationMs } from '../systems/afflictions';
import { resistsVortex } from '../systems/vortex';
import { ARCHETYPES, ENEMY_KINDS, ENEMY_TYPES, RACES, enemyArchetype, enemyArmor, enemyMass, enemyTraits, isFlyingType } from './enemyKinds';

describe('ENEMY_KINDS', () => {
  it('lists every enemy once, in the setup order', () => {
    expect(ENEMY_TYPES).toEqual(['basic', 'fast', 'tank', 'archer', 'dragon', 'fireDragon', 'kamikaze', 'zombie', 'knight', 'hammerKnight', 'priest']);
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
    expect(of('knight')).toEqual(['fighter', 'human']);
    expect(of('hammerKnight')).toEqual(['heavy', 'human']);
    expect(of('priest')).toEqual(['healer', 'human']);
  });

  it('weighs each enemy (a fighter 1.2): goblins lightest, then the undead, knights heavier, ogres heaviest on the ground', () => {
    expect(Object.fromEntries(ENEMY_TYPES.filter((type) => !isFlyingType(type)).map((type) => [type, enemyMass(type)]))).toEqual({
      fast: 0.8, zombie: 1, priest: 1.2, archer: 1.2, basic: 1.2, kamikaze: 1.4, knight: 1.9, hammerKnight: 2.5, tank: 4.2,
    });
  });

  it('armours only the knights', () => {
    expect(ENEMY_TYPES.filter((type) => enemyArmor(type) < 1)).toEqual(['knight', 'hammerKnight']);
    expect(enemyArmor('knight')).toBe(KNIGHT_ARMOR);
    expect(enemyArmor('basic')).toBe(1);
  });

  it('makes every enemy of a magical race magical (dragons), and the priest', () => {
    ENEMY_TYPES.forEach((type) => {
      const { race, magical } = ENEMY_KINDS[type];
      if (RACES[race].magical) {
        expect(magical).toBe(true);
      }
    });
    expect(ENEMY_TYPES.filter((type) => ENEMY_KINDS[type].magical)).toEqual(['dragon', 'fireDragon', 'priest']);
  });

  it('flies exactly the dragons', () => {
    expect(ENEMY_TYPES.filter(isFlyingType)).toEqual(['dragon', 'fireDragon']);
    expect(Object.entries(ARCHETYPES).filter(([, info]) => info.flies).map(([name]) => name)).toEqual(['skyArcher', 'fireBreather']);
  });

  it('lets only clubbers carry a club (sword, hammer and scepter too), only kamikazes detonate and only priests heal', () => {
    expect(ENEMY_TYPES.filter((type) => enemyArchetype(type).club)).toEqual(['basic', 'fast', 'tank', 'knight', 'hammerKnight', 'priest']);
    expect(ENEMY_TYPES.filter((type) => enemyArchetype(type).heals)).toEqual(['priest']);
    expect(ENEMY_TYPES.filter((type) => enemyArchetype(type).detonates)).toEqual(['kamikaze']);
    expect(ENEMY_TYPES.filter((type) => enemyArchetype(type).breathesFire)).toEqual(['fireDragon']);
  });

  it('takes its traits from its race, with its own overrides', () => {
    expect(enemyTraits('tank')).toEqual({ mass: 4.2, freezeMs: FROST_FREEZE_BRUTE_MS, burnFactor: 1, pinMs: 0, healable: true });
    expect(enemyTraits('basic')).toEqual({ mass: 1.2, freezeMs: FROST_FREEZE_MS, burnFactor: 1, pinMs: PIN_DURATION_MS, healable: true });
    expect(ENEMY_TYPES.filter((type) => !enemyTraits(type).healable)).toEqual(['zombie']);
    expect(enemyTraits('zombie').pinMs).toBe(PIN_DURATION_ZOMBIE_MS);
    expect(enemyTraits('dragon').burnFactor).toBe(1);
    expect(enemyTraits('fireDragon').burnFactor).toBe(0);
  });

  it('drives the arrows\' effects through the traits', () => {
    expect(ENEMY_TYPES.filter((type) => resistsVortex(enemyMass(type)))).toEqual(['tank', 'dragon', 'fireDragon']);
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
