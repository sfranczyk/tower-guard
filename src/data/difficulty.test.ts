import { describe, expect, it } from 'vitest';
import { DIFFICULTY_SCALE } from '../config';
import { WAVES } from '../config';
import { enemyEdge, healAfterLevel, isDifficultyLevel, wavePacing } from './difficulty';

describe('difficulty', () => {
  it('easy leaves the enemies as tuned, harder levels hit harder and aim better', () => {
    expect(enemyEdge('easy')).toEqual({ damage: 1, aimSpread: 1 });
    expect(enemyEdge('medium')).toEqual({ damage: DIFFICULTY_SCALE.mediumDamage, aimSpread: DIFFICULTY_SCALE.mediumSpread });
    expect(enemyEdge('hard').damage).toBeGreaterThan(enemyEdge('medium').damage);
    expect(enemyEdge('hard').aimSpread).toBeLessThan(enemyEdge('medium').aimSpread);
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

  it('heals the bowman between levels by the difficulty', () => {
    expect(healAfterLevel('easy', 10, 100)).toBe(100);
    expect(healAfterLevel('medium', 10, 100)).toBe(60);
    expect(healAfterLevel('medium', 70, 100)).toBe(100);
    expect(healAfterLevel('hard', 10, 100)).toBeCloseTo(20);
    expect(healAfterLevel('easy', 0, 100)).toBe(0);
  });
});
