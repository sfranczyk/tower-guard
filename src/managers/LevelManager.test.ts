import { describe, expect, it } from 'vitest';
import { LevelManager, getLevelEnemyTotal } from './LevelManager';

const LEVEL_IDS = [1, 2, 3];

describe('LevelManager', () => {
  it('loads every level', () => {
    const manager = new LevelManager();
    LEVEL_IDS.forEach((id) => expect(manager.loadLevel(id).id).toBe(id));
  });

  it('throws for an unknown level', () => {
    expect(() => new LevelManager().loadLevel(99)).toThrow('Unknown level: 99');
  });

  it('keeps waves consistent with spawn metadata', () => {
    const manager = new LevelManager();
    LEVEL_IDS.forEach((id) => {
      const level = manager.loadLevel(id);
      expect(level.waves).toHaveLength(level.spawnings.length);
      level.waves.forEach((wave) => {
        expect(wave.count).toBe(wave.spawn.count);
        expect(wave.enemyType).toBe(wave.spawn.enemyType);
      });
    });
  });

  it('schedules waves in increasing order', () => {
    const manager = new LevelManager();
    LEVEL_IDS.forEach((id) => {
      const delays = manager.loadLevel(id).waves.map((wave) => wave.delay);
      expect(delays).toEqual([...delays].sort((a, b) => a - b));
    });
  });

  it('gets harder with each level', () => {
    const manager = new LevelManager();
    const levels = LEVEL_IDS.map((id) => manager.loadLevel(id));
    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index].enemyDifficulty).toBeGreaterThan(levels[index - 1].enemyDifficulty);
      expect(getLevelEnemyTotal(levels[index])).toBeGreaterThanOrEqual(getLevelEnemyTotal(levels[index - 1]));
    }
  });

  it('counts the first level as 10 enemies', () => {
    expect(getLevelEnemyTotal(new LevelManager().loadLevel(1))).toBe(10);
  });
});
