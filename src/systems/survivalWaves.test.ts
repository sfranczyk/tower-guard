import { describe, expect, it } from 'vitest';
import { SURVIVAL } from '../config';
import { wavePacing } from '../data/difficulty';
import { SurvivalDirector, kindsArrived, maxAliveFor, pickLead, survivalBudget, survivalWaveGap } from './survivalWaves';

const run = (director: SurvivalDirector, ms: number, alive = () => 0): number => {
  let spawned = 0;
  for (let time = 0; time < ms; time += 100) {
    spawned += director.update(100, alive()).length;
  }
  return spawned;
};

describe('survival waves', () => {
  it('grow with each wave, each level, the difficulty and the players', () => {
    expect(survivalBudget(0, 0, 'medium')).toBe(SURVIVAL.firstBudget);
    expect(survivalBudget(3, 0, 'medium')).toBeGreaterThan(survivalBudget(1, 0, 'medium'));
    expect(survivalBudget(2, 3, 'medium')).toBeGreaterThan(survivalBudget(2, 0, 'medium'));
    expect(survivalBudget(2, 0, 'hard')).toBeGreaterThan(survivalBudget(2, 0, 'easy'));
    expect(survivalBudget(2, 0, 'medium', 1, 2)).toBeCloseTo(survivalBudget(2, 0, 'medium') * (1 + SURVIVAL.coopBudgetPerPlayer));
    expect(maxAliveFor(3)).toBe(SURVIVAL.maxAlive + 2 * SURVIVAL.coopAlivePerPlayer);
  });

  it('stop growing after the difficulty\'s peak wave', () => {
    const peak = SURVIVAL.mediumPeakWave - 1;
    expect(survivalBudget(peak, 0, 'medium')).toBeGreaterThan(survivalBudget(peak - 1, 0, 'medium'));
    expect(survivalBudget(peak + 10, 0, 'medium')).toBe(survivalBudget(peak, 0, 'medium'));
    expect(survivalBudget(peak, 0, 'medium', 1.5)).toBeGreaterThan(survivalBudget(peak, 0, 'medium'));
  });

  it('lead each wave with one kind, a newly arrived one first, never the same twice running', () => {
    expect(pickLead(['raider', 'tank'], 'raider', new Set(['raider']), () => 0)).toBe('tank');
    expect(pickLead(['raider', 'tank'], 'tank', new Set(['raider', 'tank']), () => 0.99)).toBe('raider');
    expect(pickLead(['raider'], 'raider', new Set(['raider']), Math.random)).toBe('raider');
    expect(pickLead(['priest', 'shaman', 'raider'], undefined, new Set(), () => 0)).toBe('raider');
    expect(pickLead(['priest', 'shaman'], undefined, new Set(), () => 0)).toBeUndefined();
  });

  it('let a boss lead only when allowed, unless nothing else came', () => {
    expect(pickLead(['raider', 'troll'], undefined, new Set(['raider']), () => 0, false)).toBe('raider');
    expect(pickLead(['raider', 'troll'], undefined, new Set(['raider']), () => 0, true)).toBe('troll');
    expect(pickLead(['troll'], undefined, new Set(), () => 0, false)).toBe('troll');
  });

  it('wait SURVIVAL.gapMs after a wave, longer after a costly one, up to SURVIVAL.maxGapMs', () => {
    expect(survivalWaveGap(3)).toBe(SURVIVAL.gapMs);
    expect(survivalWaveGap(10)).toBe(Math.max(SURVIVAL.gapMs, 10 * SURVIVAL.gapPerBudgetMs));
    expect(survivalWaveGap(100)).toBe(SURVIVAL.maxGapMs);
  });

  it('don\'t bring the next wave sooner when the field is cleared', () => {
    const director = new SurvivalDirector(['raider'], 600_000, { levelIndex: 0, difficulty: 'easy', pacing: wavePacing('easy'), random: () => 0.5 });
    run(director, SURVIVAL.startDelayMs + 10_000); // first wave out, field empty since
    expect(run(director, SURVIVAL.gapMs - 12_000)).toBe(0);
    expect(run(director, 4_000)).toBeGreaterThan(0);
  });

  it('send bosses only from SURVIVAL.bossMinWave, never two boss waves running', () => {
    const director = new SurvivalDirector(['raider', 'troll'], 200_000, { levelIndex: 0, difficulty: 'hard', pacing: wavePacing('easy'), random: () => 0 });
    const waves: string[][] = [];
    let last = -Infinity;
    for (let time = 0; time < 200_000; time += 100) {
      director.update(100, 0).forEach((kind) => {
        if (time - last > 10_000) {
          waves.push([]);
        }
        waves[waves.length - 1].push(kind);
        last = time;
      });
    }
    const bossWaves = waves.map((wave) => wave.includes('troll'));
    expect(bossWaves.slice(0, SURVIVAL.bossMinWave - 1)).toEqual([false, false]);
    expect(bossWaves[SURVIVAL.bossMinWave - 1]).toBe(true);
    bossWaves.slice(1).forEach((boss, index) => expect(boss && bossWaves[index]).toBe(false));
  });

  it('end long levels with a big finale, after it waves on their timer', () => {
    const duration = SURVIVAL.finaleMinMs + 60_000;
    const director = new SurvivalDirector(['raider'], duration, { levelIndex: 0, difficulty: 'medium', pacing: wavePacing('medium'), random: () => 0.5 });
    const busy = () => 1; // no early waves
    run(director, duration - SURVIVAL.finaleAtMs - 100, busy);
    const finale = run(director, 30_000, busy);
    expect(finale).toBeGreaterThan(0);
    // After it the waves come on their timer again.
    expect(run(director, SURVIVAL.maxGapMs, busy)).toBeGreaterThan(0);
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

  it('keep sending waves until the time is up, then stop', () => {
    const director = new SurvivalDirector(['raider'], 60_000, { levelIndex: 0, difficulty: 'easy', pacing: wavePacing('easy'), random: () => 0.5 });
    expect(run(director, SURVIVAL.startDelayMs - 100)).toBe(0);
    const spawned = run(director, 60_000);
    expect(spawned).toBeGreaterThan(SURVIVAL.firstBudget); // two waves, at the start and SURVIVAL.gapMs later
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
    expect(alive).toBe(maxAliveFor(1));
  });
});
