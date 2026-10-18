import { describe, expect, it } from 'vitest';
import { BATTLEGROUND_IDS } from './battlegrounds';
import { DEFAULT_SURVIVAL_MINUTES, MAX_ENEMIES_PER_TYPE, MAX_LEVELS, SURVIVAL_MINUTES, battlegroundsFor, createDefaultSandbox, normalizeSandbox, levelEnemyTotal, runBattleground, runLevelCount } from './sandbox';

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
      levels: [{ enemies: { raider: 99, fast: -2, tank: 1.6, hunter: 1, dragon: 0 } as never, battleground: 'moon' as never }],
    });
    expect(settings.levelCount).toBe(MAX_LEVELS);
    expect(settings.bowmanHealth).toBe(20);
    expect(settings.keepHealth).toBe(createDefaultSandbox().keepHealth);
    // Types missing from a stored level (added later) default to none.
    expect(settings.levels[0].enemies).toEqual({ raider: MAX_ENEMIES_PER_TYPE, fast: 0, tank: 2, troll: 0, hunter: 1, dragon: 0, fireDragon: 0, kamikaze: 0, goblinKamikaze: 0, zombie: 0, knight: 0, heavyKnight: 0, horseKnight: 0, priest: 0, shaman: 0 });
    expect(settings.levels[0].battleground).toBe(createDefaultSandbox().levels[0].battleground);
    expect(settings.levels).toHaveLength(MAX_LEVELS);
  });

  it('reads setups stored before levels were renamed (waves, waveCount)', () => {
    const settings = normalizeSandbox({
      waveCount: 2,
      waves: [{ enemies: { raider: 14, fast: 0, tank: 0, hunter: 1, dragon: 0, fireDragon: 0, kamikaze: 0, zombie: 0 }, battleground: 'crimsonPass' }],
    } as never);
    expect(settings.levelCount).toBe(2);
    expect(settings.levels[0]).toEqual({ enemies: { raider: 14, fast: 0, tank: 0, troll: 0, hunter: 1, dragon: 0, fireDragon: 0, kamikaze: 0, goblinKamikaze: 0, zombie: 0, knight: 0, heavyKnight: 0, horseKnight: 0, priest: 0, shaman: 0 }, battleground: 'crimsonPass' });
    expect('waves' in settings).toBe(false);
  });

  it('moves counts stored under renamed enemy ids (basic, archer, hammerKnight; bandit for a while) to the new ones', () => {
    const settings = normalizeSandbox({ levels: [{ enemies: { basic: 7, archer: 2, hammerKnight: 1 }, battleground: 'moon' }] } as never);
    expect(settings.levels[0].enemies).toMatchObject({ raider: 7, hunter: 2, heavyKnight: 1, fast: 0 });
    expect(normalizeSandbox({ levels: [{ enemies: { bandit: 3 }, battleground: 'moon' }] } as never).levels[0].enemies.raider).toBe(3);
  });

  it('keeps the banners option, off by default', () => {
    expect(normalizeSandbox(undefined).banners).toBe(false);
    expect(normalizeSandbox({ banners: true }).banners).toBe(true);
    expect(normalizeSandbox({ banners: 'yes' } as never).banners).toBe(false);
  });
});

describe('survival setup', () => {
  it('defaults to battle mode with survival levels at night', () => {
    const settings = createDefaultSandbox();
    expect(settings.mode).toBe('battle');
    expect(settings.survival.levels).toHaveLength(MAX_LEVELS);
    settings.survival.levels.forEach((level) => {
      expect(level.kinds.length).toBeGreaterThan(0);
      expect(level.minutes).toBe(DEFAULT_SURVIVAL_MINUTES);
    });
    expect(runBattleground({ ...settings, mode: 'survival' }, 0)).toBe('moonlitHollow');
    // Battle levels never get the survival-only map.
    settings.levels.forEach((level) => expect(battlegroundsFor('battle')).toContain(level.battleground));
  });

  it('clamps stored survival levels', () => {
    const settings = normalizeSandbox({
      mode: 'survival',
      survival: { levelCount: 3, levels: [{ battleground: 'nowhere' as never, kinds: ['basic', 'tank', 'ghost' as never, 'raider'] as never, minutes: 99 }, { kinds: [], minutes: 0 } as never] },
      levels: [{ enemies: {} as never, battleground: 'moonlitHollow' }],
    });
    expect(settings.mode).toBe('survival');
    expect(runLevelCount(settings)).toBe(3);
    expect(settings.survival.levels[0]).toEqual({ battleground: 'moonlitHollow', kinds: ['raider', 'tank'], minutes: SURVIVAL_MINUTES.max });
    expect(settings.survival.levels[1].kinds).toEqual(createDefaultSandbox().survival.levels[1].kinds);
    expect(settings.survival.levels[1].minutes).toBe(SURVIVAL_MINUTES.min);
    // The survival-only map isn't kept for a battle level.
    expect(settings.levels[0].battleground).toBe(createDefaultSandbox().levels[0].battleground);
    expect(normalizeSandbox({ mode: 'siege' as never }).mode).toBe('battle');
  });
});
