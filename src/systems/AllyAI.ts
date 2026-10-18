import type { Graphics } from 'pixi.js';
import { ALLIES, MEDIC, PLAYER_TOWER_X, PRIEST_POST_SLACK, SHOW_HITBOX_DEBUG } from '../config';
import { enemyDamage, rollDamage } from '../data/enemies';
import { enemyArchetype, enemyArmor, enemyTraits } from '../data/enemyKinds';
import type Bowman from '../objects/bowman/Bowman';
import DragonEnemy from '../objects/dragon/DragonEnemy';
import type Enemy from '../objects/enemy/Enemy';
import type { Vec2 } from '../types';
import { escortPost, orderPost, pickFoe, type AllyOrder } from './allyOrders';
import { bannerHomeX, type Banners } from './banners';
import { foeHitBoxes, type Foe } from './combatGeometry';
import type { EffectsSystem } from './EffectsSystem';
import { bandageHeal, pickPatient } from './bandaging';
import { priestPost } from './healing';
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
  /** Banners (systems/banners.ts): on Advance they take the enemy's, bring it home under escort and go for ours. */
  readonly banners?: Banners<Enemy>;
}

export interface AllyAIEvents {
  /** `bowman`'s health and his full health (the medic bandages him too). */
  bowmanHealth(bowman: Bowman): { health: number; max: number };
  bowmanHealed(bowman: Bowman, amount: number): void;
}

/** Someone the medic tends: a soldier or a bowman, read live. */
interface Patient {
  who: Enemy | Bowman;
  bowman: boolean;
  x(): number;
  alive(): boolean;
  missing(): number;
  ratio(): number;
  heal(amount: number): void;
  chest(): Vec2;
}

interface MedicState {
  patient?: Patient;
  /** Rest after a bandage (ms left). */
  restMs: number;
  /** How long this bandage has gone on (0: not started). */
  bandagedMs: number;
  /** Until the next red cross rises from the patient. */
  crossMs: number;
}

/** A red cross rises from the patient this often while she bandages him. */
const CROSS_EVERY_MS = 900;

/**
 * What the player's soldiers do each frame (CombatSystem calls `update` for each living one): fighters go for the
 * nearest enemy their order lets them fight (systems/allyOrders.ts) and strike it in reach, else walk to their post;
 * the medic bandages one wounded soldier or bowman at a time (systems/bandaging.ts). They never strike the dragons.
 */
export class AllyAI {
  /** Each medic's patient and clocks. */
  private readonly medics = new WeakMap<Enemy, MedicState>();

  public constructor(private readonly world: AllyAIWorld, private readonly events: AllyAIEvents) {}

  public update(ally: Enemy, deltaMs: number): void {
    if (ally.isCelebrating) {
      ally.updateAnimation(deltaMs, false);
      return;
    }
    if (enemyArchetype(ally.kind).bandages) {
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
    const { banners } = this.world;
    const goal = banners?.carriedBy(ally) ? PLAYER_TOWER_X : banners?.fetchX(ally);
    if (goal !== undefined) {
      this.walkOnGuard(ally, goal, deltaMs);
      return;
    }
    const rank = Math.max(0, this.rankOf(ally));
    let order = this.world.allyOrder();
    let post = orderPost(order, rank);
    const bearer = banners?.bearer('player');
    if (bearer) {
      // A comrade carries a banner home: the others walk with him, between him and the enemy.
      order = 'hold';
      post = escortPost(bearer.x, rank);
    } else if (banners && order === 'advance' && banners.place('enemy').at === 'home') {
      post = bannerHomeX('enemy') - rank * ALLIES.spacing;
    }
    const foes = this.groundFoes();
    const pick = pickFoe(ally.x, post, order, foes.map((foe) => foe.x), IN_REACH);
    // An enemy carrying our banner off comes first.
    const foe = banners?.thief('player') ?? (pick === undefined ? undefined : foes[pick]);
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
   * Banners: walks to `goalX` (home with a banner, or to a fallen one) fighting only in defence: an enemy within reach
   * stops him, and he strikes it standing where he is.
   */
  private walkOnGuard(ally: Enemy, goalX: number, deltaMs: number): void {
    const foe = this.groundFoes()
      .filter((candidate) => Math.abs(candidate.x - ally.x) <= IN_REACH)
      .reduce<Enemy | undefined>((best, candidate) => (!best || Math.abs(candidate.x - ally.x) < Math.abs(best.x - ally.x) ? candidate : best), undefined);
    const toX = foe ? ally.x : goalX;
    ally.update(deltaMs, { x: toX, y: groundAt(toX) }, 2);
    ally.updateAnimation(deltaMs, ally.isMoving());
    if (!foe || ally.isDown || ally.afflictions.isFrozen || ally.afflictions.inVortex || !ally.canAttack()) {
      return;
    }
    ally.faceTowards(foe.x);
    ally.playAttackAnimation(() => {
      if (foe.isAlive() && Math.abs(ally.x - foe.x) <= ally.strikeReach) {
        meleeBlow(foe, rollDamage(enemyDamage(ally.kind, 'melee', 'bowman')), ally.x, this.world.effects);
      }
    });
  }

  /**
   * Medic: rests `MEDIC.restMs` after each bandage; else picks one patient (pickPatient: the bowman first when badly
   * hurt, else the lowest share of health), walks up beside him on the keep's side and, once there, kneels and bandages:
   * `MEDIC.healPerSecond` for up to `MEDIC.bandageMs`, crosses rising from him. A hit on her, the patient walking off,
   * dying, hiding in the keep or healed full ends it. With nobody to tend she keeps behind the front (priestPost).
   */
  private updateMedic(medic: Enemy, deltaMs: number): void {
    const state = this.medics.get(medic) ?? { restMs: 0, bandagedMs: 0, crossMs: 0 };
    this.medics.set(medic, state);
    state.restMs = Math.max(0, state.restMs - deltaMs);
    const helpless = medic.isDown || medic.afflictions.isFrozen || medic.afflictions.inVortex;
    if (state.patient && (!this.stillWounded(state.patient) || (state.bandagedMs > 0 && !medic.isBandaging) || helpless)) {
      this.endBandage(medic, state);
    }
    if (!state.patient && state.restMs <= 0 && !helpless) {
      state.patient = this.choosePatient(medic);
    }
    const patient = state.patient;
    if (!patient) {
      this.keepBehindFront(medic, deltaMs);
      return;
    }
    const at = patient.x();
    const besideX = at - MEDIC.reach;
    if (!medic.isBandaging) {
      medic.update(deltaMs, { x: besideX, y: groundAt(besideX) }, 3);
      medic.updateAnimation(deltaMs, medic.isMoving());
      if (Math.abs(medic.x - besideX) <= 3 && !helpless) {
        medic.faceTowards(at);
        medic.startBandage();
        state.bandagedMs = 0.001;
      }
      return;
    }
    medic.update(deltaMs, { x: medic.x, y: medic.y }, 1);
    medic.updateAnimation(deltaMs, false);
    if (!medic.isKneeling || medic.isDown) {
      return;
    }
    if (Math.abs(at - medic.x) > MEDIC.reach + 14) {
      // He walked off: she gets up and follows him.
      medic.stopBandage();
      state.bandagedMs = 0;
      return;
    }
    // Healing starts once she is down by him.
    const amount = bandageHeal(deltaMs, patient.missing());
    if (amount > 0) {
      patient.heal(amount);
    }
    state.bandagedMs += deltaMs;
    state.crossMs -= deltaMs;
    if (state.crossMs <= 0) {
      state.crossMs = CROSS_EVERY_MS;
      this.world.effects.healCrosses(patient.chest());
    }
    if (state.bandagedMs >= MEDIC.bandageMs || patient.missing() <= 0) {
      this.endBandage(medic, state);
    }
  }

  private endBandage(medic: Enemy, state: MedicState): void {
    if (state.bandagedMs > 0) {
      state.restMs = MEDIC.restMs;
    }
    state.patient = undefined;
    state.bandagedMs = 0;
    medic.stopBandage();
  }

  private stillWounded(patient: Patient): boolean {
    return patient.alive() && patient.missing() > 0;
  }

  /** The wounded soldiers (not herself, not one another medic already tends) and bowmen out of the keep. */
  private choosePatient(medic: Enemy): Patient | undefined {
    const tended = new Set([...this.medicsTending()].filter((other) => other.medic !== medic).map((other) => other.who));
    const soldiers: Patient[] = this.world.allies
      .filter((other) => other !== medic && other.isAlive() && enemyTraits(other.kind).healable && !tended.has(other))
      .map((other) => ({
        who: other, bowman: false, x: () => other.x, alive: () => other.isAlive(), missing: () => other.missingHealth,
        ratio: () => other.getHealthRatio(), heal: (amount) => other.heal(amount), chest: () => chest(other),
      }));
    const bowmen: Patient[] = this.world.bowmen
      .filter((bowman) => !bowman.isDead && !bowman.isInTower && !tended.has(bowman))
      .map((bowman) => {
        const health = (): { health: number; max: number } => this.events.bowmanHealth(bowman);
        return {
          who: bowman, bowman: true, x: () => bowman.x, alive: () => !bowman.isDead && !bowman.isInTower,
          missing: () => Math.max(0, health().max - health().health), ratio: () => health().health / Math.max(1, health().max),
          heal: (amount) => this.events.bowmanHealed(bowman, amount), chest: () => chest(bowman),
        };
      });
    const all = [...soldiers, ...bowmen];
    const pick = pickPatient(all.map((patient) => ({ missing: patient.missing(), ratio: patient.ratio(), bowman: patient.bowman })));
    return pick === undefined ? undefined : all[pick];
  }

  private *medicsTending(): Iterable<{ medic: Enemy; who: unknown }> {
    for (const medic of this.world.allies) {
      const patient = this.medics.get(medic)?.patient;
      if (patient && medic.isAlive()) {
        yield { medic, who: patient.who };
      }
    }
  }

  /** Nobody to tend: `PRIEST_FOLLOW_GAP` behind the front of the soldiers and bowmen, facing the nearest enemy. */
  private keepBehindFront(medic: Enemy, deltaMs: number): void {
    const fighters = this.world.allies.filter((other) => other !== medic && other.isAlive() && !enemyArchetype(other.kind).bandages).map((other) => other.x);
    const bowmen = this.world.bowmen.filter((bowman) => !bowman.isDead && !bowman.isInTower).map((bowman) => bowman.x);
    const front = Math.max(ALLIES.retreatX, ...fighters, ...bowmen);
    const foes = this.groundFoes();
    const nearestFoe = foes.reduce<number | undefined>((best, foe) => (best === undefined || Math.abs(foe.x - front) < Math.abs(best - front) ? foe.x : best), undefined);
    const post = priestPost(medic.x, [...fighters, ...bowmen], nearestFoe ?? front + ALLIES.engageRange, ALLIES.retreatX);
    medic.update(deltaMs, { x: post, y: groundAt(post) }, PRIEST_POST_SLACK);
    medic.updateAnimation(deltaMs, medic.isMoving());
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
