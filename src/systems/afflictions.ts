import { ENEMY_BURN_MS, FIRE_SPREAD, FROST_CHILL_MS, FROST_FREEZE_HITS, FROST_SLOW } from '../config';
import { enemyTraits } from '../data/enemyKinds';
import type { UnitType } from '../types';

/**
 * What the fire and frost arrows do to an enemy (pure, tested): burning, chilled (slowed) and frozen solid. Timers count down in real time; `timeScale` is how fast everything else the
 * enemy does runs (walking, swings, drawing a bow, its animation). The vortex is systems/vortex.ts.
 */

export interface Afflictions {
  /** Burn left (ms); 0 = not burning. */
  burnMs: number;
  /** How many times the fire burning on it has spread since the arrow (0 = the arrow's own). */
  fireGen: number;
  /** After a fire goes out: can't catch from another for this long (ms). */
  fireproofMs: number;
  /** Chill left (ms) and hits taken while chilled (the FROST_FREEZE_HITS-th freezes). */
  chillMs: number;
  chillHits: number;
  /** Frozen solid for this long (ms). */
  frozenMs: number;
}

export const NO_AFFLICTIONS: Readonly<Afflictions> = { burnMs: 0, fireGen: 0, fireproofMs: 0, chillMs: 0, chillHits: 0, frozenMs: 0 };

/** Speed of everything the enemy does: stopped while frozen, slowed while chilled. */
export const timeScale = (state: Readonly<Afflictions>): number => (state.frozenMs > 0 ? 0 : state.chillMs > 0 ? FROST_SLOW : 1);

/** Counts every timer down; the chill's hit count resets once it wears off, and a fire going out leaves it fireproof. */
export const tickAfflictions = (state: Readonly<Afflictions>, deltaMs: number): Afflictions => {
  const chillMs = Math.max(0, state.chillMs - deltaMs);
  const burnMs = Math.max(0, state.burnMs - deltaMs);
  const wentOut = state.burnMs > 0 && burnMs <= 0;
  return {
    burnMs,
    fireGen: burnMs > 0 ? state.fireGen : 0,
    fireproofMs: wentOut ? FIRE_SPREAD.fireproofMs : Math.max(0, state.fireproofMs - deltaMs),
    chillMs,
    chillHits: chillMs > 0 ? state.chillHits : 0,
    frozenMs: Math.max(0, state.frozenMs - deltaMs),
  };
};

/** How long a fire arrow (or the fire spreading) sets `type` alight (its traits: the undead burn longer, the fire dragon not at all). */
export const burnDurationMs = (type: UnitType): number => ENEMY_BURN_MS * enemyTraits(type).burnFactor;

/**
 * Set alight (or relit to the full time, `duration`): fire thaws ice and drives the chill out (also from one that
 * doesn't burn). `gen` > 0 is a fire caught from another (or from the ground), `gen` steps from the arrow: it burns
 * FIRE_SPREAD.genFactor^gen as long and doesn't catch on one still fireproof.
 */
export const ignite = (state: Readonly<Afflictions>, type: UnitType, duration = burnDurationMs(type), gen = 0): Afflictions => {
  if (gen > 0 && state.fireproofMs > 0) {
    return { ...state };
  }
  const burnMs = duration * FIRE_SPREAD.genFactor ** gen;
  const relit = duration > 0 && burnMs > state.burnMs;
  return {
    burnMs: relit ? burnMs : state.burnMs,
    fireGen: relit ? gen : state.fireGen,
    fireproofMs: duration > 0 ? 0 : state.fireproofMs,
    chillMs: 0, chillHits: 0, frozenMs: 0,
  };
};

/**
 * Touched by a fire dragon's stream: burns for at least `ms` (fire thaws), as a fire that doesn't spread; a kind that
 * doesn't burn is spared, a longer fire already burning stays as it is.
 */
export const scorch = (state: Readonly<Afflictions>, type: UnitType, ms: number): Afflictions => {
  if (enemyTraits(type).burnFactor <= 0) {
    return { ...state };
  }
  const thawed = { ...state, chillMs: 0, chillHits: 0, frozenMs: 0 };
  return state.burnMs >= ms ? thawed : { ...thawed, burnMs: ms, fireGen: FIRE_SPREAD.maxGen, fireproofMs: 0 };
};

/** Whether the fire burning on it may still spread to others. */
export const fireSpreads = (state: Readonly<Afflictions>): boolean => state.burnMs > 0 && state.fireGen < FIRE_SPREAD.maxGen;

/** How long a freeze holds `type` (its traits: ogres briefly); 0 for dragons (only chilled). */
export const freezeDurationMs = (type: UnitType): number => enemyTraits(type).freezeMs;

/**
 * Hit by a frost arrow: puts out a fire and chills (a fresh chill restarts its time). The FROST_FREEZE_HITS-th hit
 * while chilled, or a headshot, freezes it solid (if it can be frozen); a frozen one stays frozen for the full time.
 */
export const chill = (state: Readonly<Afflictions>, type: UnitType, headshot: boolean): { state: Afflictions; froze: boolean } => {
  const chillHits = (state.chillMs > 0 ? state.chillHits : 0) + 1;
  const freezeMs = freezeDurationMs(type);
  const froze = freezeMs > 0 && state.frozenMs <= 0 && (headshot || chillHits >= FROST_FREEZE_HITS);
  return {
    state: {
      burnMs: 0,
      fireGen: 0,
      fireproofMs: state.fireproofMs,
      chillMs: FROST_CHILL_MS,
      chillHits: froze ? 0 : chillHits,
      frozenMs: froze ? freezeMs : state.frozenMs > 0 ? freezeMs : 0,
    },
    froze,
  };
};
