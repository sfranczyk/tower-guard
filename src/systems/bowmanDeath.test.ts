import { describe, expect, it } from 'vitest';
import { deathFallFor } from './bowmanDeath';

describe('deathFallFor', () => {
  it('picks the fall by what killed him', () => {
    expect([deathFallFor('melee', 0.2), deathFallFor('melee', 0.8)]).toEqual(['death', 'deathCrumple']);
    expect([deathFallFor('arrow', 0.2), deathFallFor('arrow', 0.8)]).toEqual(['deathStiff', 'deathCrumple']);
    expect(deathFallFor('burn')).toBe('deathCrumple');
    expect(deathFallFor('lightning')).toBe('deathStiff');
    expect(deathFallFor('blast')).toBe('knockback');
    expect(deathFallFor('fall')).toBe('knockback');
    expect(deathFallFor(undefined)).toBe('deathCrumple');
  });
});
