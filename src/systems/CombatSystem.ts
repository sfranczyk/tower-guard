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
import type { EnemyEdge } from '../data/difficulty';
import { enemyDamage, explosionDamage, rollDamage } from '../data/enemies';
import { enemyArchetype } from '../data/enemyKinds';
import { burnDamage } from './burning';
import type Bowman from '../objects/bowman/Bowman';
import type { BowmanHit } from './bowmanDeath';
import DragonEnemy from '../objects/dragon/DragonEnemy';
import type Enemy from '../objects/enemy/Enemy';
import type Tower from '../objects/Tower';
import type { EnemyType, Vec2 } from '../types';
import { struckBy } from './lightning';
import { groundAt } from './terrain';
import type { EffectsSystem } from './EffectsSystem';
import { ArrowMagic } from './ArrowMagic';
import { ArrowHits } from './ArrowHits';
import { BOWMAN_CHEST, TOWER_HALF_WIDTH, type Foe } from './combatGeometry';
import { EnemyAI } from './EnemyAI';
import { BombFuses, blastFalloff, bombGoesOff, chainChance } from './kamikazeBomb';

export type { Foe } from './combatGeometry';

/** A kamikaze's blast reaches the bowman and the keep within this many explosion radii. */
const KAMIKAZE_REACH = 1.2;

/** Where a blast stands in a chain of kamikaze bombs: which chain, and its link (kamikazeBomb.chainChance). */
interface ChainStep {
  readonly chain: number;
  readonly link: number;
}

/** A kamikaze's bomb going off: where, whose (its damage), how big (a shaman's spell), where in its chain. */
interface Bomb extends ChainStep {
  readonly point: Vec2;
  readonly kind: EnemyType;
  readonly power: number;
}

export interface CombatWorld {
  /** One bowman per player (co-op: two); enemies go for the nearest one out in the open. */
  readonly bowmen: readonly Bowman[];
  readonly playerTower: Tower;
  readonly enemyTower: Tower;
  readonly enemies: readonly Foe[];
  readonly arrows: readonly Arrow[];
  readonly effects: EffectsSystem;
  readonly debug: Graphics;
  /** The level's wind now (px/s² on a normal arrow; it may change mid-level); enemy archers aim with it. */
  wind(): number;
  /** Friendly fire (settings drawer): the players' arrows and their effects hit the bowmen too. */
  readonly friendlyFire: () => boolean;
  /** More enemies still to come this level (a priest left alone walks off the field only when none are). */
  readonly reinforcementsDue: () => boolean;
  /** The difficulty's edge (data/difficulty.ts): enemy hits × `damage`, enemy archers' aim error × `aimSpread`. */
  readonly enemyEdge: EnemyEdge;
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
  /** Kamikazes killed by a blast: their bombs go off a moment later. */
  private readonly fuses = new BombFuses<Bomb>();
  /** Each chain's id; a dud kamikaze rolls once per chain, so it remembers the chain it fizzled in. */
  private nextChain = 0;
  private readonly duds = new WeakMap<Enemy, number>();

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
      detonate: (kamikaze) => this.detonate(kamikaze),
      lightFuse: (kamikaze, chain) => this.lightFuse(kamikaze, chain === undefined ? this.newChain() : { chain, link: 0 }),
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
    this.fuses.tick(deltaMs).forEach((bomb) => this.blowUp(bomb));
    const activeEnemies = enemiesActive ? this.world.enemies.filter((enemy) => enemy.isAlive()) : [];
    this.ai.beginFrame();
    activeEnemies.forEach((enemy) => this.ai.update(enemy, deltaMs));
    // Burning: steady damage until the burn runs out (each bowman counts it down in his animation); a dragon's fire, so the difficulty's.
    this.world.bowmen
      .filter((bowman) => bowman.isBurning && !bowman.isDead)
      .forEach((bowman) => this.events.bowmanDamaged(bowman, burnDamage(bowman.burnRemainingMs, deltaMs) * this.world.enemyEdge.damage, { cause: 'burn', fromX: bowman.x }));
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
    // A kamikaze's bomb may go off (KAMIKAZE_BOMB.lightningChance); else it dies silently like the rest.
    struckBy(point.x, LIGHTNING_RADIUS, enemies.filter((enemy) => enemy.isAlive() && !enemy.isFlying))
      .forEach((enemy) => {
        if (!(enemy instanceof DragonEnemy) && enemyArchetype(enemy.kind).detonates && bombGoesOff('lightning', enemy.afflictions.isFrozen)) {
          this.detonate(enemy);
        } else {
          enemy.takeDamage(LIGHTNING_DAMAGE, { cause: 'lightning', fromX: point.x });
        }
      });
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

  /** A kamikaze's bomb where it is now (a shaman's spell makes it bigger: further reach, more damage). */
  private static bombOf(kamikaze: Enemy, { chain, link }: ChainStep): Bomb {
    const body = kamikaze.getPhysicsBounds();
    return { point: { x: body.x + body.width / 2, y: body.y + body.height / 2 }, kind: kamikaze.kind, power: kamikaze.buff.blastPower, chain, link };
  }

  /** A kamikaze sets its bomb off now (reaching its target, a fatal fall, fire or lightning): it bursts apart in the blast. */
  private detonate(kamikaze: Enemy): void {
    const bomb = CombatSystem.bombOf(kamikaze, this.newChain());
    kamikaze.takeDamage(Number.MAX_SAFE_INTEGER, { cause: 'blast', fromX: bomb.point.x, point: bomb.point });
    this.blowUp(bomb, kamikaze);
  }

  /** A kamikaze just killed by a blast (not frozen): its bomb (`step` of a chain) goes off where it died, KAMIKAZE_BOMB.chainDelayMs later. */
  private lightFuse(kamikaze: Enemy, step = this.newChain()): void {
    this.fuses.light(CombatSystem.bombOf(kamikaze, step));
  }

  /** The first link of a new chain (a bomb a bowman set off). */
  private newChain(): ChainStep {
    this.nextChain += 1;
    return { chain: this.nextChain, link: 0 };
  }

  /**
   * A kamikaze's bomb goes off: the blast hurts the enemies around it like an explosive arrow (a kamikaze it kills
   * lights its own fuse), and the bowmen (unless in the keep) and the keep take its damage if they're close, less the
   * further they are (blastFalloff); bowmen are thrown back.
   */
  private blowUp({ point, kind, power, chain, link }: Bomb, self?: Enemy): void {
    const { bowmen, playerTower, effects } = this.world;
    // The bowmen take the kamikaze's own blast below, not the arrows' splash; the kamikazes it catches are the chain's next link.
    this.explode(point, this.world.enemies.filter((enemy) => enemy.isAlive()), self, power, false, false, { chain, link: link + 1 });
    const reach = EXPLOSION_RADIUS * KAMIKAZE_REACH * power;
    bowmen.filter((bowman) => !bowman.isInTower && !bowman.isDead).forEach((bowman) => {
      const bowmanDistance = Math.hypot(bowman.x - point.x, bowman.y - BOWMAN_CHEST - point.y);
      if (bowmanDistance > reach) {
        return;
      }
      const damage = rollDamage(enemyDamage(kind, 'melee', 'bowman')) * power * this.world.enemyEdge.damage * blastFalloff(bowmanDistance, reach);
      this.events.bowmanDamaged(bowman, damage, { cause: 'blast', fromX: point.x });
      effects.bloodBurst({ x: bowman.x, y: bowman.y - BOWMAN_CHEST });
      // Thrown away from the blast, harder the closer he stood.
      const { minStrength } = BOWMAN_KNOCKBACK;
      bowman.knockBack(point.x, minStrength + (1 - minStrength) * (1 - bowmanDistance / reach));
    });
    const keepDistance = point.x - (playerTower.x + TOWER_HALF_WIDTH);
    if (keepDistance <= reach) {
      const damage = rollDamage(enemyDamage(kind, 'melee', 'keep')) * power * this.world.enemyEdge.damage * blastFalloff(keepDistance, reach);
      playerTower.takeDamage(damage, { x: playerTower.x + TOWER_HALF_WIDTH - 4, y: point.y });
    }
  }

  /**
   * Explosion visuals plus splash damage and knockback for every living enemy whose body centre is
   * within EXPLOSION_RADIUS (except `directHit`, which already took the blast at its centre); damage falls off with distance.
   * With friendly fire (and `hurtsBowmen`) the bowmen out in the open take it too: the same damage, knocked down
   * away from it, a frozen one's ice broken. Returns the id of the chain of kamikaze bombs it belongs to: `bomb`, a
   * kamikaze bomb's blast, is the next link of its chain; any other blast (an explosive arrow, a fire dragon) starts a new
   * one whose first link is the bomb it hit directly, so the kamikazes it catches are link 1. A kamikaze caught may be a
   * dud (kamikazeBomb.chainChance): knocked down unhurt, its bomb still live; it rolls once per chain, the chain's further
   * blasts only knock it down again; a bomb's blast too weak to kill a kamikaze doesn't hurt it at all.
   */
  private explode(
    point: Vec2, activeEnemies: readonly Foe[], directHit?: Foe | Bowman, power = 1, dragon = false, hurtsBowmen = true,
    bomb?: ChainStep,
  ): number {
    const step = bomb ?? { chain: this.newChain().chain, link: 1 };
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
        const damage = explosionDamage(blastDistance) * power;
        const kamikaze = !(candidate instanceof DragonEnemy) && enemyArchetype(candidate.kind).detonates ? candidate : undefined;
        // A chain's blast that doesn't kill a kamikaze leaves it unhurt (only knocked down): a survivor keeps full health.
        const harmless = kamikaze !== undefined && bomb !== undefined && damage * kamikaze.buff.damageFactor < kamikaze.currentHealth;
        const fizzledHere = kamikaze !== undefined && this.duds.get(kamikaze) === step.chain;
        if (kamikaze && (harmless || fizzledHere || Math.random() >= chainChance(step.link, this.world.enemyEdge.chainFalloff))) {
          kamikaze.takeDamage(0, { cause: 'explosion', fromX: point.x, point, blastDistance });
          if (!harmless && !fizzledHere) {
            this.duds.set(kamikaze, step.chain);
            this.world.effects.fizzle({ x: body.x + body.width / 2, y: body.y + body.height / 2 });
          }
          return;
        }
        candidate.takeDamage(damage, { cause: 'explosion', fromX: point.x, point, blastDistance });
        if (kamikaze && !kamikaze.isAlive()) {
          this.lightFuse(kamikaze, step);
        }
      });
    if (!hurtsBowmen) {
      return step.chain;
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
    return step.chain;
  }

  /** A frozen bowman's ice breaks (a blast, or landing after a vortex threw him): he's free, unhurt by it. */
  private breakIce(bowman: Bowman): void {
    const point = { x: bowman.x, y: bowman.y - BOWMAN_CHEST };
    bowman.afflictions.warm();
    this.world.effects.shatter(point);
    this.events.sound('shrapnelBurst', point);
  }
}
