import { UPGRADES, blockedBy, levelOf, upgradeCost, type ShopTab, type UpgradeDef, type UpgradeLevels } from './upgrades';

/** One button of the shop: one level of one upgrade. */
export interface ShopButton {
  /** The upgrade it buys the next level of. */
  id: string;
  label: string;
  price: number;
  /** owned: bought; buyable: the next one and affordable; poor: the next one, short of gold; locked: not yet. */
  state: 'owned' | 'buyable' | 'poor' | 'locked';
  tooltip: string;
}

/** A row of buttons joined by arrows: each needs the one before it. */
export type ShopChain = ShopButton[];

/** One place in the shop's grid: an upgrade's chain, then (each a row under it) the chains of the others that need it. */
export type ShopCell = ShopChain[];

export interface ShopSection {
  title: string;
  cells: ShopCell[];
}

/** What a payer has: the levels and the gold the upgrades of each scope count against. */
export interface ShopFunds {
  player: { levels: UpgradeLevels; gold: number };
  team: { levels: UpgradeLevels; gold: number };
}

/** The button of level `level` of `def`. */
const levelButton = (def: UpgradeDef, level: number, funds: ShopFunds): ShopButton => {
  const { levels, gold } = funds[def.scope];
  const owned = levelOf(levels, def.id);
  const price = upgradeCost(def, level);
  const base = { id: def.id, label: def.label(level), price, tooltip: def.description(level) };
  if (level <= owned) {
    return { ...base, state: 'owned' };
  }
  if (level > owned + 1) {
    return { ...base, state: 'locked', tooltip: `${base.tooltip} Needs ${def.label(level - 1)} first.` };
  }
  const reason = blockedBy(def, levels, gold);
  if (!reason) {
    return { ...base, state: 'buyable' };
  }
  return { ...base, state: reason === 'Not enough gold' ? 'poor' : 'locked', tooltip: `${base.tooltip} (${reason})` };
};

/**
 * The shop's tab `tab` (pure, tested): its sections in catalogue order, each upgrade a chain of its levels, followed by
 * the first upgrade that needs it (a bought arrow, then its quick draw); a second one that needs it (Wall breaker after
 * the explosive arrow) is a chain of its own in a row under that one, in the same cell.
 */
export const shopSections = (tab: ShopTab, funds: ShopFunds): ShopSection[] => {
  const defs = UPGRADES.filter((def) => def.tab === tab);
  const sections: ShopSection[] = [];
  const follower = (def: UpgradeDef): UpgradeDef | undefined => defs.find((candidate) => candidate.requires?.id === def.id);
  const chainFrom = (root: UpgradeDef): ShopChain => {
    const chain: ShopChain = [];
    let next: UpgradeDef | undefined = root;
    while (next) {
      const def: UpgradeDef = next;
      for (let level = 1; level <= def.levels; level += 1) {
        chain.push(levelButton(def, level, funds));
      }
      next = follower(def);
    }
    return chain;
  };
  // Starts a chain: needs nothing in this tab, or isn't the first that needs its parent.
  const startsChain = (def: UpgradeDef): boolean => {
    const parent = def.requires && defs.find((candidate) => candidate.id === def.requires!.id);
    return !parent || follower(parent) !== def;
  };
  const roots = defs.filter((def) => startsChain(def) && !(def.requires && defs.some((candidate) => candidate.id === def.requires!.id)));
  roots.forEach((root) => {
    let section = sections.find((entry) => entry.title === root.section);
    if (!section) {
      section = { title: root.section, cells: [] };
      sections.push(section);
    }
    const main = chainFrom(root);
    const ids = new Set(main.map((button) => button.id));
    const below = defs.filter((def) => startsChain(def) && def.requires && ids.has(def.requires.id)).map(chainFrom);
    section.cells.push([main, ...below]);
  });
  return sections;
};
