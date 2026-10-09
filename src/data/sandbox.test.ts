import { describe, expect, it } from 'vitest';
import { BATTLEGROUND_IDS } from './battlegrounds';
import { MAX_LEVELS, createDefaultSandbox, normalizeSandbox, levelEnemyTotal } from './sandbox';

describe('sandbox settings', () => {
  it('defaults to one level with five prepared levels that get harder', () => {
    const settings = createDefaultSandbox();
    expect(settings.levelCount).toBe(1);
    expect(settings.levels).toHaveLength(MAX_LEVELS);
    const totals = settings.levels.map((level) => levelEnemyTotal(level.enemies));
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
    settings.levels.forEach((level) => expect(BATTLEGROUND_IDS).toContain(level.battleground));
  });

  it('clamps and fills invalid or partial settings', () => {
    const settings = normalizeSandbox({
      levelCount: 9,
      bowmanHealth: -5,
      keepHealth: 'lots' as unknown as number,
      levels: [{ enemies: { basic: 99, fast: -2, tank: 1.6, archer: 1, dragon: 0 } as never, battleground: 'moon' as never }],
    });
    expect(settings.levelCount).toBe(MAX_LEVELS);
    expect(settings.bowmanHealth).toBe(20);
    expect(settings.keepHealth).toBe(createDefaultSandbox().keepHealth);
    // Types missing from a stored level (added later) default to none.
    expect(settings.levels[0].enemies).toEqual({ basic: 20, fast: 0, tank: 2, archer: 1, dragon: 0, fireDragon: 0, kamikaze: 0, zombie: 0, knight: 0, hammerKnight: 0, priest: 0 });
    expect(settings.levels[0].battleground).toBe(createDefaultSandbox().levels[0].battleground);
    expect(settings.levels).toHaveLength(MAX_LEVELS);
  });

  it('reads setups stored before levels were renamed (waves, waveCount)', () => {
    const settings = normalizeSandbox({
      waveCount: 2,
      waves: [{ enemies: { basic: 14, fast: 0, tank: 0, archer: 1, dragon: 0, fireDragon: 0, kamikaze: 0, zombie: 0 }, battleground: 'crimsonPass' }],
    } as never);
    expect(settings.levelCount).toBe(2);
    expect(settings.levels[0]).toEqual({ enemies: { basic: 14, fast: 0, tank: 0, archer: 1, dragon: 0, fireDragon: 0, kamikaze: 0, zombie: 0, knight: 0, hammerKnight: 0, priest: 0 }, battleground: 'crimsonPass' });
    expect('waves' in settings).toBe(false);
  });
});
