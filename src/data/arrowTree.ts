import type { ArrowType } from './loadout';

/**
 * The arrow tree: every arrow grows out of the normal one along one of three paths. Archer: better normal arrows
 * (normal → piercing); craftsman: mechanics (normal → pinning → shrapnel, pinning → fire → explosive); mage: magic,
 * branching off the craftsman's fire (fire → frost → vortex). For now the whole tree is open; character progression
 * (experience, gold, unlocks) will build on it later. Evolutions join the quiver next to their parent; the one
 * exception planned is the long-range arrow, a level of the normal arrow rather than an arrow of its own.
 * Pure data + queries.
 */

export type ArrowPath = 'archer' | 'craftsman' | 'mage';

export const ARROW_PATHS: readonly ArrowPath[] = ['archer', 'craftsman', 'mage'];

export const ARROW_PATH_NAMES: Readonly<Record<ArrowPath, string>> = {
  archer: 'Archer',
  craftsman: 'Craftsman',
  mage: 'Mage',
};

export interface ArrowNode {
  path: ArrowPath;
  /** The arrow this one evolves from; `null` only for the root (normal). */
  parent: ArrowType | null;
}

export const ARROW_TREE: Readonly<Record<ArrowType, ArrowNode>> = {
  normal: { path: 'archer', parent: null },
  piercing: { path: 'archer', parent: 'normal' },
  pinning: { path: 'craftsman', parent: 'normal' },
  shrapnel: { path: 'craftsman', parent: 'pinning' },
  fire: { path: 'craftsman', parent: 'pinning' },
  explosive: { path: 'craftsman', parent: 'fire' },
  frost: { path: 'mage', parent: 'fire' },
  vortex: { path: 'mage', parent: 'frost' },
};

/** The arrows from the root down to `type` (root first, `type` last). */
export const arrowLineage = (type: ArrowType): ArrowType[] => {
  const parent = ARROW_TREE[type].parent;
  return parent ? [...arrowLineage(parent), type] : [type];
};

/** Arrows on `path`, parents before their evolutions, in the order of `types`. */
export const arrowsOnPath = (path: ArrowPath, types: readonly ArrowType[]): ArrowType[] =>
  types
    .filter((type) => ARROW_TREE[type].path === path)
    .sort((a, b) => arrowLineage(a).length - arrowLineage(b).length);
