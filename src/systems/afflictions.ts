import { ENEMY_BURN_MS, FROST_CHILL_MS, FROST_FREEZE_HITS, FROST_SLOW } from '../config';
import { enemyTraits } from '../data/enemyKinds';
import type { EnemyType } from '../types';

/**
 * What the fire and frost arrows do to an enemy (pure, tested): burning, chilled (slowed) and frozen solid. Timers count down in real time; `timeScale` is how fast everything else the
 * enemy does runs (walking, swings, drawing a bow, its animation). The vortex is systems/vortex.ts.
 */

export interface Afflictions {
  /** Burn left (ms); 0 = not burning. */
  burnMs: number;
  /** Chill left (ms) and hits taken while chilled (the FROST_FREEZE_HITS-th freezes). */
  chillMs: number;
  chillHits: number;
  /** Frozen solid for this long (ms). */
  frozenMs: number;
}

export const NO_AFFLICTIONS: Readonly<Afflictions> = { burnMs: 0, chillMs: 0, chillHits: 0, frozenMs: 0 };

/** Speed of everything the enemy does: stopped while frozen, slowed while chilled. */
export const timeScale = (state: Readonly<Afflictions>): number => (state.frozenMs > 0 ? 0 : state.chillMs > 0 ? FROST_SLOW : 1);

/** Counts every timer down; the chill's hit count resets once it wears off. */
export const tickAfflictions = (state: Readonly<Afflictions>, deltaMs: number): Afflictions => {
  const chillMs = Math.max(0, state.chillMs - deltaMs);
  return {
    burnMs: Math.max(0, state.burnMs - deltaMs),
    chillMs,
    chillHits: chillMs > 0 ? state.chillHits : 0,
    frozenMs: Math.max(0, state.frozenMs - deltaMs),
  };
};

/** How long a fire arrow (or the fire spreading) sets `type` alight (its traits: the undead burn longer, the fire dragon not at all). */
export const burnDurationMs = (type: EnemyType): number => ENEMY_BURN_MS * enemyTraits(type).burnFactor;

/** Set alight (or relit to the full time, `duration`): fire thaws ice and drives the chill out. */
export const ignite = (state: Readonly<Afflictions>, type: EnemyType, duration = burnDurationMs(type)): Afflictions => {
  return duration > 0 ? { burnMs: Math.max(state.burnMs, duration), chillMs: 0, chillHits: 0, frozenMs: 0 } : { ...state };
};

/** How long a freeze holds `type` (its traits: ogres briefly); 0 for dragons (only chilled). */
export const freezeDurationMs = (type: EnemyType): number => enemyTraits(type).freezeMs;

/**
 * Hit by a frost arrow: puts out a fire and chills (a fresh chill restarts its time). The FROST_FREEZE_HITS-th hit
 * while chilled, or a headshot, freezes it solid (if it can be frozen); a frozen one stays frozen for the full time.
 */
export const chill = (state: Readonly<Afflictions>, type: EnemyType, headshot: boolean): { state: Afflictions; froze: boolean } => {
  const chillHits = (state.chillMs > 0 ? state.chillHits : 0) + 1;
  const freezeMs = freezeDurationMs(type);
  const froze = freezeMs > 0 && state.frozenMs <= 0 && (headshot || chillHits >= FROST_FREEZE_HITS);
  return {
    state: {
      burnMs: 0,
      chillMs: FROST_CHILL_MS,
      chillHits: froze ? 0 : chillHits,
      frozenMs: froze ? freezeMs : state.frozenMs > 0 ? freezeMs : 0,
    },
    froze,
  };
};
