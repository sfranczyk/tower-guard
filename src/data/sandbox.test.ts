import { describe, expect, it } from 'vitest';
import { BATTLEGROUND_IDS } from './battlegrounds';
import { MAX_WAVES, createDefaultSandbox, normalizeSandbox, waveEnemyTotal, waveSpawnOrder } from './sandbox';

describe('sandbox settings', () => {
  it('defaults to one wave with five prepared waves that get harder', () => {
    const settings = createDefaultSandbox();
    expect(settings.waveCount).toBe(1);
    expect(settings.waves).toHaveLength(MAX_WAVES);
    const totals = settings.waves.map((wave) => waveEnemyTotal(wave.enemies));
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
    settings.waves.forEach((wave) => expect(BATTLEGROUND_IDS).toContain(wave.battleground));
  });

  it('clamps and fills invalid or partial settings', () => {
    const settings = normalizeSandbox({
      waveCount: 9,
      bowmanHealth: -5,
      keepHealth: 'lots' as unknown as number,
      waves: [{ enemies: { basic: 99, fast: -2, tank: 1.6, archer: 1, dragon: 0 }, battleground: 'moon' as never }],
    });
    expect(settings.waveCount).toBe(MAX_WAVES);
    expect(settings.bowmanHealth).toBe(20);
    expect(settings.keepHealth).toBe(createDefaultSandbox().keepHealth);
    expect(settings.waves[0].enemies).toEqual({ basic: 20, fast: 0, tank: 2, archer: 1, dragon: 0 });
    expect(settings.waves[0].battleground).toBe(createDefaultSandbox().waves[0].battleground);
    expect(settings.waves).toHaveLength(MAX_WAVES);
  });

  it('interleaves enemy types in the spawn order', () => {
    expect(waveSpawnOrder({ basic: 3, fast: 1, tank: 0, archer: 2, dragon: 0 }))
      .toEqual(['basic', 'fast', 'archer', 'basic', 'archer', 'basic']);
  });
});
