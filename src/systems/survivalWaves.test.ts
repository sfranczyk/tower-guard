import { describe, expect, it } from 'vitest';
import { SURVIVAL } from '../config';
import { wavePacing } from '../data/difficulty';
import { SurvivalDirector, drawWave, kindsArrived, survivalWaveSize } from './survivalWaves';

const run = (director: SurvivalDirector, ms: number, alive = () => 0): number => {
  let spawned = 0;
  for (let time = 0; time < ms; time += 100) {
    spawned += director.update(100, alive()).length;
  }
  return spawned;
};

describe('survival waves', () => {
  it('grow with each wave, each level and the difficulty', () => {
    expect(survivalWaveSize(0, 0, 'medium')).toBe(SURVIVAL.firstSize);
    expect(survivalWaveSize(4, 0, 'medium')).toBeGreaterThan(survivalWaveSize(1, 0, 'medium'));
    expect(survivalWaveSize(2, 3, 'medium')).toBeGreaterThan(survivalWaveSize(2, 0, 'medium'));
    expect(survivalWaveSize(2, 0, 'hard')).toBeGreaterThan(survivalWaveSize(2, 0, 'easy'));
  });

  it('bring tougher kinds only once their time has come', () => {
    expect(kindsArrived(['raider', 'tank', 'dragon'], 0)).toEqual(['raider']);
    expect(kindsArrived(['raider', 'tank', 'dragon'], 0.5)).toEqual(['raider', 'tank', 'dragon']);
    // Only late kinds picked: the earliest of them comes from the start.
    expect(kindsArrived(['tank', 'troll'], 0)).toEqual(['tank']);
  });

  it('draw only the given kinds', () => {
    const wave = drawWave(['raider', 'hunter'], 20, () => 0.99);
    expect(wave).toHaveLength(20);
    expect(wave.every((kind) => kind === 'hunter')).toBe(true);
    expect(drawWave([], 5, Math.random)).toEqual([]);
  });

  it('keep sending waves until the time is up, then stop', () => {
    const director = new SurvivalDirector(['raider'], 60_000, { levelIndex: 0, difficulty: 'easy', pacing: wavePacing('easy') });
    expect(run(director, SURVIVAL.startDelayMs - 100)).toBe(0);
    const spawned = run(director, 60_000);
    expect(spawned).toBeGreaterThan(SURVIVAL.firstSize * 2);
    expect(director.finished).toBe(true);
    expect(director.remainingMs).toBe(0);
    expect(director.update(100, 0)).toEqual([]);
  });

  it('never fills the field past SURVIVAL.maxAlive', () => {
    const director = new SurvivalDirector(['raider'], 600_000, { levelIndex: 4, difficulty: 'hard', pacing: wavePacing('hard') });
    let alive = 0;
    for (let time = 0; time < 300_000; time += 100) {
      alive += director.update(100, alive).length;
    }
    expect(alive).toBe(SURVIVAL.maxAlive);
  });
});
