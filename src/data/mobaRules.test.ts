import { describe, expect, it } from 'vitest';
import { DEFAULT_MOBA_RULES, MOBA_RULE_LIMITS, normalizeMobaRules } from './mobaRules';

describe('moba rules', () => {
  it('defaults every missing rule', () => {
    expect(normalizeMobaRules(undefined)).toEqual(DEFAULT_MOBA_RULES);
    expect(normalizeMobaRules({ startGold: 150 })).toEqual({ ...DEFAULT_MOBA_RULES, startGold: 150 });
  });

  it('clamps and rounds what is out of range or not a number', () => {
    const rules = normalizeMobaRules({ keepHealth: 99999, bowmanHealth: -4, startGold: 'lots' as unknown as number, respawnSeconds: 12.6 });
    expect(rules).toEqual({
      keepHealth: MOBA_RULE_LIMITS.keepHealth.max,
      bowmanHealth: MOBA_RULE_LIMITS.bowmanHealth.min,
      startGold: DEFAULT_MOBA_RULES.startGold,
      respawnSeconds: 13,
    });
  });
});
