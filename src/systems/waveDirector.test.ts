import { describe, expect, it } from 'vitest';
import { FIRST_WAVE_SIZE, WAVE_MAX_GAP_MS, WAVE_MIN_GAP_MS, MAX_WAVE_SIZE, WAVE_SPAWN_INTERVAL_MS, LEVEL_START_DELAY_MS } from '../config';
import { WaveDirector, planWaves } from './waveDirector';

const last = <T>(items: readonly T[]): T => items[items.length - 1];

const level = { basic: 6, fast: 4, tank: 3, archer: 3, dragon: 1, fireDragon: 1, kamikaze: 2, zombie: 2, knight: 2, hammerKnight: 1, priest: 1 };
const total = 26;

describe('wave waves', () => {
  it('splits the wave into growing waves containing every enemy', () => {
    const waves = planWaves(level);
    expect(waves.flat()).toHaveLength(total);
    expect(waves[0]).toHaveLength(FIRST_WAVE_SIZE);
    waves.forEach((wave) => expect(wave.length).toBeLessThanOrEqual(MAX_WAVE_SIZE + 1));
    (['basic', 'fast', 'tank', 'archer', 'dragon', 'fireDragon', 'kamikaze', 'zombie', 'knight', 'hammerKnight', 'priest'] as const).forEach((type) =>
      expect(waves.flat().filter((t) => t === type)).toHaveLength(level[type]));
  });

  it('opens light: no brutes or dragons in the first wave, and they are spread out', () => {
    const waves = planWaves(level);
    expect(waves[0].some((type) => type === 'tank' || type === 'dragon' || type === 'fireDragon')).toBe(false);
    const tankWaves = new Set(waves.flatMap((wave, index) => (wave.includes('tank') ? [index] : [])));
    expect(tankWaves.size).toBeGreaterThan(1);
  });

  it('grows by WAVE_SIZE_STEP up to MAX_WAVE_SIZE, the rest in the last wave', () => {
    const sizes = (basic: number): number[] =>
      planWaves({ basic, fast: 0, tank: 0, archer: 0, dragon: 0, fireDragon: 0, kamikaze: 0, zombie: 0, knight: 0, hammerKnight: 0, priest: 0 }).map((wave) => wave.length);
    expect(sizes(30)).toEqual([3, 5, 7, 9, 6]);
    expect(sizes(50)).toEqual([3, 5, 7, 9, 10, 10, 6]);
  });

  it('never leaves a lone enemy as the last wave', () => {
    expect(last(planWaves({ basic: 6, fast: 0, tank: 0, archer: 0, dragon: 0, fireDragon: 0, kamikaze: 0, zombie: 0, knight: 0, hammerKnight: 0, priest: 0 })).length).toBeGreaterThan(1);
    expect(planWaves({ basic: 1, fast: 0, tank: 0, archer: 0, dragon: 0, fireDragon: 0, kamikaze: 0, zombie: 0, knight: 0, hammerKnight: 0, priest: 0 })).toEqual([['basic']]);
  });
});

describe('wave director', () => {
  const run = (alive: () => number, stepMs = 100, untilMs = 120000) => {
    const director = new WaveDirector(level);
    const spawns: number[] = [];
    for (let time = stepMs; time <= untilMs && !director.finished; time += stepMs) {
      director.update(stepMs, alive()).forEach(() => spawns.push(time));
    }
    return { director, spawns };
  };

  it('starts after the delay and spawns a wave with gaps between its enemies', () => {
    const { spawns } = run(() => 99);
    expect(spawns[0]).toBe(LEVEL_START_DELAY_MS);
    expect(spawns[1] - spawns[0]).toBe(WAVE_SPAWN_INTERVAL_MS);
  });

  it('waits for the field to clear before the next wave, but not forever', () => {
    // Nobody ever dies: waves come every WAVE_MAX_GAP_MS.
    const stubborn = run(() => 99);
    expect(stubborn.director.finished).toBe(true);
    expect(stubborn.spawns).toHaveLength(total);
    expect(stubborn.spawns[FIRST_WAVE_SIZE] - stubborn.spawns[FIRST_WAVE_SIZE - 1]).toBe(WAVE_MAX_GAP_MS);
    // Everyone dies at once: waves come after the minimum gap.
    const quick = run(() => 0);
    expect(quick.spawns[FIRST_WAVE_SIZE] - quick.spawns[FIRST_WAVE_SIZE - 1]).toBe(WAVE_MIN_GAP_MS);
    expect(last(quick.spawns)).toBeLessThan(last(stubborn.spawns));
  });
});
