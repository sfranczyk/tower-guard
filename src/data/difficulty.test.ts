import { describe, expect, it } from 'vitest';
import { DIFFICULTY_SCALE } from '../config';
import { WAVES } from '../config';
import { isDifficultyLevel, scaleEnemyCounts, wavePacing, waveScale } from './difficulty';
import { levelEnemyTotal } from './sandbox';

const level = { basic: 4, fast: 3, tank: 1, troll: 0, archer: 2, dragon: 0, fireDragon: 0, kamikaze: 1, zombie: 2, knight: 1, hammerKnight: 0, horseKnight: 0, priest: 0 };

describe('difficulty', () => {
  it('easy keeps the counts, harder levels grow them', () => {
    expect(waveScale('easy')).toBe(1);
    expect(scaleEnemyCounts(level, waveScale('easy'))).toEqual(level);
    expect(waveScale('medium')).toBe(DIFFICULTY_SCALE.medium);
    expect(waveScale('hard')).toBeGreaterThan(waveScale('medium'));
    expect(levelEnemyTotal(scaleEnemyCounts(level, 2))).toBe(2 * levelEnemyTotal(level));
  });

  it('keeps absent types absent and present ones at least one', () => {
    const scaled = scaleEnemyCounts(level, 0.2);
    expect(scaled.troll).toBe(0);
    expect(scaled.tank).toBe(1);
  });

  it('sends easy one by one and medium and hard in groups', () => {
    expect(wavePacing('easy')).toEqual({ groupSize: 1, spawnIntervalMs: WAVES.spawnIntervalMs, groupGapMs: WAVES.spawnIntervalMs });
    expect(wavePacing('hard').groupSize).toBe(DIFFICULTY_SCALE.groupSize);
    expect(wavePacing('medium').spawnIntervalMs).toBe(DIFFICULTY_SCALE.groupSpawnIntervalMs);
  });

  it('recognises the level names', () => {
    expect(isDifficultyLevel('hard')).toBe(true);
    expect(isDifficultyLevel('insane')).toBe(false);
  });
});
