import { describe, expect, it } from 'vitest';
import { FROST_FREEZE_BRUTE_MS, FROST_FREEZE_MS, HORSE_LEG, KNIGHT_ARMOR, PIN_DURATION_MS, PIN_DURATION_ZOMBIE_MS } from '../config';
import { burnDurationMs, freezeDurationMs } from '../systems/afflictions';
import { resistsVortex } from '../systems/vortex';
import { horseDeathKind, legHitLames, legLameChance, mountedDamage } from './enemies';
import { ARCHETYPES, ENEMY_KINDS, ENEMY_TYPES, RACES, enemyArchetype, enemyArmor, enemyMass, enemyTraits, isFlyingType } from './enemyKinds';

describe('ENEMY_KINDS', () => {
  it('lists every enemy once, in the setup order', () => {
    expect(ENEMY_TYPES).toEqual(['basic', 'fast', 'tank', 'archer', 'dragon', 'fireDragon', 'kamikaze', 'zombie', 'knight', 'hammerKnight', 'horseKnight', 'priest']);
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
    expect(of('horseKnight')).toEqual(['cavalry', 'human']);
  });

  it('weighs each enemy (a fighter 1.2): goblins lightest, then the undead, knights heavier, ogres, then horse and rider heaviest on the ground', () => {
    expect(Object.fromEntries(ENEMY_TYPES.filter((type) => !isFlyingType(type)).map((type) => [type, enemyMass(type)]))).toEqual({
      fast: 0.8, zombie: 1, priest: 1.2, archer: 1.2, basic: 1.2, kamikaze: 1.4, knight: 1.9, hammerKnight: 2.5, tank: 4.2, horseKnight: 6,
    });
  });

  it('armours only the knights (the mounted one\'s rider; ArrowHits spares his horse)', () => {
    expect(ENEMY_TYPES.filter((type) => enemyArmor(type) < 1)).toEqual(['knight', 'hammerKnight', 'horseKnight']);
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
    expect(ENEMY_TYPES.filter((type) => resistsVortex(enemyMass(type)))).toEqual(['tank', 'dragon', 'fireDragon', 'horseKnight']);
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

  it('puts only the mounted knight on horseback, thrown off as a black knight, stopping short with a longer reach', () => {
    expect(ENEMY_TYPES.filter((type) => enemyArchetype(type).rides)).toEqual(['horseKnight']);
    expect(ENEMY_KINDS.horseKnight.unhorsed).toBe('knight');
    expect(enemyArchetype('knight').rides).toBe(false);
    expect(enemyTraits('horseKnight').pinMs).toBe(0);
    const { reach, strikeReach } = ENEMY_KINDS.horseKnight.build;
    expect(strikeReach).toBeGreaterThan(reach!.bowman);
    expect(strikeReach).toBeGreaterThanOrEqual(ENEMY_KINDS.knight.build.strikeReach);
  });
});

describe('legHitLames', () => {
  it('lames the horse by chance, likelier for a heavy pinning arrow, never for an explosive or vortex arrow', () => {
    expect(legLameChance('normal')).toBe(HORSE_LEG.lameChance);
    expect(legLameChance('pinning')).toBeGreaterThan(legLameChance('normal'));
    expect(legLameChance('fragment')).toBeLessThan(legLameChance('normal'));
    expect(legHitLames('normal', 0)).toBe(true);
    expect(legHitLames('normal', HORSE_LEG.lameChance)).toBe(false);
    expect(legHitLames('explosive', 0)).toBe(false);
    expect(legHitLames('vortex', 0)).toBe(false);
  });
});

describe('mounted knight damage', () => {
  it('hurts the one an arrow hit, both with a blast, lightning or shattering ice, the horse with fire or a fall', () => {
    expect(mountedDamage(20, 'arrow', 'rider')).toEqual({ rider: 20, horse: 0 });
    expect(mountedDamage(25, 'headshot', 'horse')).toEqual({ rider: 0, horse: 25 });
    ['explosion', 'blast', 'lightning', 'shatter'].forEach((cause) => expect(mountedDamage(30, cause)).toEqual({ rider: 30, horse: 30 }));
    ['burn', 'fall', 'arrow'].forEach((cause) => expect(mountedDamage(5, cause)).toEqual({ rider: 0, horse: 5 }));
    expect(mountedDamage(25, 'headshot')).toEqual({ rider: 25, horse: 0 });
  });

  it('has the rider and the horse each with their own health, the rider as much as a black knight', () => {
    expect(ENEMY_KINDS.horseKnight.stats.health).toBe(ENEMY_KINDS.knight.stats.health);
    expect(ENEMY_KINDS.horseKnight.mount?.health).toBeGreaterThan(0);
  });

  it('drops a horse killed outright and lets one worn down lie down', () => {
    expect(horseDeathKind('headshot', 'horse')).toBe('drop');
    ['blast', 'explosion', 'lightning', 'shatter'].forEach((cause) => expect(horseDeathKind(cause)).toBe('drop'));
    ['arrow', 'burn', 'fall'].forEach((cause) => expect(horseDeathKind(cause, 'horse')).toBe('lieDown'));
  });
});
