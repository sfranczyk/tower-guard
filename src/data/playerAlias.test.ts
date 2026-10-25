import { describe, expect, it } from 'vitest';
import { MAX_ALIAS_LENGTH, normalizeAlias, playerName } from './playerAlias';

describe('player alias', () => {
  it('trims, folds spaces, drops control characters and caps the length', () => {
    expect(normalizeAlias('  Stan   the\tArcher \n')).toBe('Stan the Archer');
    expect(normalizeAlias('a\u0007b')).toBe('ab');
    expect(normalizeAlias('x'.repeat(40))).toHaveLength(MAX_ALIAS_LENGTH);
    expect(normalizeAlias('Łucznik 🏹')).toBe('Łucznik 🏹');
    expect(normalizeAlias(42)).toBe('');
  });

  it('falls back to the seat name without an alias', () => {
    expect(playerName(0)).toBe('Host');
    expect(playerName(2)).toBe('Player 3');
    expect(playerName(0, undefined, false)).toBe('Player 1');
    expect(playerName(1, 'Robin')).toBe('Robin');
  });
});
