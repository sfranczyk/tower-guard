import { ARROW_INFO, type ArrowType } from './loadout';
import type { MinionRole } from './moba';

/**
 * MOBA's shop (pure, tested): every upgrade is one entry here, and gameplay reads only what `playerStats` /
 * `teamStats` make of the levels bought. To add a skill: one `UpgradeDef` (+ a stat field and its use, if it does
 * something new). A level's price is `firstCost × costGrowth^(level − 1)`, rounded to 10; a level needs the one
 * before it, and an entry's `requires` (drawn as an arrow in the shop) before its first.
 */

export type ShopTab = 'skills' | 'castle';

/** Who pays and who has it: the player (his purse), or his team (its vault). */
export type UpgradeScope = 'player' | 'team';

export interface UpgradeDef {
  readonly id: string;
  readonly tab: ShopTab;
  /** The heading it sits under in its tab. */
  readonly section: string;
  readonly scope: UpgradeScope;
  /** The button's name for level `level` (1 = the first bought). */
  readonly label: (level: number) => string;
  /** The tooltip for level `level`. */
  readonly description: (level: number) => string;
  /** How many levels can be bought. */
  readonly levels: number;
  readonly firstCost: number;
  readonly costGrowth: number;
  /** Needed (at least that level) before its first level. */
  readonly requires?: { readonly id: string; readonly level: number };
  /** Buying it puts this arrow in the quiver (at most MAX_BOUGHT_ARROWS of them). */
  readonly arrow?: ArrowType;
}

/** Arrows a player can buy besides the normal one. */
export const MAX_BOUGHT_ARROWS = 3;
/** The normal arrow's damage per level (it starts at level 1; the shop sells 2 and 3). */
export const BASIC_ARROW_DAMAGE_STEP = 0.25;
/** A bought arrow's quick-draw upgrade: its reload takes this share of the time. */
export const QUICK_DRAW_COOLDOWN = 0.5;
export const REGEN_STEP = 5;
export const MAX_HP_STEP = 0.2;
/** MOBA: a bowman walks at SPEED_BASE of the normal speed, each Speed level SPEED_STEP more. */
export const SPEED_BASE = 0.8;
export const SPEED_STEP = 0.2;
/** A minion upgrade level: +50% health and damage. */
export const MINION_STEP = 0.5;
/** Wall breaker: each level adds this × to an explosive arrow's damage to a keep (×2, then ×3). */
export const WALL_BREAKER_STEP = 1;

const percent = (share: number): string => `${Math.round(share * 100)}%`;

/** The arrows to buy, in the shop's order. */
const BOUGHT_ARROWS: readonly ArrowType[] = ['fire', 'frost', 'shrapnel', 'pinning', 'piercing', 'explosive', 'vortex'];

/** What an arrow costs, and its quick draw (the rest: DEFAULT_ARROW_PRICE). */
const ARROW_PRICES: Partial<Record<ArrowType, { arrow: number; quick: number }>> = {
  fire: { arrow: 150, quick: 250 },
  frost: { arrow: 200, quick: 250 },
  shrapnel: { arrow: 200, quick: 250 },
  pinning: { arrow: 200, quick: 250 },
};
const DEFAULT_ARROW_PRICE = { arrow: 250, quick: 300 };

const MINION_NAMES: Readonly<Record<MinionRole, string>> = { troop: 'Troops', archer: 'Archers', dragon: 'Dragons', kamikaze: 'Kamikazes' };

/** After the explosive arrow (its own chain, beside the arrow's): more damage to a keep. */
const WALL_BREAKER: UpgradeDef = {
  id: 'wallBreaker', tab: 'skills', section: 'Arrows', scope: 'player', levels: 2, firstCost: 300, costGrowth: 2,
  requires: { id: 'arrow:explosive', level: 1 },
  label: (level) => `Wall breaker ${'I'.repeat(level)}`,
  description: (level) => `${ARROW_INFO.explosive.name} hits on a keep do ×${1 + WALL_BREAKER_STEP * level} damage (level ${level}).`,
};

export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'basicArrow', tab: 'skills', section: 'Arrows', scope: 'player', levels: 2, firstCost: 150, costGrowth: 2,
    label: (level) => `Normal arrow ${'I'.repeat(level + 1)}`,
    description: (level) => `Normal arrow level ${level + 1}: +${percent(BASIC_ARROW_DAMAGE_STEP * level)} damage over level 1.`,
  },
  ...BOUGHT_ARROWS.flatMap((type): UpgradeDef[] => [
    {
      id: `arrow:${type}`, tab: 'skills', section: 'Arrows', scope: 'player', levels: 1, firstCost: (ARROW_PRICES[type] ?? DEFAULT_ARROW_PRICE).arrow, costGrowth: 1, arrow: type,
      label: () => ARROW_INFO[type].name,
      description: () => `${ARROW_INFO[type].name}: ${ARROW_INFO[type].summary}. Adds it to your quiver (up to ${MAX_BOUGHT_ARROWS} arrows besides the normal one).`,
    },
    {
      id: `quick:${type}`, tab: 'skills', section: 'Arrows', scope: 'player', levels: 1, firstCost: (ARROW_PRICES[type] ?? DEFAULT_ARROW_PRICE).quick, costGrowth: 1,
      requires: { id: `arrow:${type}`, level: 1 },
      label: () => 'Quick draw',
      description: () => `${ARROW_INFO[type].name} reloads twice as fast.`,
    },
    ...(type === 'explosive' ? [WALL_BREAKER] : []),
  ]),
  {
    id: 'regen', tab: 'skills', section: 'Passive', scope: 'player', levels: 3, firstCost: 100, costGrowth: 1.6,
    label: (level) => `Regeneration ${'I'.repeat(level)}`,
    description: (level) => `Healing out of combat: +${REGEN_STEP * level} health a tick (level ${level}).`,
  },
  {
    id: 'maxHp', tab: 'skills', section: 'Passive', scope: 'player', levels: 3, firstCost: 100, costGrowth: 1.6,
    label: (level) => `Max health ${'I'.repeat(level)}`,
    description: (level) => `+${percent(MAX_HP_STEP * level)} health (level ${level}).`,
  },
  {
    id: 'speed', tab: 'skills', section: 'Passive', scope: 'player', levels: 3, firstCost: 60, costGrowth: 2,
    label: (level) => `Speed ${'I'.repeat(level)}`,
    description: (level) => `Walk at ${percent(SPEED_BASE + SPEED_STEP * level)} of the normal speed (level ${level}; ${percent(SPEED_BASE)} without it).`,
  },
  ...(['troop', 'archer', 'dragon'] as const).map((role): UpgradeDef => ({
    id: `minion:${role}`, tab: 'castle', section: 'Minions', scope: 'team', levels: 2, firstCost: 400, costGrowth: 2,
    label: (level) => `${MINION_NAMES[role]} ${'★'.repeat(level)}`,
    description: (level) => `${MINION_NAMES[role]} level ${level + 1}: +${percent(MINION_STEP * level)} health and damage over level 1, for every one sent from now on (paid from the team vault).`,
  })),
];

export const upgradeById = (id: string): UpgradeDef | undefined => UPGRADES.find((def) => def.id === id);

/** Levels bought, by upgrade id (0 when missing). */
export type UpgradeLevels = Readonly<Record<string, number>>;

export const levelOf = (levels: UpgradeLevels, id: string): number => levels[id] ?? 0;

/** What level `level` of `def` costs (rounded to 10). */
export const upgradeCost = (def: UpgradeDef, level: number): number =>
  Math.round((def.firstCost * Math.pow(def.costGrowth, level - 1)) / 10) * 10;

/** Why the next level of `def` can't be bought now, or undefined if it can. `levels` are the payer's (player or team). */
export const blockedBy = (def: UpgradeDef, levels: UpgradeLevels, purse: number): string | undefined => {
  const next = levelOf(levels, def.id) + 1;
  if (next > def.levels) {
    return 'Bought';
  }
  if (def.requires && levelOf(levels, def.requires.id) < def.requires.level) {
    return `Needs ${upgradeById(def.requires.id)?.label(def.requires.level) ?? def.requires.id}`;
  }
  if (def.arrow && boughtArrows(levels).length >= MAX_BOUGHT_ARROWS) {
    return `Up to ${MAX_BOUGHT_ARROWS} arrows`;
  }
  if (purse < upgradeCost(def, next)) {
    return 'Not enough gold';
  }
  return undefined;
};

/**
 * The arrows bought, in the order they were bought (each takes the next quiver slot, so the keys already learnt stay):
 * the levels' own key order, which is the order of first purchase and survives copying and the co-op JSON.
 */
export const boughtArrows = (levels: UpgradeLevels): ArrowType[] =>
  Object.keys(levels)
    .filter((id) => id.startsWith('arrow:') && levelOf(levels, id) > 0)
    .map((id) => id.slice('arrow:'.length) as ArrowType)
    .filter((type) => (BOUGHT_ARROWS as readonly ArrowType[]).includes(type));

/** What a player's levels make of him. */
export interface PlayerStats {
  /** The quiver: the normal arrow, then the ones bought. */
  quiver: ArrowType[];
  /** × on the normal arrow's damage. */
  basicDamage: number;
  /** × on an explosive arrow's damage to a keep (Wall breaker). */
  keepBlast: number;
  /** × on each arrow's reload. */
  cooldown: Partial<Record<ArrowType, number>>;
  /** Added to every healing tick. */
  regenBonus: number;
  /** × on full health. */
  maxHealth: number;
  /** × on walking speed. */
  speed: number;
}

export const playerStats = (levels: UpgradeLevels): PlayerStats => ({
  quiver: ['normal', ...boughtArrows(levels)],
  basicDamage: 1 + BASIC_ARROW_DAMAGE_STEP * levelOf(levels, 'basicArrow'),
  keepBlast: 1 + WALL_BREAKER_STEP * levelOf(levels, 'wallBreaker'),
  cooldown: Object.fromEntries(BOUGHT_ARROWS.filter((type) => levelOf(levels, `quick:${type}`) > 0).map((type) => [type, QUICK_DRAW_COOLDOWN])),
  regenBonus: REGEN_STEP * levelOf(levels, 'regen'),
  maxHealth: 1 + MAX_HP_STEP * levelOf(levels, 'maxHp'),
  speed: SPEED_BASE + SPEED_STEP * levelOf(levels, 'speed'),
});

/** A team's minion level per role (1 = none bought; stars under the health bar = level − 1). */
export const minionLevel = (levels: UpgradeLevels, role: MinionRole): number => 1 + levelOf(levels, `minion:${role}`);

/** × on a minion's health and damage at `level`. */
export const minionPower = (level: number): number => 1 + MINION_STEP * (level - 1);
