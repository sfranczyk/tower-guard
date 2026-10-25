/**
 * MOBA's end (scenes/BattleOutcome.ts): the losing side's minions all die, one after another over `spreadMs`, each in
 * its own way (a headshot, an arrow, a blade, blown apart, a blast, lightning). Pure, tested.
 */
export const DEFEAT_CAUSES = ['headshot', 'arrow', 'melee', 'blast', 'explosion', 'lightning'] as const;
export type DefeatCause = (typeof DEFEAT_CAUSES)[number];

export interface DefeatDeath {
  /** After the keep fell (ms). */
  delayMs: number;
  cause: DefeatCause;
}

/** How each of `count` losers dies (`random` 0..1, passed in so tests can pin it). */
export const defeatDeaths = (count: number, spreadMs: number, random: () => number = Math.random): DefeatDeath[] =>
  Array.from({ length: count }, () => ({
    delayMs: Math.round(random() * spreadMs),
    cause: DEFEAT_CAUSES[Math.min(DEFEAT_CAUSES.length - 1, Math.floor(random() * DEFEAT_CAUSES.length))],
  }));
