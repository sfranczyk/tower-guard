/**
 * MOBA match rules the host picks in the room (ui/CoopPanel.ts Rules tab), kept with the stored setup
 * (`SandboxSettings.moba`) and sent to the guests with `start`. Pure data + validation.
 */
export interface MobaRules {
  /** Each keep's health (both alike). */
  keepHealth: number;
  /** Each bowman's health before upgrades (data/upgrades.ts scales it). */
  bowmanHealth: number;
  /** Gold in each player's purse at the start. */
  startGold: number;
  /** How long a fallen player waits before he is back at his keep. */
  respawnSeconds: number;
}

export const MOBA_RULE_LIMITS: Readonly<Record<keyof MobaRules, { min: number; max: number; step: number }>> = {
  keepHealth: { min: 500, max: 10000, step: 100 },
  bowmanHealth: { min: 100, max: 1000, step: 10 },
  startGold: { min: 0, max: 2000, step: 50 },
  respawnSeconds: { min: 5, max: 120, step: 5 },
};

export const DEFAULT_MOBA_RULES: Readonly<MobaRules> = {
  keepHealth: 2400,
  bowmanHealth: 300,
  startGold: 0,
  respawnSeconds: 30,
};

const clamp = (value: unknown, { min, max }: { min: number; max: number }, fallback: number): number => {
  const number = Math.round(Number(value));
  return value !== null && value !== '' && Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};

/** Fills gaps and clamps every rule (stored, typed in, or sent by the host). */
export const normalizeMobaRules = (input: Partial<MobaRules> | undefined): MobaRules => ({
  keepHealth: clamp(input?.keepHealth, MOBA_RULE_LIMITS.keepHealth, DEFAULT_MOBA_RULES.keepHealth),
  bowmanHealth: clamp(input?.bowmanHealth, MOBA_RULE_LIMITS.bowmanHealth, DEFAULT_MOBA_RULES.bowmanHealth),
  startGold: clamp(input?.startGold, MOBA_RULE_LIMITS.startGold, DEFAULT_MOBA_RULES.startGold),
  respawnSeconds: clamp(input?.respawnSeconds, MOBA_RULE_LIMITS.respawnSeconds, DEFAULT_MOBA_RULES.respawnSeconds),
});
