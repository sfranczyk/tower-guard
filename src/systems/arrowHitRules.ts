import type { Graphics } from 'pixi.js';
import { ARROWS, FIRE_ARROW_DAMAGE, FROST_ARROW_DAMAGE, MOBA_LANES, PIN_DAMAGE, SHRAPNEL_FRAGMENT_DAMAGE } from '../config';
import type { SoundId } from '../audio/SoundManager';
import type { EnemyEdge } from '../data/difficulty';
import type { Team } from '../data/moba';
import { enemyDamage, explosionDamage, rollArrowDamage, rollDamage, type DamageTarget, type MountPart } from '../data/enemies';
import { MINION_ARROW_OWNER, type default as Arrow } from '../objects/Arrow';
import type Bowman from '../objects/bowman/Bowman';
import DragonEnemy from '../objects/dragon/DragonEnemy';
import type Enemy from '../objects/enemy/Enemy';
import type Tower from '../objects/Tower';
import type { ProjectileType, Vec2 } from '../types';
import type { BowmanHit } from './bowmanDeath';
import { segmentHitTime } from './collision';
import { foeHitBoxes, type Foe } from './combatGeometry';
import type { EffectsSystem } from './EffectsSystem';

/**
 * What ArrowHits works with: what it needs of the battle and tells it, the hit tests (earliest hit of an arrow's
 * segment this frame on an enemy's or a bowman's hit boxes) and what each kind of arrow deals.
 */

/** Damage of the fire and frost arrows' hit, × a normal arrow's (`rollArrowDamage`) (their effect does the rest; a vortex arrow does none). */
const MAGIC_HIT_DAMAGE: Partial<Record<ProjectileType, number>> = { fire: FIRE_ARROW_DAMAGE, frost: FROST_ARROW_DAMAGE };
export const PIERCING_MAX_IMPACTS = 5;
/** A pinning arrow's centre sits this far back from where its tip goes into the ground (the sprite is ~27 px long). */
export const PIN_SINK = 9.5;
/** An arrow hitting a keep sticks into the stone with its centre this far back from the point of impact. */
export const WALL_SINK = 10.5;

export interface EnemyHit {
  enemy: Foe;
  time: number;
  headshot: boolean;
  /** A mounted knight's horse hit in the leg. */
  leg?: boolean;
  /** A mounted knight: the rider or the horse. */
  part?: MountPart;
}

export interface BowmanArrowHit {
  bowman: Bowman;
  time: number;
  headshot: boolean;
}

/** An enemy's or minion's arrow: its shooter's damage, × the shooter's power (MOBA upgrades). */
export const arrowDamage = (arrow: Arrow, target: DamageTarget): number => rollDamage(enemyDamage(arrow.shooter ?? 'hunter', 'arrow', target)) * (arrow.power ?? 1);

/** × on a minion's arrow in `foe`: a MOBA lane kamikaze shrugs off part of it. */
export const minionShare = (foe: Foe): number => (!(foe instanceof DragonEnemy) && foe.siege ? MOBA_LANES.kamikazeMinionDamage : 1);

/** The player who loosed `arrow` (none: an enemy's or a minion's). */
export const playerOf = (arrow: Arrow): number | undefined => (arrow.hostile || arrow.owner < 0 ? undefined : arrow.owner);

/** What the arrows need of the battle. */
export interface ArrowHitsWorld {
  /** The bowmen enemy arrows go for (MOBA: the blue team's). */
  readonly bowmen: readonly Bowman[];
  /** Every player's bowman by player index (MOBA; else `bowmen`): whose arrow is whose. */
  readonly allBowmen?: readonly Bowman[];
  readonly playerTower: Tower;
  readonly enemyTower: Tower;
  /** The player's soldiers: enemy arrows hit them (players' arrows only with friendly fire, as `resolve`'s targets). */
  readonly allies: readonly Enemy[];
  /** MOBA lanes: the blue dragons (enemy arrows hit them like the soldiers). */
  readonly allyFliers?: readonly DragonEnemy[];
  readonly arrows: readonly Arrow[];
  readonly effects: EffectsSystem;
  readonly debug: Graphics;
  /** The difficulty's edge (data/difficulty.ts): enemy hits × `damage`, enemy archers' aim error × `aimSpread`. */
  readonly enemyEdge: EnemyEdge;
  /** MOBA: each bowman's team (a soldier hit by his own team's player curses instead of groaning). */
  readonly teamOf?: (bowman: Bowman) => Team;
}

export interface ArrowHitsEvents {
  bowmanDamaged(bowman: Bowman, amount: number, hit: BowmanHit): void;
  headshot(): void;
  /** Player `owner`'s arrow hit its first target (someone or the keep): the end screen's accuracy. */
  arrowLanded?(owner: number, type: ProjectileType): void;
  /** `heardBy`: only that player hears it (the others hear `soundFor`'s stand-in). */
  sound(id: SoundId, at: Vec2, heardBy?: number): void;
}

/** The blasts and ice CombatSystem handles (they reach beyond the one arrow). */
export interface ArrowHitsActions {
  /** Returns the id of the chain of kamikaze bombs the blast starts; `by`: the player whose arrow set it off. */
  explode(point: Vec2, activeEnemies: readonly Foe[], directHit?: Foe | Bowman, power?: number, dragon?: boolean, by?: number): number;
  shatter(enemy: Enemy, fromX: number): void;
  breakIce(bowman: Bowman): void;
  /** A kamikaze's bomb goes off now (CombatSystem.detonate). */
  detonate(kamikaze: Enemy): void;
  /** A MOBA siege kamikaze killed by an explosive arrow: it goes off as a fire dragon does (CombatSystem.siegeBlast). */
  siegeBlast(kamikaze: Enemy): void;
  /** A kamikaze just killed by a blast: its bomb goes off a moment later (the first link of `chain`, else of a new one). */
  lightFuse(kamikaze: Enemy, chain?: number): void;
}


/** Earliest hit of the segment on a bowman (Bowman.getHitBoxes: head, a headshot, and body); the head wins ties. */
export const bowmanHitTest = (start: Vec2, travel: Vec2, bowman: Bowman): BowmanArrowHit | undefined => {
  let best: BowmanArrowHit | undefined;
  bowman.getHitBoxes().forEach(({ bounds, headshot }) => {
    const time = segmentHitTime(start, travel, bounds);
    if (time !== undefined && (!best || time < best.time || (time === best.time && headshot))) {
      best = { bowman, time, headshot };
    }
  });
  return best;
};

/** Earliest hit of the segment on any of the enemy's hit zones; a headshot zone wins ties. */
export const enemyHitTest = (start: Vec2, travel: Vec2, enemy: Foe): EnemyHit | undefined => {
  let best: EnemyHit | undefined;
  foeHitBoxes(enemy).forEach(({ bounds, headshot, leg, part }) => {
    const time = segmentHitTime(start, travel, bounds);
    if (time !== undefined && (!best || time < best.time || (time === best.time && headshot))) {
      best = { enemy, time, headshot, leg, part };
    }
  });
  return best;
};

/** What a player arrow's hit deals (an enemy, or a bowman with friendly fire). */
export const arrowHitDamage = (arrow: Arrow, headshot: boolean): number => {
  if (arrow.owner === MINION_ARROW_OWNER && arrow.shooter) {
    return arrowDamage(arrow, 'bowman') * (headshot ? ARROWS.headshotMultiplier : 1);
  }
  if (arrow.type === 'explosive') {
    return explosionDamage(0);
  }
  // A pinning arrow only scratches (it's about holding them, not hurting them; no headshot bonus).
  if (arrow.type === 'pinning') {
    return rollDamage(PIN_DAMAGE);
  }
  const factor = arrow.type === 'piercing'
    ? Math.pow(ARROWS.piercingMultiplier, arrow.impacts)
    : arrow.type === 'fragment' ? SHRAPNEL_FRAGMENT_DAMAGE : MAGIC_HIT_DAMAGE[arrow.type] ?? 1;
  return rollArrowDamage(headshot) * factor * (arrow.power ?? 1);
};
