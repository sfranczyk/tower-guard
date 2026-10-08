import { describe, expect, it } from 'vitest';
import { FROST_CHILL_MS, FROST_FREEZE_BRUTE_MS, FROST_FREEZE_HITS, FROST_FREEZE_MS, FROST_SLOW } from '../config';
import { NO_AFFLICTIONS, chill, ignite, tickAfflictions, timeScale } from './afflictions';

describe('afflictions', () => {
  it('chills, then freezes on the FROST_FREEZE_HITS-th hit while chilled', () => {
    let state = chill(NO_AFFLICTIONS, 'basic', false).state;
    expect(timeScale(state)).toBe(FROST_SLOW);
    for (let hit = 2; hit < FROST_FREEZE_HITS; hit += 1) {
      state = chill(state, 'basic', false).state;
    }
    const third = chill(state, 'basic', false);
    expect(third.froze).toBe(true);
    expect(third.state.frozenMs).toBe(FROST_FREEZE_MS);
    expect(timeScale(third.state)).toBe(0);
  });

  it('freezes on a headshot, brutes for less, dragons never', () => {
    expect(chill(NO_AFFLICTIONS, 'fast', true).froze).toBe(true);
    expect(chill(NO_AFFLICTIONS, 'tank', true).state.frozenMs).toBe(FROST_FREEZE_BRUTE_MS);
    const dragon = chill(chill(chill(NO_AFFLICTIONS, 'dragon', true).state, 'dragon', true).state, 'dragon', true);
    expect(dragon.froze).toBe(false);
    expect(dragon.state.frozenMs).toBe(0);
  });

  it('forgets the hits once the chill wears off', () => {
    const state = chill(NO_AFFLICTIONS, 'basic', false).state;
    const thawed = tickAfflictions(state, FROST_CHILL_MS + 1);
    expect(thawed.chillHits).toBe(0);
    expect(chill(thawed, 'basic', false).froze).toBe(false);
  });

  it('fire thaws ice, frost puts fire out, the fire dragon does not burn', () => {
    const frozen = chill(NO_AFFLICTIONS, 'basic', true).state;
    const burning = ignite(frozen, 'basic');
    expect(burning.frozenMs).toBe(0);
    expect(burning.chillMs).toBe(0);
    expect(burning.burnMs).toBeGreaterThan(0);
    expect(chill(burning, 'basic', false).state.burnMs).toBe(0);
    expect(ignite(NO_AFFLICTIONS, 'fireDragon').burnMs).toBe(0);
    expect(ignite(NO_AFFLICTIONS, 'zombie').burnMs).toBeGreaterThan(ignite(NO_AFFLICTIONS, 'basic').burnMs);
  });
});
