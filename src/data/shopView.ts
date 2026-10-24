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

export interface ShopSection {
  title: string;
  chains: ShopChain[];
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
 * the upgrades that need it (a bought arrow, then its quick draw).
 */
export const shopSections = (tab: ShopTab, funds: ShopFunds): ShopSection[] => {
  const defs = UPGRADES.filter((def) => def.tab === tab);
  const sections: ShopSection[] = [];
  defs.filter((def) => !def.requires).forEach((root) => {
    let section = sections.find((entry) => entry.title === root.section);
    if (!section) {
      section = { title: root.section, chains: [] };
      sections.push(section);
    }
    const chain: ShopChain = [];
    let next: UpgradeDef | undefined = root;
    while (next) {
      const def: UpgradeDef = next;
      for (let level = 1; level <= def.levels; level += 1) {
        chain.push(levelButton(def, level, funds));
      }
      next = defs.find((candidate) => candidate.requires?.id === def.id);
    }
    section.chains.push(chain);
  });
  return sections;
};
