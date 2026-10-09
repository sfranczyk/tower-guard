import { afterEach, describe, expect, it } from 'vitest';
import {
  TUNING_STORAGE_KEY, changedCount, formatChanges, loadTuning, rangeFor, resetTuned, saveTuning, setTuned, tunable, tuningGroups,
} from './tuning';

const TEST = tunable('TEST_GROUP', 'Test', { speedMs: 1100, drag: 0.0005, count: 3 }, { meta: { count: { max: 9 } } });
const DERIVED = tunable('TEST_DERIVED', 'Derived', { fighter: 35 }, { file: 'src/data/x.ts', derivedFrom: 'ENEMY_KINDS' });

const memoryStorage = (): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) };
};

afterEach(() => resetTuned());

describe('tuning registry', () => {
  it('changes the live object and resets it', () => {
    setTuned('TEST_GROUP', 'speedMs', 1500);
    expect(TEST.speedMs).toBe(1500);
    const group = tuningGroups().find((g) => g.name === 'TEST_GROUP')!;
    expect(changedCount(group)).toBe(1);
    resetTuned('TEST_GROUP', 'speedMs');
    expect(TEST.speedMs).toBe(1100);
    expect(changedCount(group)).toBe(0);
  });

  it('ignores unknown keys and non-numbers', () => {
    setTuned('TEST_GROUP', 'nope', 3);
    setTuned('TEST_GROUP', 'count', Number.NaN);
    expect(TEST.count).toBe(3);
    expect('nope' in TEST).toBe(false);
  });

  it('derives slider ranges from the default', () => {
    expect(rangeFor(1100)).toEqual({ min: 0, max: 3300, step: 10 });
    expect(rangeFor(0.0005)).toEqual({ min: 0, max: 0.0015, step: 0.000005 });
    expect(rangeFor(3)).toEqual({ min: 0, max: 9, step: 1 });
    expect(rangeFor(0.22).step).toBe(0.002);
    expect(rangeFor(0)).toEqual({ min: 0, max: 1, step: 0.01 });
    expect(rangeFor(3, { max: 20 }).max).toBe(20);
  });

  it('saves only changes and loads them back', () => {
    const storage = memoryStorage();
    saveTuning(storage);
    expect(storage.data.has(TUNING_STORAGE_KEY)).toBe(false);
    setTuned('TEST_GROUP', 'drag', 0.001);
    saveTuning(storage);
    expect(JSON.parse(storage.data.get(TUNING_STORAGE_KEY)!)).toEqual({ TEST_GROUP: { drag: 0.001 } });
    resetTuned();
    storage.data.set(TUNING_STORAGE_KEY, JSON.stringify({ TEST_GROUP: { drag: 0.001, gone: 1, count: 'x' }, MISSING: { a: 1 } }));
    loadTuning(storage);
    expect(TEST.drag).toBe(0.001);
    expect(TEST.count).toBe(3);
  });

  it('survives broken or blocked storage', () => {
    const storage = memoryStorage();
    storage.data.set(TUNING_STORAGE_KEY, '{not json');
    expect(() => loadTuning(storage)).not.toThrow();
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => undefined };
    expect(() => loadTuning(blocked)).not.toThrow();
    setTuned('TEST_GROUP', 'count', 4);
    expect(() => saveTuning(blocked)).not.toThrow();
  });

  it('formats changed groups as paste-ready source', () => {
    expect(formatChanges()).toBe('');
    setTuned('TEST_GROUP', 'speedMs', 1200);
    setTuned('TEST_GROUP', 'drag', 0.1 + 0.2);
    expect(formatChanges()).toBe([
      '// src/config.ts',
      "export const TEST_GROUP = tunable('TEST_GROUP', 'Test', {",
      '  speedMs: 1200, // was 1100',
      '  drag: 0.3, // was 0.0005',
      '  count: 3,',
      '}, { meta: { count: { max: 9 } } });',
    ].join('\n'));
    resetTuned();
    setTuned('TEST_DERIVED', 'fighter', 40);
    expect(DERIVED.fighter).toBe(40);
    expect(formatChanges()).toBe('// Derived (TEST_DERIVED, src/data/x.ts): set these in ENEMY_KINDS\n//   fighter: 35 → 40');
  });
});
