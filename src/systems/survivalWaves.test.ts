import { describe, expect, it } from 'vitest';
import { SURVIVAL } from '../config';
import { wavePacing } from '../data/difficulty';
import { SurvivalDirector, drawWave, kindsArrived, pickLead, survivalWaveGap, survivalWaveSize } from './survivalWaves';

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
    expect(survivalWaveSize(3, 0, 'medium')).toBeGreaterThan(survivalWaveSize(1, 0, 'medium'));
    expect(survivalWaveSize(2, 3, 'medium')).toBeGreaterThan(survivalWaveSize(2, 0, 'medium'));
    expect(survivalWaveSize(2, 0, 'hard')).toBeGreaterThan(survivalWaveSize(2, 0, 'easy'));
  });

  it('stop growing after the difficulty\'s peak wave', () => {
    const peak = SURVIVAL.mediumPeakWave - 1;
    expect(survivalWaveSize(peak, 0, 'medium')).toBeGreaterThan(survivalWaveSize(peak - 1, 0, 'medium'));
    expect(survivalWaveSize(peak + 10, 0, 'medium')).toBe(survivalWaveSize(peak, 0, 'medium'));
    expect(survivalWaveSize(peak, 0, 'medium', 1.5)).toBeGreaterThan(survivalWaveSize(peak, 0, 'medium'));
  });

  it('lead each wave with one kind, a newly arrived one first, never the same twice running', () => {
    const wave = drawWave(['raider', 'hunter'], 10, () => 0, 'hunter');
    expect(wave.filter((kind) => kind === 'hunter')).toHaveLength(Math.round(10 * SURVIVAL.leadShare));
    expect(pickLead(['raider', 'tank'], 'raider', new Set(['raider']), () => 0)).toBe('tank');
    expect(pickLead(['raider', 'tank'], 'tank', new Set(['raider', 'tank']), () => 0.99)).toBe('raider');
    expect(pickLead(['raider'], 'raider', new Set(['raider']), Math.random)).toBe('raider');
    expect(pickLead(['priest', 'shaman', 'raider'], undefined, new Set(), () => 0)).toBe('raider');
    expect(pickLead(['priest', 'shaman'], undefined, new Set(), () => 0)).toBeUndefined();
  });

  it('wait longer between later waves, up to SURVIVAL.maxWaveEveryMs', () => {
    expect(survivalWaveGap(1)).toBe(SURVIVAL.waveEveryMs);
    expect(survivalWaveGap(2)).toBe(SURVIVAL.waveEveryMs + SURVIVAL.waveGapStepMs);
    expect(survivalWaveGap(20)).toBe(SURVIVAL.maxWaveEveryMs);
  });

  it('send the next wave SURVIVAL.clearedDelayMs after the field is cleared', () => {
    const director = new SurvivalDirector(['raider'], 600_000, { levelIndex: 0, difficulty: 'easy', pacing: wavePacing('easy') });
    run(director, 20_000); // first wave out, field empty since
    const waveAt = SURVIVAL.startDelayMs + SURVIVAL.waveEveryMs;
    expect(run(director, waveAt - 20_000 - 1_000)).toBeGreaterThan(0);
  });

  it('end long levels with a big finale, after it new waves only once the field is cleared', () => {
    const duration = SURVIVAL.finaleMinMs + 60_000;
    const director = new SurvivalDirector(['raider'], duration, { levelIndex: 0, difficulty: 'medium', pacing: wavePacing('medium'), random: () => 0.5 });
    const busy = () => 1; // no early waves
    run(director, duration - SURVIVAL.finaleAtMs - 100, busy);
    const finale = run(director, 30_000, busy);
    expect(finale).toBeGreaterThanOrEqual(survivalWaveSize(99, 0, 'medium', SURVIVAL.finaleScale));
    expect(run(director, SURVIVAL.finaleAtMs - 60_000, busy)).toBe(0);
    // Finale beaten with a minute to go: the field doesn't stay empty until dawn.
    expect(run(director, SURVIVAL.clearedDelayMs + 1_000)).toBeGreaterThan(0);
  });

  it('send nothing new in the last SURVIVAL.quietEndMs', () => {
    const duration = SURVIVAL.finaleMinMs + 60_000;
    const director = new SurvivalDirector(['raider'], duration, { levelIndex: 0, difficulty: 'medium', pacing: wavePacing('medium'), random: () => 0.5 });
    run(director, duration - SURVIVAL.quietEndMs);
    run(director, SURVIVAL.quietEndMs - 2_000); // a wave sent just before still walks in
    expect(run(director, 2_000)).toBe(0);
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
