import type { Graphics } from 'pixi.js';
import { ALLIES, PRIEST_POST_SLACK, SHOW_HITBOX_DEBUG } from '../config';
import { enemyDamage, rollDamage } from '../data/enemies';
import { enemyArchetype, enemyArmor, enemyTraits } from '../data/enemyKinds';
import type Bowman from '../objects/bowman/Bowman';
import DragonEnemy from '../objects/dragon/DragonEnemy';
import type Enemy from '../objects/enemy/Enemy';
import type { Vec2 } from '../types';
import { orderPost, pickFoe, type AllyOrder } from './allyOrders';
import { foeHitBoxes, type Foe } from './combatGeometry';
import type { EffectsSystem } from './EffectsSystem';
import { planHeals, priestPost } from './healing';
import { groundAt } from './terrain';

/** How close a soldier comes to the enemy he fights (as EnemyAI's MELEE_REACH), and how close counts as "in reach". */
const ALLY_MELEE_REACH = 25;
const IN_REACH = 40;
/** Where a heal goes from and to: the chest. */
const chest = (body: { x: number; y: number; size?: number }): Vec2 => ({ x: body.x, y: body.y - 25 * (body.size ?? 1) });

/**
 * One stickman's blow on another (a soldier on an enemy, or an enemy on a soldier): plate (`armor`) turns most of it
 * with sparks, else blood; it reacts like an arrow's hit (cause 'melee').
 */
export const meleeBlow = (victim: Enemy, damage: number, fromX: number, effects: EffectsSystem): void => {
  const armor = enemyArmor(victim.kind);
  const point = { x: victim.x, y: victim.y - 22 * victim.size };
  if (armor < 1) {
    effects.impact(point);
  } else {
    effects.bloodBurst(point, victim.bodyColors);
  }
  victim.takeDamage(damage * armor, { cause: 'melee', fromX });
};

export interface AllyAIWorld {
  readonly allies: readonly Enemy[];
  readonly enemies: readonly Foe[];
  readonly bowmen: readonly Bowman[];
  readonly effects: EffectsSystem;
  readonly debug: Graphics;
  /** What the soldiers are told now (scenes/BattleAllies.ts). */
  allyOrder(): AllyOrder;
}

export interface AllyAIEvents {
  /** How much health `bowman` is missing (the medic heals him too). */
  bowmanMissing(bowman: Bowman): number;
  bowmanHealed(bowman: Bowman, amount: number): void;
}

/**
 * What the player's soldiers do each frame (CombatSystem calls `update` for each living one): fighters go for the
 * nearest enemy their order lets them fight (systems/allyOrders.ts) and strike it in reach, else walk to their post;
 * the medic keeps behind the front soldier and heals the soldiers and the bowmen around it (like the dark priest:
 * systems/healing.ts). They never strike the dragons.
 */
export class AllyAI {
  public constructor(private readonly world: AllyAIWorld, private readonly events: AllyAIEvents) {}

  public update(ally: Enemy, deltaMs: number): void {
    if (ally.isCelebrating) {
      ally.updateAnimation(deltaMs, false);
      return;
    }
    if (enemyArchetype(ally.kind).heals) {
      this.updateMedic(ally, deltaMs);
    } else {
      this.updateFighter(ally, deltaMs);
    }
    this.drawDebugHitboxes(ally);
    ally.clearHitTint();
  }

  /** The enemies a soldier can reach on foot: alive and on the ground. */
  private groundFoes(): Enemy[] {
    return this.world.enemies.filter((foe): foe is Enemy => !(foe instanceof DragonEnemy) && foe.isAlive());
  }

  /** Fighters in the list's order of the living: the first is the front rank. */
  private rankOf(ally: Enemy): number {
    return this.world.allies.filter((other) => other.isAlive() && other.kind === ally.kind).indexOf(ally);
  }

  private updateFighter(ally: Enemy, deltaMs: number): void {
    const order = this.world.allyOrder();
    const post = orderPost(order, Math.max(0, this.rankOf(ally)));
    const foes = this.groundFoes();
    const pick = pickFoe(ally.x, post, order, foes.map((foe) => foe.x), IN_REACH);
    const foe = pick === undefined ? undefined : foes[pick];
    if (foe) {
      ally.update(deltaMs, { x: foe.x, y: groundAt(foe.x) }, ALLY_MELEE_REACH);
    } else {
      ally.update(deltaMs, { x: post, y: groundAt(post) }, 2);
    }
    ally.updateAnimation(deltaMs, ally.isMoving());
    if (!foe && !ally.isMoving() && !ally.isDown && !ally.isAttacking) {
      // At his post: faces the enemy's side.
      ally.faceTowards(ally.x + 1);
    }
    if (!foe || ally.isDown || ally.afflictions.isFrozen || ally.afflictions.inVortex) {
      return;
    }
    if (Math.abs(ally.x - foe.x) <= IN_REACH && ally.canAttack()) {
      ally.faceTowards(foe.x);
      // The blow lands with the sword: an enemy that got beyond its reach meanwhile is missed.
      ally.playAttackAnimation(() => {
        if (foe.isAlive() && Math.abs(ally.x - foe.x) <= ally.strikeReach) {
          meleeBlow(foe, rollDamage(enemyDamage(ally.kind, 'melee', 'bowman')), ally.x, this.world.effects);
        }
      });
    }
  }

  /**
   * Medic: keeps `PRIEST_FOLLOW_GAP` behind the front of the soldiers (and the bowmen out in the open) facing the
   * nearest enemy, never nearer it than `PRIEST_STANDOFF` (priestPost); with nobody to follow it falls back to
   * `ALLIES.retreatX`. Heals when its mana allows.
   */
  private updateMedic(medic: Enemy, deltaMs: number): void {
    medic.updateMana(deltaMs);
    const fighters = this.world.allies.filter((other) => other !== medic && other.isAlive() && !enemyArchetype(other.kind).heals).map((other) => other.x);
    const bowmen = this.world.bowmen.filter((bowman) => !bowman.isDead && !bowman.isInTower).map((bowman) => bowman.x);
    const foes = this.groundFoes();
    const front = Math.max(ALLIES.retreatX, ...fighters, ...bowmen);
    const nearestFoe = foes.reduce<number | undefined>((best, foe) => (best === undefined || Math.abs(foe.x - front) < Math.abs(best - front) ? foe.x : best), undefined);
    const post = priestPost(medic.x, [...fighters, ...bowmen], nearestFoe ?? front + ALLIES.engageRange, ALLIES.retreatX);
    medic.update(deltaMs, { x: post, y: groundAt(post) }, PRIEST_POST_SLACK);
    medic.updateAnimation(deltaMs, medic.isMoving());
    if (medic.isDown || medic.afflictions.isFrozen || medic.afflictions.inVortex) {
      // Knocked down, thrown, frozen or in a vortex: a cast under way is lost (its mana too).
      medic.actions.interrupt();
      return;
    }
    this.castHeal(medic);
  }

  /** As the priest's cast (EnemyAI.castHeal): mana goes now, the heals land when it ends, crosses rise from each one. */
  private castHeal(medic: Enemy): void {
    const { mana } = medic;
    if (!mana?.canCast || medic.isCasting || medic.isAttacking) {
      return;
    }
    const spent = this.planHeals(medic, mana.mana).reduce((sum, { amount }) => sum + amount, 0);
    if (spent === 0) {
      return;
    }
    mana.spend(spent);
    medic.castHeal(() => {
      const heals = this.planHeals(medic, spent);
      if (heals.length === 0) {
        return;
      }
      this.world.effects.healPulse({ x: medic.x, y: medic.y });
      heals.forEach(({ heal, at, amount }) => {
        heal(amount);
        this.world.effects.healCrosses(at);
      });
    });
  }

  /** Who a cast with `mana` heals now: the wounded soldiers (not itself) and bowmen out in the open, nearest first. */
  private planHeals(medic: Enemy, mana: number): { heal(amount: number): void; at: Vec2; amount: number }[] {
    const soldiers = this.world.allies
      .filter((other) => other !== medic && other.isAlive() && other.missingHealth > 0 && enemyTraits(other.kind).healable)
      .map((other) => ({ at: chest(other), missing: other.missingHealth, heal: (amount: number) => other.heal(amount) }));
    const bowmen = this.world.bowmen
      .filter((bowman) => !bowman.isDead && !bowman.isInTower && this.events.bowmanMissing(bowman) > 0)
      .map((bowman) => ({ at: chest(bowman), missing: this.events.bowmanMissing(bowman), heal: (amount: number) => this.events.bowmanHealed(bowman, amount) }));
    const wounded = [...soldiers, ...bowmen];
    return planHeals(chest(medic), wounded, mana).map(({ index, amount }) => ({ heal: wounded[index].heal, at: wounded[index].at, amount }));
  }

  private drawDebugHitboxes(ally: Enemy): void {
    if (!SHOW_HITBOX_DEBUG) {
      return;
    }
    // Green: the soldiers' hit zones (yellow-green the head).
    foeHitBoxes(ally).forEach(({ bounds, headshot }) => {
      this.world.debug.rect(bounds.x, bounds.y, bounds.width, bounds.height).stroke({ width: 1, color: headshot ? 0xc8f03f : 0x55d066, alpha: 0.9 });
    });
  }
}
