import { describe, expect, it } from 'vitest';
import { DEFEAT_CAUSES, defeatDeaths } from './mobaDefeat';

describe('MOBA defeat', () => {
  it('kills every loser within the spread, in one of the ways', () => {
    const deaths = defeatDeaths(40, 1800);
    expect(deaths).toHaveLength(40);
    deaths.forEach((death) => {
      expect(death.delayMs).toBeGreaterThanOrEqual(0);
      expect(death.delayMs).toBeLessThanOrEqual(1800);
      expect(DEFEAT_CAUSES).toContain(death.cause);
    });
  });

  it('can pick every way, the last one too', () => {
    expect(defeatDeaths(1, 1000, () => 0)[0]).toEqual({ delayMs: 0, cause: 'headshot' });
    expect(defeatDeaths(1, 1000, () => 0.9999)[0].cause).toBe('lightning');
  });
});
