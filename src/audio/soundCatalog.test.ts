import { describe, expect, it } from 'vitest';
import { soundFor } from './soundCatalog';

describe('soundFor', () => {
  it('plays a sound for everyone without heardBy', () => {
    expect(soundFor('allyCurse', undefined, 1)).toBe('allyCurse');
  });

  it('plays an ally curse only for the shooter, a groan for the others', () => {
    expect(soundFor('allyCurse', 2, 2)).toBe('allyCurse');
    expect(soundFor('allyCurse', 2, 0)).toBe('groan');
  });
});
