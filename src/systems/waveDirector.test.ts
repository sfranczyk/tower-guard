import { describe, expect, it } from 'vitest';
import { FIRST_GROUP_SIZE, GROUP_MAX_GAP_MS, GROUP_MIN_GAP_MS, MAX_GROUP_SIZE, WAVE_SPAWN_INTERVAL_MS, WAVE_START_DELAY_MS } from '../config';
import { WaveDirector, planWaveGroups } from './waveDirector';

const last = <T>(items: readonly T[]): T => items[items.length - 1];

const wave = { basic: 6, fast: 4, tank: 3, archer: 3, dragon: 1 };
const total = 17;

describe('wave groups', () => {
  it('splits the wave into growing groups containing every enemy', () => {
    const groups = planWaveGroups(wave);
    expect(groups.flat()).toHaveLength(total);
    expect(groups[0]).toHaveLength(FIRST_GROUP_SIZE);
    groups.forEach((group) => expect(group.length).toBeLessThanOrEqual(MAX_GROUP_SIZE + 1));
    (['basic', 'fast', 'tank', 'archer', 'dragon'] as const).forEach((type) =>
      expect(groups.flat().filter((t) => t === type)).toHaveLength(wave[type]));
  });

  it('opens light: no brutes or dragons in the first group, and they are spread out', () => {
    const groups = planWaveGroups(wave);
    expect(groups[0].some((type) => type === 'tank' || type === 'dragon')).toBe(false);
    const tankGroups = new Set(groups.flatMap((group, index) => (group.includes('tank') ? [index] : [])));
    expect(tankGroups.size).toBeGreaterThan(1);
  });

  it('never leaves a lone enemy as the last group', () => {
    expect(last(planWaveGroups({ basic: 6, fast: 0, tank: 0, archer: 0, dragon: 0 })).length).toBeGreaterThan(1);
    expect(planWaveGroups({ basic: 1, fast: 0, tank: 0, archer: 0, dragon: 0 })).toEqual([['basic']]);
  });
});

describe('wave director', () => {
  const run = (alive: () => number, stepMs = 100, untilMs = 120000) => {
    const director = new WaveDirector(wave);
    const spawns: number[] = [];
    for (let time = stepMs; time <= untilMs && !director.finished; time += stepMs) {
      director.update(stepMs, alive()).forEach(() => spawns.push(time));
    }
    return { director, spawns };
  };

  it('starts after the delay and spawns a group with gaps between its enemies', () => {
    const { spawns } = run(() => 99);
    expect(spawns[0]).toBe(WAVE_START_DELAY_MS);
    expect(spawns[1] - spawns[0]).toBe(WAVE_SPAWN_INTERVAL_MS);
  });

  it('waits for the field to clear before the next group, but not forever', () => {
    // Nobody ever dies: groups come every GROUP_MAX_GAP_MS.
    const stubborn = run(() => 99);
    expect(stubborn.director.finished).toBe(true);
    expect(stubborn.spawns).toHaveLength(total);
    expect(stubborn.spawns[FIRST_GROUP_SIZE] - stubborn.spawns[FIRST_GROUP_SIZE - 1]).toBe(GROUP_MAX_GAP_MS);
    // Everyone dies at once: groups come after the minimum gap.
    const quick = run(() => 0);
    expect(quick.spawns[FIRST_GROUP_SIZE] - quick.spawns[FIRST_GROUP_SIZE - 1]).toBe(GROUP_MIN_GAP_MS);
    expect(last(quick.spawns)).toBeLessThan(last(stubborn.spawns));
  });
});
