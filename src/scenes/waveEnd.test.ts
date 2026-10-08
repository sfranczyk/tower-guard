import { describe, expect, it } from 'vitest';
import { normalizeSandbox } from '../data/sandbox';
import { waveEndInfo, type WaveOutcome } from './waveEnd';

const sandbox = { ...normalizeSandbox(undefined), waveCount: 3, bowmanHealth: 100 };
const outcome = (changes: Partial<WaveOutcome> = {}): WaveOutcome => ({
  won: true, waveCleared: true, waveIndex: 0, defeated: 12, totalEnemies: 12, keep: { health: 1500.4, max: 2000 },
  enemyKeepDestroyed: false, playerKeepDestroyed: false, playerHealths: [63.2], ...changes,
});

describe('waveEndInfo', () => {
  it('offers the next level after a cleared wave with levels left', () => {
    const { info, next } = waveEndInfo(outcome(), sandbox);
    expect(next).toBe(true);
    expect(info.title).toBe('Level 1 cleared!');
    expect(info.copy).toMatch(/^Next: level 2 of 3 at /);
  });

  it('ends the run after the last level, or when the enemy keep falls', () => {
    expect(waveEndInfo(outcome({ waveIndex: 2 }), sandbox)).toMatchObject({ next: false, info: { title: 'Victory!', copy: 'All 3 levels held off.' } });
    expect(waveEndInfo(outcome({ waveCleared: false, enemyKeepDestroyed: true }), sandbox).info.copy).toBe('The enemy keep has fallen.');
  });

  it('says what fell on a defeat', () => {
    const lost = (changes: Partial<WaveOutcome>) => waveEndInfo(outcome({ won: false, waveCleared: false, ...changes }), sandbox).info;
    expect(lost({}).copy).toMatch(/^The bowman has fallen/);
    expect(lost({ playerKeepDestroyed: true }).copy).toMatch(/^The keep has fallen/);
    expect(lost({ playerHealths: [0, 0] }).copy).toMatch(/^Both bowmen have fallen/);
    expect(lost({}).outcome).toBe('loss');
  });

  it('rounds the health up and names each player in co-op', () => {
    expect(waveEndInfo(outcome(), sandbox).info.stats).toEqual([
      { label: 'enemies defeated', value: '12 / 12' },
      { label: 'keep', value: '1501 / 2000' },
      { label: 'bowman', value: '64 / 100' },
    ]);
    expect(waveEndInfo(outcome({ playerHealths: [10, 20] }), sandbox).info.stats.slice(2).map((stat) => stat.label)).toEqual(['player 1', 'player 2']);
  });
});
