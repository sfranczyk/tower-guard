import { SURVIVAL } from '../config';
import type { DifficultyLevel } from '../data/difficulty';
import { ENEMY_KINDS, enemyArchetype, enemyGroup, enemyThreat, isBoss } from '../data/enemyKinds';
import type { EnemyType } from '../types';

/**
 * Who a survival wave is made of (pure, tested). Every kind has a role: a supporter (priest, shaman) only backs the
 * others up and never leads; a boss (`boss` in data/enemyKinds: troll, fire dragon) comes only as a wave's lead, a few
 * at a time with escorts of its group; a fighter is anyone else. Waves are filled by a threat budget (`enemyThreat`).
 */

export type EnemyRole = 'supporter' | 'boss' | 'fighter';

export const enemyRole = (kind: EnemyType): EnemyRole => {
  if (isBoss(kind)) {
    return 'boss';
  }
  const { heals, buffs } = enemyArchetype(kind);
  return heals || buffs ? 'supporter' : 'fighter';
};

/** Supporters never lead: a wave of them alone makes no sense. */
export const canLead = (kind: EnemyType): boolean => enemyRole(kind) !== 'supporter';

/** What a wave costs of the budget. */
export const waveCost = (wave: readonly EnemyType[]): number => wave.reduce((sum, kind) => sum + enemyThreat(kind), 0);

/** A kind's share of a wave: tougher (later-arriving) kinds come less often. */
const kindWeight = (kind: EnemyType): number => 1 - 0.6 * ENEMY_KINDS[kind].arrival;

const drawOne = (kinds: readonly EnemyType[], random: () => number): EnemyType => {
  const total = kinds.reduce((sum, kind) => sum + kindWeight(kind), 0);
  let pick = random() * total;
  return kinds.find((kind) => (pick -= kindWeight(kind)) < 0) ?? kinds[kinds.length - 1];
};

/**
 * Enemies of `kinds` worth up to `budget`, drawn by weight with `random` (0..1); with a `lead` kind, SURVIVAL.leadShare
 * of the budget goes to it first (at least one). Draws stop when nothing more fits; a budget too small for anything
 * still sends the cheapest one.
 */
export const drawByBudget = (kinds: readonly EnemyType[], budget: number, random: () => number, lead?: EnemyType): EnemyType[] => {
  if (kinds.length === 0 && !lead) {
    return [];
  }
  const wave: EnemyType[] = [];
  let left = budget;
  if (lead) {
    const leadBudget = budget * SURVIVAL.leadShare;
    do {
      wave.push(lead);
      left -= enemyThreat(lead);
    } while (waveCost(wave) + enemyThreat(lead) <= leadBudget + 1e-9);
  }
  for (;;) {
    const fitting = kinds.filter((kind) => enemyThreat(kind) <= left + 1e-9);
    if (fitting.length === 0) {
      break;
    }
    const kind = drawOne(fitting, random);
    wave.push(kind);
    left -= enemyThreat(kind);
  }
  if (wave.length === 0) {
    wave.push([...kinds].sort((a, b) => enemyThreat(a) - enemyThreat(b))[0]);
  }
  return wave;
};

/** How many bosses lead a boss wave at `difficulty` (SURVIVAL.*BossMin..*BossMax, drawn with `random`). */
export const bossCount = (difficulty: DifficultyLevel, random: () => number): number => {
  const min = Math.max(1, Math.round(SURVIVAL[`${difficulty}BossMin`]));
  const max = Math.max(min, Math.round(SURVIVAL[`${difficulty}BossMax`]));
  return min + Math.min(max - min, Math.floor(random() * (max - min + 1)));
};

/** The kinds that walk with `boss`: the arrived non-bosses of its escort group, else any arrived non-boss. */
export const escortsOf = (boss: EnemyType, arrived: readonly EnemyType[]): EnemyType[] => {
  const others = arrived.filter((kind) => !isBoss(kind));
  const group = ENEMY_KINDS[boss].boss?.escorts;
  const own = others.filter((kind) => enemyGroup(kind) === group);
  return own.length > 0 ? own : others;
};

/**
 * A boss wave: `bossCount` bosses on top of the budget, escorts worth SURVIVAL.bossEscortShare of it, led with
 * SURVIVAL.secondLeadChance by one of the escorts that can lead. `gapBudget` is what the next wave's wait counts.
 */
export const drawBossWave = (boss: EnemyType, arrived: readonly EnemyType[], budget: number, difficulty: DifficultyLevel, random: () => number): { wave: EnemyType[]; gapBudget: number } => {
  const bosses = Array<EnemyType>(bossCount(difficulty, random)).fill(boss);
  const escorts = escortsOf(boss, arrived);
  const leaders = escorts.filter(canLead);
  const second = leaders.length > 0 && random() < SURVIVAL.secondLeadChance ? drawOne(leaders, random) : undefined;
  const escort = escorts.length > 0 || second ? drawByBudget(escorts, budget * SURVIVAL.bossEscortShare, random, second) : [];
  return { wave: [...bosses, ...escort], gapBudget: waveCost(bosses) + waveCost(escort) };
};
