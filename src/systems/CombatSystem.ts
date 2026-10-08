import type { Graphics } from 'pixi.js';
import {
  BOWMAN_KNOCKBACK,
  EXPLOSION_RADIUS,
  LIGHTNING_DAMAGE,
  LIGHTNING_RADIUS,
  SHOW_HITBOX_DEBUG,
} from '../config';
import type { SoundId } from '../audio/SoundManager';
import type Arrow from '../objects/Arrow';
import { enemyDamage, explosionDamage, rollDamage } from '../data/enemies';
import { burnDamage } from './burning';
import type Bowman from '../objects/Bowman';
import type { BowmanHit } from './bowmanDeath';
import DragonEnemy from '../objects/DragonEnemy';
import type Enemy from '../objects/Enemy';
import type Tower from '../objects/Tower';
import type { EnemyType, Vec2 } from '../types';
import { struckBy } from './lightning';
import { groundAt } from './terrain';
import type { EffectsSystem } from './EffectsSystem';
import { ArrowMagic } from './ArrowMagic';
import { ArrowHits } from './ArrowHits';
import { BOWMAN_CHEST, TOWER_HALF_WIDTH, type Foe } from './combatGeometry';
import { EnemyAI } from './EnemyAI';

export type { Foe } from './combatGeometry';

/** A kamikaze's blast reaches the bowman and the keep within this many explosion radii. */
const KAMIKAZE_REACH = 1.2;

export interface CombatWorld {
  /** One bowman per player (co-op: two); enemies go for the nearest one out in the open. */
  readonly bowmen: readonly Bowman[];
  readonly playerTower: Tower;
  readonly enemyTower: Tower;
  readonly enemies: readonly Foe[];
  readonly arrows: readonly Arrow[];
  readonly effects: EffectsSystem;
  readonly debug: Graphics;
  /** The wave's wind (px/s² on a normal arrow); enemy archers aim with it. */
  readonly wind: number;
  /** Friendly fire (settings drawer): the players' arrows and their effects hit the bowmen too. */
  readonly friendlyFire: () => boolean;
}

export interface CombatEvents {
  /** `hit`: what hurt him and from where (if it kills him, it decides how he falls). */
  bowmanDamaged(bowman: Bowman, amount: number, hit: BowmanHit): void;
  /** `bowman` just caught fire. */
  bowmanIgnited(bowman: Bowman): void;
  headshot(): void;
  /** A sound-worthy impact at a world position (the scene plays it). */
  sound(id: SoundId, at: Vec2): void;
  /** A hostile arrow loosed by `shooter` (its damage depends on who shot it). */
  enemyShot(from: Vec2, angle: number, speed: number, shooter: EnemyType): void;
}

/**
 * One frame of the battle on the host: the enemies (EnemyAI), the fire, frost and vortex arrows (ArrowMagic), the
 * arrows' flight and hits (ArrowHits), and what reaches beyond one target: explosions, a kamikaze going off, a frozen
 * enemy shattering, lightning, and the bowmen's burns.
 */
export class CombatSystem {
  /** The fire, frost and vortex arrows. */
  private readonly magic: ArrowMagic;
  private readonly ai: EnemyAI;
  private readonly hits: ArrowHits;

  public constructor(
    private readonly world: CombatWorld,
    private readonly events: CombatEvents,
  ) {
    const magic = new ArrowMagic(world.effects, {
      detonate: (kamikaze) => this.detonate(kamikaze),
      shatter: (enemy, fromX) => this.shatter(enemy, fromX),
      sound: (id, at) => events.sound(id, at),
      hurtBowman: (bowman, amount, hit) => events.bowmanDamaged(bowman, amount, hit),
      bowmanIgnited: (bowman) => events.bowmanIgnited(bowman),
      breakIce: (bowman) => this.breakIce(bowman),
    });
    this.magic = magic;
    this.ai = new EnemyAI(world, events, { detonate: (kamikaze) => this.detonate(kamikaze) });
    this.hits = new ArrowHits(world, events, magic, {
      explode: (point, activeEnemies, directHit, power, dragon) => this.explode(point, activeEnemies, directHit, power, dragon),
      shatter: (enemy, fromX) => this.shatter(enemy, fromX),
      breakIce: (bowman) => this.breakIce(bowman),
    });
  }

  /** With friendly fire on, the bowmen the players' arrows and their effects can hit (out in the open, alive). */
  private friendlyTargets(): Bowman[] {
    return this.world.friendlyFire() ? this.world.bowmen.filter((bowman) => !bowman.isInTower && !bowman.isDead) : [];
  }

  /** With `enemiesActive` false (debug: enemies hidden) enemies freeze and arrows pass through them. */
  public update(deltaMs: number, enemiesActive = true): void {
    const activeEnemies = enemiesActive ? this.world.enemies.filter((enemy) => enemy.isAlive()) : [];
    activeEnemies.forEach((enemy) => this.ai.update(enemy, deltaMs));
    // Burning: steady damage until the burn runs out (each bowman counts it down in his animation).
    this.world.bowmen
      .filter((bowman) => bowman.isBurning && !bowman.isDead)
      .forEach((bowman) => this.events.bowmanDamaged(bowman, burnDamage(bowman.burnRemainingMs, deltaMs), { cause: 'burn', fromX: bowman.x }));
    if (SHOW_HITBOX_DEBUG) {
      // Cyan: the keeps' silhouettes that arrows hit.
      [this.world.playerTower, this.world.enemyTower].forEach((tower) => tower.hitParts().forEach((part) => {
        this.world.debug.rect(part.left, part.top, part.right - part.left, part.bottom - part.top).stroke({ width: 1, color: 0x55e0ff, alpha: 0.9 });
      }));
    }
    const friendly = this.friendlyTargets();
    this.magic.update(deltaMs, activeEnemies, friendly);
    // Dead enemies finish (then hold) their death animation.
    this.world.enemies.filter((enemy) => !enemy.isAlive()).forEach((enemy) => enemy.updateAnimation(deltaMs, false));

    const { arrows } = this.world;
    arrows.filter((arrow) => arrow.isActive).forEach((arrow) => arrow.update(deltaMs));
    arrows
      .filter((arrow) => arrow.isActive && !arrow.isStuck)
      .forEach((arrow) => (arrow.hostile ? this.hits.resolveHostile(arrow) : this.hits.resolve(arrow, activeEnemies, friendly)));
    // Stuck or gone, an arrow hits nothing more: what it already hit can go.
    arrows.filter((arrow) => !arrow.isActive || arrow.isStuck).forEach((arrow) => this.hits.forget(arrow));
    arrows
      .filter((arrow) => arrow.isActive && !arrow.isStuck && arrow.y >= groundAt(arrow.x) - 3)
      .forEach((arrow) => {
        const point = { x: arrow.x, y: groundAt(arrow.x) - 3 };
        if (arrow.type === 'explosive') {
          this.explode(point, activeEnemies);
          arrow.deactivate();
        } else if (arrow.type === 'vortex') {
          // The rune stone becomes the vortex.
          this.magic.groundImpact(arrow.type, point);
          arrow.deactivate();
        } else {
          arrow.stickToGround(point.y);
          this.magic.groundImpact(arrow.type, point);
        }
      });
  }

  /**
   * A lightning bolt hit the ground at `point`: everyone within LIGHTNING_RADIUS takes LIGHTNING_DAMAGE
   * (enemies are knocked down or killed stiff). The bowman is safe inside the keep.
   */
  public lightningStrike(point: Vec2): void {
    const { bowmen, enemies, effects } = this.world;
    effects.lightningStrike(point);
    // Ground strikes don't reach flying dragons.
    struckBy(point.x, LIGHTNING_RADIUS, enemies.filter((enemy) => enemy.isAlive() && !enemy.isFlying))
      .forEach((enemy) => enemy.takeDamage(LIGHTNING_DAMAGE, { cause: 'lightning', fromX: point.x }));
    struckBy(point.x, LIGHTNING_RADIUS, bowmen.filter((bowman) => !bowman.isInTower && !bowman.isDead))
      .forEach((bowman) => this.events.bowmanDamaged(bowman, LIGHTNING_DAMAGE, { cause: 'lightning', fromX: point.x }));
  }

  /** A frozen enemy is killed: it bursts into pieces of ice. */
  private shatter(enemy: Enemy, fromX: number): void {
    const body = enemy.getPhysicsBounds();
    const point = { x: body.x + body.width / 2, y: body.y + body.height / 2 };
    this.world.effects.shatter(point);
    this.events.sound('shrapnelBurst', point);
    enemy.takeDamage(Number.MAX_SAFE_INTEGER, { cause: 'shatter', fromX, point });
  }

  /**
   * A kamikaze blows up: it bursts apart, the blast hurts the enemies around it like an explosive arrow,
   * and the bowmen (unless in the keep) and the keep take its damage if they're close; bowmen are thrown back.
   */
  private detonate(kamikaze: Enemy): void {
    const { bowmen, playerTower, effects } = this.world;
    const body = kamikaze.getPhysicsBounds();
    const point = { x: body.x + body.width / 2, y: body.y + body.height / 2 };
    kamikaze.takeDamage(Number.MAX_SAFE_INTEGER, { cause: 'blast', fromX: point.x, point });
    // The bowmen take the kamikaze's own blast below, not the arrows' splash.
    this.explode(point, this.world.enemies.filter((enemy) => enemy.isAlive()), kamikaze, 1, false, false);
    const reach = EXPLOSION_RADIUS * KAMIKAZE_REACH;
    bowmen.filter((bowman) => !bowman.isInTower && !bowman.isDead).forEach((bowman) => {
      const bowmanDistance = Math.hypot(bowman.x - point.x, bowman.y - BOWMAN_CHEST - point.y);
      if (bowmanDistance > reach) {
        return;
      }
      this.events.bowmanDamaged(bowman, rollDamage(enemyDamage('kamikaze', 'melee', 'bowman')), { cause: 'blast', fromX: point.x });
      effects.bloodBurst({ x: bowman.x, y: bowman.y - BOWMAN_CHEST });
      // Thrown away from the blast, harder the closer he stood.
      const { minStrength } = BOWMAN_KNOCKBACK;
      bowman.knockBack(point.x, minStrength + (1 - minStrength) * (1 - bowmanDistance / reach));
    });
    if (point.x - (playerTower.x + TOWER_HALF_WIDTH) <= reach) {
      playerTower.takeDamage(rollDamage(enemyDamage('kamikaze', 'melee', 'keep')), { x: playerTower.x + TOWER_HALF_WIDTH - 4, y: point.y });
    }
  }

  /**
   * Explosion visuals plus splash damage and knockback for every living enemy whose body centre is
   * within EXPLOSION_RADIUS (except `directHit`, which already took the blast at its centre); damage falls off with distance.
   * With friendly fire (and `hurtsBowmen`) the bowmen out in the open take it too: the same damage, knocked down
   * away from it, a frozen one's ice broken.
   */
  private explode(point: Vec2, activeEnemies: readonly Foe[], directHit?: Foe | Bowman, power = 1, dragon = false, hurtsBowmen = true): void {
    if (dragon) {
      this.world.effects.dragonBlast(point);
    } else {
      this.world.effects.explosion(point, power);
    }
    this.events.sound('explosion', point);
    // `power` scales both the reach and the damage (a fire dragon blowing up: FIRE_DRAGON_BLAST_POWER).
    const radius = EXPLOSION_RADIUS * power;
    activeEnemies
      .filter((candidate) => candidate !== directHit && candidate.isAlive())
      .forEach((candidate) => {
        const body = candidate.getPhysicsBounds();
        const dx = body.x + body.width / 2 - point.x;
        const dy = body.y + body.height / 2 - point.y;
        if (Math.hypot(dx, dy) > radius) {
          return;
        }
        // Frozen solid, it can't take a blast: it shatters.
        if (!(candidate instanceof DragonEnemy) && candidate.afflictions.isFrozen) {
          this.shatter(candidate, point.x);
          return;
        }
        // Survivors are knocked down away from the blast and get back up; the rest die thrown back.
        const blastDistance = Math.hypot(dx, dy) / radius;
        candidate.takeDamage(explosionDamage(blastDistance) * power, { cause: 'explosion', fromX: point.x, point, blastDistance });
      });
    if (!hurtsBowmen) {
      return;
    }
    this.friendlyTargets()
      .filter((bowman) => bowman !== directHit)
      .forEach((bowman) => {
        const distance = Math.hypot(bowman.x - point.x, bowman.y - BOWMAN_CHEST - point.y);
        if (distance > radius) {
          return;
        }
        if (bowman.isFrozen) {
          this.breakIce(bowman);
        }
        const blastDistance = distance / radius;
        this.events.bowmanDamaged(bowman, explosionDamage(blastDistance) * power, { cause: 'blast', fromX: point.x });
        this.world.effects.bloodBurst({ x: bowman.x, y: bowman.y - BOWMAN_CHEST });
        bowman.knockBack(point.x, 1 - blastDistance);
      });
  }

  /** A frozen bowman's ice breaks (a blast, or landing after a vortex threw him): he's free, unhurt by it. */
  private breakIce(bowman: Bowman): void {
    const point = { x: bowman.x, y: bowman.y - BOWMAN_CHEST };
    bowman.afflictions.warm();
    this.world.effects.shatter(point);
    this.events.sound('shrapnelBurst', point);
  }
}
