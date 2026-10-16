import { describe, expect, it } from 'vitest';
import { WAVES } from '../config';
import { WaveDirector, groupByKind, planWaves } from './waveDirector';

const last = <T>(items: readonly T[]): T => items[items.length - 1];

const level = { raider: 6, fast: 4, tank: 3, troll: 0, hunter: 3, dragon: 1, fireDragon: 1, kamikaze: 2, goblinKamikaze: 0, zombie: 2, knight: 2, heavyKnight: 1, horseKnight: 1, priest: 1, shaman: 0 };
const total = 27;

describe('wave waves', () => {
  it('splits the wave into growing waves containing every enemy', () => {
    const waves = planWaves(level);
    expect(waves.flat()).toHaveLength(total);
    expect(waves[0]).toHaveLength(WAVES.firstSize);
    waves.forEach((wave) => expect(wave.length).toBeLessThanOrEqual(WAVES.maxSize + 1));
    (['raider', 'fast', 'tank', 'troll', 'hunter', 'dragon', 'fireDragon', 'kamikaze', 'goblinKamikaze', 'zombie', 'knight', 'heavyKnight', 'horseKnight', 'priest', 'shaman'] as const).forEach((type) =>
      expect(waves.flat().filter((t) => t === type)).toHaveLength(level[type]));
  });

  it('opens light: no brutes or dragons in the first wave, and they are spread out', () => {
    const waves = planWaves(level);
    expect(waves[0].some((type) => type === 'tank' || type === 'troll' || type === 'dragon' || type === 'fireDragon')).toBe(false);
    const tankWaves = new Set(waves.flatMap((wave, index) => (wave.includes('tank') ? [index] : [])));
    expect(tankWaves.size).toBeGreaterThan(1);
  });

  it('grows by WAVES.sizeStep up to WAVES.maxSize, the rest in the last wave', () => {
    const sizes = (raider: number): number[] =>
      planWaves({ raider, fast: 0, tank: 0, troll: 0, hunter: 0, dragon: 0, fireDragon: 0, kamikaze: 0, goblinKamikaze: 0, zombie: 0, knight: 0, heavyKnight: 0, horseKnight: 0, priest: 0, shaman: 0 }).map((wave) => wave.length);
    expect(sizes(30)).toEqual([3, 5, 7, 9, 6]);
    expect(sizes(50)).toEqual([3, 5, 7, 9, 10, 10, 6]);
  });


  it('never leaves a lone enemy as the last wave', () => {
    expect(last(planWaves({ raider: 6, fast: 0, tank: 0, troll: 0, hunter: 0, dragon: 0, fireDragon: 0, kamikaze: 0, goblinKamikaze: 0, zombie: 0, knight: 0, heavyKnight: 0, horseKnight: 0, priest: 0, shaman: 0 })).length).toBeGreaterThan(1);
    expect(planWaves({ raider: 1, fast: 0, tank: 0, troll: 0, hunter: 0, dragon: 0, fireDragon: 0, kamikaze: 0, goblinKamikaze: 0, zombie: 0, knight: 0, heavyKnight: 0, horseKnight: 0, priest: 0, shaman: 0 })).toEqual([['raider']]);
  });
});

describe('wave director', () => {
  const run = (alive: () => number, stepMs = 100, untilMs = 120000, director = new WaveDirector(level)) => {
    const spawns: number[] = [];
    for (let time = stepMs; time <= untilMs && !director.finished; time += stepMs) {
      director.update(stepMs, alive()).forEach(() => spawns.push(time));
    }
    return { director, spawns };
  };

  it('starts after the delay and spawns a wave with gaps between its enemies', () => {
    const { spawns } = run(() => 99);
    expect(spawns[0]).toBe(WAVES.startDelayMs);
    expect(spawns[1] - spawns[0]).toBe(WAVES.spawnIntervalMs);
  });

  it('waits for the field to clear before the next wave, but not forever', () => {
    // Nobody ever dies: waves come every WAVES.maxGapMs.
    const stubborn = run(() => 99);
    expect(stubborn.director.finished).toBe(true);
    expect(stubborn.spawns).toHaveLength(total);
    expect(stubborn.spawns[WAVES.firstSize] - stubborn.spawns[WAVES.firstSize - 1]).toBe(WAVES.maxGapMs);
    // Everyone dies at once: waves come after the minimum gap.
    const quick = run(() => 0);
    expect(quick.spawns[WAVES.firstSize] - quick.spawns[WAVES.firstSize - 1]).toBe(WAVES.minGapMs);
    expect(last(quick.spawns)).toBeLessThan(last(stubborn.spawns));
  });

  it('sends a wave in groups: close together inside a group, a longer gap between groups', () => {
    const pacing = { groupSize: 2, spawnIntervalMs: 300, groupGapMs: 1500 };
    const big = { ...level, raider: 12 };
    const { spawns } = run(() => 99, 100, 120000, new WaveDirector(big, pacing));
    expect(spawns[1] - spawns[0]).toBe(300);
    expect(spawns[2] - spawns[1]).toBe(1500);
  });

  it('puts the same kinds of a wave together', () => {
    const grouped = groupByKind(['raider', 'hunter', 'raider', 'fast', 'hunter', 'fast']);
    expect(grouped).toHaveLength(6);
    // Each kind is one unbroken run.
    expect(grouped.filter((type, index) => type !== grouped[index - 1])).toHaveLength(3);
  });
});
