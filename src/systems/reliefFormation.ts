import type { AllyType } from '../types';

export interface ReliefSettings {
  knights: number;
  squires: number;
  medics: number;
  gap: number;
  frontX: number;
  spacing: number;
  rankDepth: number;
  /** Where the files come in (beyond the left edge). */
  spawnX: number;
}

export interface ReliefPlace {
  type: AllyType;
  /** Where he stands in the formation, and how far down the screen (px, the front rank lowest: nearest). */
  x: number;
  depth: number;
  /** Where he starts, in his file beyond the left edge. */
  startX: number;
}

/**
 * The relief force's formation (pure, tested): the knights in the front rank, the squires in two ranks behind them
 * (the second staggered by half a place), the medics at the left end of the last rank. Each rank marches in as its own
 * file, the man going furthest in front, so nobody walks through another.
 */
export const reliefFormation = (settings: ReliefSettings): ReliefPlace[] => {
  const { frontX, spacing, rankDepth, gap, spawnX } = settings;
  const half = Math.ceil(settings.squires / 2);
  const ranks: AllyType[][] = [
    Array<AllyType>(settings.knights).fill('allyKnight'),
    Array<AllyType>(settings.squires - half).fill('squire'),
    [...Array<AllyType>(half).fill('squire'), ...Array<AllyType>(settings.medics).fill('medic')],
  ];
  return ranks.flatMap((rank, rankIndex) => rank.map((type, index) => ({
    type,
    x: frontX - (rankIndex === 1 ? spacing / 2 : 0) - index * spacing,
    depth: (ranks.length - 1 - rankIndex) * rankDepth,
    startX: spawnX - index * gap,
  })));
};
