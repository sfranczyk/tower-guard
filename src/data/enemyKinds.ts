import {
  ENEMY_BURN_ZOMBIE_FACTOR,
  TROLL_BURN_FACTOR,
  ENEMY_SPEED,
  KNIGHT_ARMOR,
  FROST_FREEZE_BRUTE_MS,
  FROST_FREEZE_MS,
  PIN_DURATION_MS,
  PIN_DURATION_ZOMBIE_MS,
} from '../config';
import type { AttackStyle } from '../rendering/attackSwing';
import type { WalkStyle } from '../rendering/walkCycle';
import type { AllyType, EnemyType, UnitType } from '../types';

/**
 * The enemy catalogue (pure, tested). Every enemy (`EnemyType`, the id saved in setups and sent in co-op) is a
 * variant of three independent things:
 * - an **archetype**: how it fights (walks in and clubs, sprints, shoots, blows itself up, grabs, flies);
 * - a **race**: what it is (human, goblin, ogre, undead, dragon): its body, and how arrows' effects take to it;
 * - **magical** or not.
 * Gameplay code asks the archetype (`enemyArchetype`) and the traits (`enemyTraits`), never the id, so a new
 * variant (an orc kamikaze, an elf archer) is one entry here plus its look and icon.
 */

export type EnemyArchetype = 'fighter' | 'runner' | 'heavy' | 'archer' | 'kamikaze' | 'grabber' | 'skyArcher' | 'fireBreather' | 'healer' | 'cavalry' | 'shaman' | 'medic';

export type EnemyRace = 'human' | 'goblin' | 'ogre' | 'undead' | 'dragon';

/**
 * The enemies' groups, by race: what the setup's enemy picker sorts them by, and what a story level is built from
 * (mostly one group, or humans with mighty humans).
 */
export type EnemyGroup = 'humans' | 'mightyHumans' | 'nonHumans' | 'creatures';

export const ENEMY_GROUPS: Readonly<Record<EnemyGroup, { label: string }>> = {
  humans: { label: 'Humans' },
  mightyHumans: { label: 'Mighty humans' },
  nonHumans: { label: 'Non-humans' },
  creatures: { label: 'Creatures' },
};

/** Every group, in the setup's order. */
export const ENEMY_GROUP_IDS = Object.keys(ENEMY_GROUPS) as readonly EnemyGroup[];

export interface EnemyStats {
  health: number;
  speed: number;
}

/** Inclusive min..max of a random hit. */
export type DamageRange = readonly [number, number];

/** What one hit of this type deals to the bowman (the keep takes it × `keepDamage`). */
export interface EnemyDamage {
  /** Club swing (archers too, when caught up close; the zombie's grab; the kamikaze's own explosion). */
  melee: DamageRange;
  /** Arrows of shooting types (archer on foot, dragon rider). */
  arrow?: DamageRange;
}

/** How an archetype fights. */
export interface ArchetypeInfo {
  /** Its swing (also the standing pose's grip): a club swing, or the grab. */
  attackStyle: AttackStyle;
  /** Runs (run cycle) rather than walks. */
  runs: boolean;
  /** Carries a club (drawn in its hand, swung in its attacks). */
  club: boolean;
  /** Stops in range and shoots arrows (on foot). */
  shoots: boolean;
  /** Runs at the bowman or the keep and blows itself up there (CombatSystem.detonate); its bomb goes off when it dies in a blast. */
  detonates: boolean;
  /** A dragon in the air (DragonEnemy): flies in and hovers. */
  flies: boolean;
  /** Breathes fire at the bowman (a dragon); blows up when killed by a direct explosive hit. */
  breathesFire: boolean;
  /** Keeps back from the bowman and heals the wounded around it with its mana (EnemyAI, systems/healing.ts). */
  heals: boolean;
  /** Keeps back like a healer and casts buffs on the others around it, each by its kind (EnemyAI, systems/shamanBuffs.ts). */
  buffs: boolean;
  /**
   * Rides a horse (rendering/horseRider.ts, designs/warhorse.ts): gallops in and strikes with a lance from the saddle;
   * killed, it is thrown off and fights on foot as its kind's `unhorsed` while the horse bolts.
   */
  rides: boolean;
  /** The player's medic: goes to one wounded soldier or bowman at a time and bandages him (systems/AllyAI.ts). */
  bandages: boolean;
}

/** An unarmed walker that does none of the special things (the archetypes below say what they add). */
const ON_FOOT: ArchetypeInfo = {
  attackStyle: 'overhead', runs: false, club: false, shoots: false, detonates: false, flies: false, breathesFire: false, heals: false, buffs: false, rides: false, bandages: false,
};

export const ARCHETYPES: Readonly<Record<EnemyArchetype, ArchetypeInfo>> = {
  fighter: { ...ON_FOOT, club: true },
  // Sprints in and stabs up from below.
  runner: { ...ON_FOOT, attackStyle: 'uppercut', runs: true, club: true },
  // Chops with a long club in both hands.
  heavy: { ...ON_FOOT, attackStyle: 'twoHanded', club: true },
  archer: { ...ON_FOOT, shoots: true },
  kamikaze: { ...ON_FOOT, runs: true, detonates: true },
  // Arms held out; lunges and yanks its hands back.
  grabber: { ...ON_FOOT, attackStyle: 'grab' },
  // A dragon whose rider shoots (CombatSystem.updateDragon).
  skyArcher: { ...ON_FOOT, flies: true },
  // A dragon that breathes fire (CombatSystem.updateFireDragon) and blows up when killed by a direct explosive hit.
  fireBreather: { ...ON_FOOT, flies: true, breathesFire: true },
  // Follows the soldiers and heals the wounded around it; never attacks (its scepter is drawn as the club).
  healer: { ...ON_FOOT, club: true, heals: true },
  // On horseback: gallops in and thrusts its lance (timed like the sword thrust) from the saddle.
  cavalry: { ...ON_FOOT, attackStyle: 'thrust', runs: true, rides: true },
  // Follows the soldiers like the healer and casts buffs on them; never attacks (its staff is drawn as the club).
  shaman: { ...ON_FOOT, club: true, buffs: true },
  // The player's medic: kneels by one wounded man at a time and bandages him; never attacks (the staff is the club).
  medic: { ...ON_FOOT, club: true, bandages: true },
};

/** How the arrows' effects take to an enemy (races set them; a variant can override any). */
export interface EnemyTraits {
  /**
   * How heavy it is (a man is VORTEX_MASS.reference, 1.2): how a vortex takes it (systems/vortex.ts: from VORTEX_MASS.anchor, a brute, it isn't
   * caught at all, only slowed, and a direct hit barely lifts it).
   */
  mass: number;
  /** How long a freeze holds it (ms); 0 = it can't be frozen, only chilled. */
  freezeMs: number;
  /** How long a fire burns on it, × ENEMY_BURN_MS; 0 = it doesn't burn. */
  burnFactor: number;
  /** How long a pinning arrow holds it (ms); 0 = it can't be pinned. */
  pinMs: number;
  /** A priest's magic can heal it (not the undead). */
  healable: boolean;
  /** How surely it notices a kamikaze coming and keeps clear of the blast, 0..1 (0: never, the undead; systems/blastAwareness.ts). */
  blastAwareness: number;
}

export interface RaceInfo {
  label: string;
  group: EnemyGroup;
  traits: EnemyTraits;
  /** Every one of this race is magical (dragons). */
  magical: boolean;
}

const NORMAL_TRAITS: EnemyTraits = { mass: 1.2, freezeMs: FROST_FREEZE_MS, burnFactor: 1, pinMs: PIN_DURATION_MS, healable: true, blastAwareness: 0.85 };

export const RACES: Readonly<Record<EnemyRace, RaceInfo>> = {
  human: { label: 'Human', group: 'humans', traits: NORMAL_TRAITS, magical: false },
  // Small and light: a vortex tosses them about. Wary: they nearly always see a bomb coming.
  goblin: { label: 'Goblin', group: 'nonHumans', traits: { ...NORMAL_TRAITS, mass: 0.8, blastAwareness: 0.95 }, magical: false },
  // Big and heavy: no vortex lifts them, the ice holds them only briefly, no pin holds them down. Dull: often blind to a bomb.
  ogre: { label: 'Ogre', group: 'nonHumans', traits: { ...NORMAL_TRAITS, mass: 4.2, freezeMs: FROST_FREEZE_BRUTE_MS, pinMs: 0, blastAwareness: 0.4 }, magical: false },
  // Dry and numb: burns longer, keeps struggling on a pin longer; a priest's healing doesn't reach the dead. Mindless:
  // they never step aside from a bomb.
  undead: {
    label: 'Undead', group: 'creatures', traits: { ...NORMAL_TRAITS, mass: 1, burnFactor: ENEMY_BURN_ZOMBIE_FACTOR, pinMs: PIN_DURATION_ZOMBIE_MS, healable: false, blastAwareness: 0 }, magical: false,
  },
  // Up in the air: never frozen solid or pinned.
  // Up in the air (a vortex only stirs them: turbulence) and huge. (A dragon with its rider: a mighty human; a wild
  // dragon would be a creature, its own race.)
  dragon: { label: 'Dragon', group: 'mightyHumans', traits: { ...NORMAL_TRAITS, mass: 7.2, freezeMs: 0, pinMs: 0 }, magical: true },
};

/** How a variant looks and moves besides its archetype: body size (1 = a man), club reach, standing sway. */
export interface EnemyBuild {
  size: number;
  /**
   * How far (px) the club reaches when it lands: a bowman closer than this takes the hit, so to dodge he
   * has to get this far away during the swing (jumping on the spot doesn't help).
   */
  strikeReach: number;
  /** Sway speed of standing poses (ms per phase radian, default 150): zombies sway slower. */
  stepMs?: number;
  /**
   * How close (px) it comes to the bowman, and to the keep's centre, to strike (default EnemyAI's MELEE_REACH and
   * TOWER_ATTACK_REACH): a mounted knight stops with its horse's head short of him.
   */
  reach?: { bowman: number; keep: number };
  /** How it walks (rendering/walkCycle.ts): the natural walk (default) or the old high-stepping march. */
  walkStyle?: WalkStyle;
}

export interface EnemyKind {
  /** Name in the battle setup. */
  label: string;
  archetype: EnemyArchetype;
  race: EnemyRace;
  /** Magical (always, if its race is). */
  magical: boolean;
  stats: EnemyStats;
  damage: EnemyDamage;
  /** How much harder an attack hits the keep than the bowman (1 unless listed). */
  keepDamage?: Partial<Record<keyof EnemyDamage, number>>;
  build: EnemyBuild;
  /** Where in a level it starts showing up (0..1 of the level's enemies, systems/waveDirector): the tougher, the later. */
  arrival: number;
  /** Overrides of its race's traits. */
  traits?: Partial<EnemyTraits>;
  /** Swings it picks from at random, one per attack (default: its archetype's one). */
  attackStyles?: readonly AttackStyle[];
  /**
   * Plate armour: the share of an arrow's body hit that gets through (headshots, piercing arrows and blasts in full;
   * ArrowHits). None = 1.
   */
  armor?: number;
  /** A rider: what it fights on as, thrown off its horse (EnemyArchetype `rides`); `stats.health` is then the rider's. */
  unhorsed?: EnemyType;
  /** Gets its health back over time unless burning (REGEN in config.ts, systems/regeneration.ts). */
  regenerates?: boolean;
  /** A rider's horse: its own health (data/enemies `mountedDamage` says which of them a hit hurts). */
  mount?: { health: number };
  /** One of the player's soldiers (summoned, fights the enemies: systems/AllyAI.ts); none = an enemy. */
  side?: 'ally';
  /** A MOBA lane minion only (never summoned, not in the HUD or a battle's setup: scenes/BattleLanes.ts). */
  minion?: boolean;
  /** What it costs of a survival wave's budget (systems/survivalWaves.ts; a raider 1). */
  threat?: number;
  /**
   * A boss (survival): comes only as a wave's lead, a few at a time, with escorts from `escorts` (systems/survivalRoles.ts).
   */
  boss?: { escorts: EnemyGroup };
}

/**
 * The enemies, in the battle setup's order. Health is planned in arrows (a normal arrow's body hit deals 10–20, a
 * headshot 22.5–30, an explosive arrow only its blast, 35 at the centre down to 10 at the edge): kamikazes die to any
 * arrow (they must be stopped before they reach you), runners, archers and priests to two body hits or one headshot,
 * fighters and shamans to three (or two headshots), zombies to five (three), brutes six or seven (four), dragons nine or
 * ten (six); knights' plate makes body hits near useless (nine and thirteen; two and three headshots). Runners nick,
 * fighters hit, brutes smash; the dragon rider's arrows hit hardest. Archers' arrows barely scratch the keep's stone,
 * brutes smash it and a kamikaze's bomb is made for walls.
 */
export const ENEMY_KINDS: Readonly<Record<UnitType, EnemyKind>> = {
  raider: {
    label: 'Raider', archetype: 'fighter', race: 'human', magical: false, arrival: 0, threat: 1,
    stats: { health: 29, speed: 26 }, damage: { melee: [6, 10] }, build: { size: 1, strikeReach: 55 },
  },
  // Goblins, three quarters of a man's height.
  fast: {
    label: 'Goblin runner', archetype: 'runner', race: 'goblin', magical: false, arrival: 0.05, threat: 0.7,
    stats: { health: 18, speed: ENEMY_SPEED * 2.1 }, damage: { melee: [3, 6] }, build: { size: 0.75, strikeReach: 45 },
  },
  // Ogres stand half again as tall: their long club is hard to step away from.
  tank: {
    label: 'Ogre brute', archetype: 'heavy', race: 'ogre', magical: false, arrival: 0.3, threat: 2.5,
    stats: { health: 150, speed: 18 }, damage: { melee: [14, 22] }, keepDamage: { melee: 2 }, build: { size: 1.5, strikeReach: 85 },
  },
  // A troll: taller and slower than the brute, with long arms and a stone club. Its wounds close (REGEN): set it alight
  // to stop that, then finish it while it burns.
  troll: {
    label: 'Troll', archetype: 'heavy', race: 'ogre', magical: false, arrival: 0.4, threat: 3.5, boss: { escorts: 'nonHumans' }, regenerates: true,
    stats: { health: 130, speed: 15 }, damage: { melee: [16, 24] }, keepDamage: { melee: 2 }, build: { size: 1.6, strikeReach: 90 },
    traits: { burnFactor: TROLL_BURN_FACTOR },
  },
  // Fragile, keeps its distance and shoots.
  hunter: {
    label: 'Hunter', archetype: 'archer', race: 'human', magical: false, arrival: 0.15, threat: 1,
    stats: { health: 22, speed: 26 }, damage: { melee: [3, 5], arrow: [7, 10] }, keepDamage: { arrow: 0.5 },
    build: { size: 1, strikeReach: 55 },
  },
  // Flying archer mount: tough, flies in steadily (speed is its horizontal flight speed). Never melees.
  dragon: {
    label: 'Dragon archer', archetype: 'skyArcher', race: 'dragon', magical: true, arrival: 0.35, threat: 2.5,
    stats: { health: 100, speed: ENEMY_SPEED * 1.2 }, damage: { melee: [0, 0], arrow: [12, 16] }, build: { size: 1, strikeReach: 0 },
  },
  // Flies in lower and closer to breathe fire. No hits of its own: its fire sets the bowman alight (BURN_* in config.ts).
  fireDragon: {
    label: 'Fire dragon', archetype: 'fireBreather', race: 'dragon', magical: true, arrival: 0.4, threat: 5, boss: { escorts: 'humans' },
    stats: { health: 150, speed: ENEMY_SPEED * 1.2 }, damage: { melee: [0, 0] }, build: { size: 1, strikeReach: 0 },
    traits: { burnFactor: 0 },
  },
  // Sprints at the bowman with a bomb and blows up on contact.
  kamikaze: {
    label: 'Kamikaze', archetype: 'kamikaze', race: 'human', magical: false, arrival: 0.25, threat: 1,
    stats: { health: 22, speed: ENEMY_SPEED * 1.8 }, damage: { melee: [24, 32] }, keepDamage: { melee: 3 }, build: { size: 1, strikeReach: 0 },
    traits: { mass: 1.4 },
  },
  // The goblin's cheap version: smaller and quicker, one round bomb, a weaker blast; any arrow puts it down.
  goblinKamikaze: {
    label: 'Goblin bomber', archetype: 'kamikaze', race: 'goblin', magical: false, arrival: 0.2, threat: 1,
    stats: { health: 1, speed: ENEMY_SPEED * 2.2 }, damage: { melee: [12, 18] }, keepDamage: { melee: 2 }, build: { size: 0.8, strikeReach: 0 },
    traits: { mass: 1 },
  },
  // Slow, arms out, hard to put down. Its shuffle is the march with the feet dragged.
  zombie: {
    label: 'Zombie', archetype: 'grabber', race: 'undead', magical: false, arrival: 0.1, threat: 1,
    stats: { health: 65, speed: ENEMY_SPEED * 0.4 }, damage: { melee: [8, 12] }, build: { size: 1, strikeReach: 50, stepMs: 240, walkStyle: 'march' },
  },
  // Black plate (the knights march, rendering/walkCycle): body hits barely dent it (KNIGHT_ARMOR), so aim for the visor or use piercing arrows. A sword: it cuts
  // down, cuts up from below or thrusts.
  knight: {
    label: 'Black knight', archetype: 'fighter', race: 'human', magical: false, arrival: 0.2, threat: 1.5, armor: KNIGHT_ARMOR,
    attackStyles: ['overhead', 'swordRise', 'thrust'],
    stats: { health: 40, speed: 24 }, damage: { melee: [9, 14] }, build: { size: 1, strikeReach: 60, walkStyle: 'march' },
    traits: { mass: 1.9 },
  },
  // A head taller, in the same black plate, with a war hammer in both hands.
  heavyKnight: {
    label: 'Heavy knight', archetype: 'heavy', race: 'human', magical: false, arrival: 0.35, threat: 2, armor: KNIGHT_ARMOR,
    stats: { health: 60, speed: 20 }, damage: { melee: [16, 24] }, keepDamage: { melee: 2 }, build: { size: 1.1, strikeReach: 75, walkStyle: 'march' },
    // Trusts its plate: slower to heed a bomb.
    traits: { mass: 2.5, blastAwareness: 0.7 },
  },
  // The black knight on a black warhorse (drawn 1.15× so the horse stands tall): gallops in and strikes with a lance from beyond a sword's reach. Rider
  // and horse have their own health: the rider's plate (`armor`, on his torso only) turns body hits, the horse has none. The horse killed, the knight is
  // thrown off and fights on foot with the health he has left; the rider killed (or pulled out of the saddle by a vortex), the horse bolts.
  horseKnight: {
    label: 'Mounted knight', archetype: 'cavalry', race: 'human', magical: false, arrival: 0.45, threat: 2, unhorsed: 'knight', armor: KNIGHT_ARMOR,
    mount: { health: 60 },
    stats: { health: 40, speed: ENEMY_SPEED * 2 }, damage: { melee: [14, 20] }, keepDamage: { melee: 1.5 },
    build: { size: 1.15, strikeReach: 64, reach: { bowman: 42, keep: 82 } },
    // Horse and rider: no vortex lifts them off the ground, no pin holds a horse, the ice holds them briefly.
    traits: { mass: 6, freezeMs: FROST_FREEZE_BRUTE_MS, pinMs: 0 },
  },
  // Frail and never attacks, but it keeps the others standing: kill it first.
  priest: {
    label: 'Dark priest', archetype: 'healer', race: 'human', magical: true, arrival: 0.15, threat: 1.5,
    stats: { health: 20, speed: 27 }, damage: { melee: [0, 0] }, build: { size: 1, strikeReach: 0 },
  },
  // Small and quick, never attacks: hastens the soldiers, hardens the heavies, speeds the archers' draw, makes the
  // kamikazes' bombs bigger and mends the undead (systems/shamanBuffs.ts).
  shaman: {
    label: 'Goblin shaman', archetype: 'shaman', race: 'goblin', magical: true, arrival: 0.25, threat: 1.5,
    stats: { health: 30, speed: 23 }, damage: { melee: [0, 0] }, build: { size: 0.9, strikeReach: 0 },
  },
  // The player's soldiers (`side: 'ally'`, summoned from beyond the left edge, scenes/BattleAllies.ts). `damage` is
  // what their blows deal to the enemies. A squire is a raider's match: cheap, quick and soon down.
  squire: {
    label: 'Squire', archetype: 'fighter', race: 'human', magical: false, arrival: 0, side: 'ally',
    stats: { health: 30, speed: ENEMY_SPEED * 1.2 }, damage: { melee: [6, 10] }, build: { size: 0.95, strikeReach: 55 },
  },
  // In plate like the black knight (`armor`: arrows and blows on the body mostly turned), slow, hits hard.
  allyKnight: {
    label: 'Knight', archetype: 'fighter', race: 'human', magical: false, arrival: 0, side: 'ally', armor: KNIGHT_ARMOR,
    attackStyles: ['overhead', 'swordRise', 'thrust'],
    stats: { health: 45, speed: ENEMY_SPEED * 0.9 }, damage: { melee: [10, 15] }, build: { size: 1, strikeReach: 60, walkStyle: 'march' },
    traits: { mass: 1.9 },
  },
  // Never fights: goes to the most wounded soldier (or the bowman, badly hurt) and bandages him (MEDIC in config.ts).
  medic: {
    label: 'Medic', archetype: 'medic', race: 'human', magical: false, arrival: 0, side: 'ally',
    stats: { health: 25, speed: ENEMY_SPEED }, damage: { melee: [0, 0] }, build: { size: 1, strikeReach: 0 },
  },
  // MOBA: the blue lane's archer, the hunter in the bowman's blue (scenes/BattleLanes.ts; AllyAI shoots with it).
  blueArcher: {
    label: 'Blue archer', archetype: 'archer', race: 'human', magical: false, arrival: 0, side: 'ally', minion: true,
    stats: { health: 22, speed: 26 }, damage: { melee: [3, 5], arrow: [7, 10] }, keepDamage: { arrow: 0.5 },
    build: { size: 1, strikeReach: 55 },
  },
  // MOBA: the red lane's troop, the squire in red (both lanes send squires).
  redSquire: {
    label: 'Red squire', archetype: 'fighter', race: 'human', magical: false, arrival: 0, minion: true,
    stats: { health: 30, speed: ENEMY_SPEED * 1.2 }, damage: { melee: [6, 10] }, build: { size: 0.95, strikeReach: 55 },
  },
};

/** Every stickman kind, foes and allies (for the tables keyed by kind). */
export const UNIT_TYPES = Object.keys(ENEMY_KINDS) as readonly UnitType[];

/** Fights on the player's side: a soldier or a MOBA lane minion (blue bar, faces right, AllyAI). */
export const fightsForPlayer = (type: UnitType): boolean => ENEMY_KINDS[type].side === 'ally';

/** One of the player's soldiers (summoned from the HUD). */
export const isAllyType = (type: UnitType): type is AllyType => fightsForPlayer(type) && !ENEMY_KINDS[type].minion;

/** Every enemy, in the battle setup's order. */
export const ENEMY_TYPES = UNIT_TYPES.filter((type) => !fightsForPlayer(type) && !ENEMY_KINDS[type].minion) as readonly EnemyType[];

/** The player's soldiers, in the HUD's order. */
export const ALLY_TYPES = UNIT_TYPES.filter(isAllyType);

export const enemyArchetype = (type: UnitType): ArchetypeInfo => ARCHETYPES[ENEMY_KINDS[type].archetype];

/** Its race's traits with its own overrides. */
/** Race traits with the variant's overrides; a bomb carrier doesn't burn (fire sets the bomb off or does nothing, systems/kamikazeBomb.ts). */
export const enemyTraits = (type: UnitType): EnemyTraits => ({
  ...RACES[ENEMY_KINDS[type].race].traits,
  ...ENEMY_KINDS[type].traits,
  ...(enemyArchetype(type).detonates ? { burnFactor: 0 } : {}),
});

/** Its share of a survival wave's budget (`threat`, 1 unless listed). */
export const enemyThreat = (type: UnitType): number => ENEMY_KINDS[type].threat ?? 1;

/** Whether it is a boss (survival: only a wave's lead, systems/survivalRoles.ts). */
export const isBoss = (type: UnitType): boolean => ENEMY_KINDS[type].boss !== undefined;

/** Its group (by its race). */
export const enemyGroup = (type: UnitType): EnemyGroup => RACES[ENEMY_KINDS[type].race].group;

/** The enemies of a group, in the setup's order. */
export const enemyTypesOf = (group: EnemyGroup): readonly EnemyType[] => ENEMY_TYPES.filter((type) => enemyGroup(type) === group);

/** How heavy it is (a man 1.2, VORTEX_MASS.reference; race traits with the variant's own). */
export const enemyMass = (type: UnitType): number => enemyTraits(type).mass;

/** Whether its wounds close by themselves (trolls). */
export const enemyRegenerates = (type: UnitType): boolean => ENEMY_KINDS[type].regenerates ?? false;

/** The share of an arrow's body hit that gets through its armour (1 = none). */
export const enemyArmor = (type: UnitType): number => ENEMY_KINDS[type].armor ?? 1;

/** The enemies that fly (dragons, objects/dragon/DragonEnemy). */
export type FlyingType = Extract<EnemyType, 'dragon' | 'fireDragon'>;

/** A dragon (DragonEnemy) rather than a ground enemy (its archetype flies). */
export const isFlyingType = (type: UnitType): type is FlyingType => enemyArchetype(type).flies;
