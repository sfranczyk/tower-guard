import type { Graphics } from 'pixi.js';
import {
  BOWMAN_Y,
  DRAGON_RANGE,
  ENEMY_ARCHER_RANGE,
  ENEMY_ARCHER_SPREAD,
  ENEMY_ARROW_POWER,
  ENEMY_TOWER_DAMAGE,
  EXPLOSION_DAMAGE,
  EXPLOSION_RADIUS,
  GROUND_Y,
  HEADSHOT_DAMAGE_MULTIPLIER,
  LIGHTNING_DAMAGE,
  LIGHTNING_RADIUS,
  PIERCING_DAMAGE_MULTIPLIER,
  PROJECTILE_DAMAGE,
  SHOW_HITBOX_DEBUG,
  SHRAPNEL_FRAGMENT_DAMAGE,
} from '../config';
import type { SoundId } from '../audio/SoundManager';
import Arrow from '../objects/Arrow';
import { ENEMY_DAMAGE, rollDamage, type EnemyDamage } from '../data/enemies';
import { bowSpeed } from '../data/projectiles';
import type Bowman from '../objects/Bowman';
import DragonEnemy, { type HitBox } from '../objects/DragonEnemy';
import type Enemy from '../objects/Enemy';
import { TOWER_HEIGHT } from '../objects/Tower';
import type Tower from '../objects/Tower';
import type { EnemyType, Vec2 } from '../types';
import { solveLaunchAngle } from './ballistics';
import { segmentHitTime } from './collision';
import { struckBy } from './lightning';
import { groundAt } from './terrain';
import type { EffectsSystem } from './EffectsSystem';

const MELEE_REACH = 25;
const TOWER_ATTACK_REACH = 40;
const TOWER_HALF_WIDTH = 48;
const PIERCING_MAX_IMPACTS = 5;
/** Bowman hit box (feet at bowman.y) and where enemy archers aim on him. */
const BOWMAN_HALF_WIDTH = 7;
const BOWMAN_HEIGHT = 40;
const BOWMAN_CHEST = 22;
/** Enemy archers re-solve their aim this often (the solver simulates many trajectories). */
const ARCHER_AIM_REFRESH_MS = 250;
/** A kamikaze's blast reaches the bowman and the keep within this many explosion radii. */
const KAMIKAZE_REACH = 1.2;

export interface CombatWorld {
  readonly bowman: Bowman;
  readonly playerTower: Tower;
  readonly enemyTower: Tower;
  readonly enemies: readonly Foe[];
  readonly arrows: readonly Arrow[];
  readonly effects: EffectsSystem;
  readonly debug: Graphics;
  /** The wave's wind (px/s² on a normal arrow); enemy archers aim with it. */
  readonly wind: number;
}

export interface CombatEvents {
  bowmanDamaged(amount: number): void;
  headshot(): void;
  /** A sound-worthy impact at a world position (the scene plays it). */
  sound(id: SoundId, at: Vec2): void;
  /** An enemy archer looses an arrow. */
  /** A hostile arrow loosed by `shooter` (its damage depends on who shot it). */
  enemyShot(from: Vec2, angle: number, speed: number, shooter: EnemyType): void;
}

interface EnemyHit {
  enemy: Foe;
  time: number;
  headshot: boolean;
}


/** Damage of a hostile arrow by who shot it (archer arrows if unknown). */
const arrowDamage = (shooter: EnemyType | undefined): NonNullable<EnemyDamage['arrow']> =>
  ENEMY_DAMAGE[shooter ?? 'archer'].arrow ?? ENEMY_DAMAGE.archer.arrow!;

const pointAlong = (start: Vec2, travel: Vec2, time: number): Vec2 => ({
  x: start.x + travel.x * time,
  y: start.y + travel.y * time,
});

/** A ground enemy (stickman) or a flying dragon archer. */
export type Foe = Enemy | DragonEnemy;

/** Enemy movement and melee attacks, arrow flight and every arrow hit (enemies and enemy tower). */
export class CombatSystem {
  /** Enemies the bowman has jumped over; they no longer hit him. */
  /** Enemies each arrow has already hit, so piercing arrows hit each enemy once. */
  private readonly arrowHits = new Map<Arrow, Set<Foe>>();
  /** Cached aim per enemy archer. */
  private readonly archerAim = new Map<Foe, { angle: number; ageMs: number }>();

  public constructor(
    private readonly world: CombatWorld,
    private readonly events: CombatEvents,
  ) {}

  /** With `enemiesActive` false (debug: enemies hidden) enemies freeze and arrows pass through them. */
  public update(deltaMs: number, enemiesActive = true): void {
    const activeEnemies = enemiesActive ? this.world.enemies.filter((enemy) => enemy.isAlive()) : [];
    activeEnemies.forEach((enemy) => this.updateEnemy(enemy, deltaMs));
    // Dead enemies finish (then hold) their death animation.
    this.world.enemies.filter((enemy) => !enemy.isAlive()).forEach((enemy) => enemy.updateAnimation(deltaMs, false));

    const { arrows } = this.world;
    arrows.filter((arrow) => arrow.isActive).forEach((arrow) => arrow.update(deltaMs));
    arrows
      .filter((arrow) => arrow.isActive && !arrow.isStuck)
      .forEach((arrow) => (arrow.hostile ? this.resolveHostileArrow(arrow) : this.resolveArrow(arrow, activeEnemies)));
    arrows
      .filter((arrow) => arrow.isActive && !arrow.isStuck && arrow.y >= groundAt(arrow.x) - 3)
      .forEach((arrow) => {
        if (arrow.type === 'explosive') {
          this.explode({ x: arrow.x, y: groundAt(arrow.x) - 3 }, activeEnemies);
          arrow.deactivate();
        } else {
          arrow.stickToGround(groundAt(arrow.x) - 3);
        }
      });
  }

  private updateEnemy(enemy: Foe, deltaMs: number): void {
    if (enemy.isCelebrating) {
      enemy.updateAnimation(deltaMs, false);
      this.drawDebugHitboxes(enemy);
      return;
    }
    if (enemy instanceof DragonEnemy) {
      this.updateDragon(enemy, deltaMs);
      this.drawDebugHitboxes(enemy);
      return;
    }
    if (enemy.isArcher) {
      this.updateArcher(enemy, deltaMs);
      this.drawDebugHitboxes(enemy);
      return;
    }
    const { bowman, playerTower } = this.world;
    enemy.target = bowman.isInTower ? 'tower' : 'bowman';
    const bowmanBehindEnemy = enemy.target === 'bowman' && bowman.x > enemy.x + MELEE_REACH;
    const targetPosition = enemy.target === 'bowman'
      ? { x: bowmanBehindEnemy ? enemy.x + 100 : bowman.x, y: BOWMAN_Y }
      : { x: playerTower.x, y: GROUND_Y };

    enemy.update(deltaMs, targetPosition, enemy.target === 'tower' ? TOWER_ATTACK_REACH : MELEE_REACH);
    enemy.updateAnimation(deltaMs, enemy.isMoving());
    this.drawDebugHitboxes(enemy);

    // Knocked down by an explosion: no moving or attacking until it gets back up.
    if (enemy.isDown) {
      return;
    }

    // Kamikaze: no swing, it blows itself up on reaching the bowman (jumping doesn't help) or the keep.
    if (enemy.kind === 'kamikaze') {
      const atKeep = enemy.target === 'tower' && enemy.x <= playerTower.x + TOWER_ATTACK_REACH;
      const atBowman = enemy.target === 'bowman' && !bowman.isDead && Math.abs(enemy.x - bowman.x) <= MELEE_REACH && Math.abs(enemy.y - bowman.y) <= 60;
      if (atKeep || atBowman) {
        this.detonate(enemy);
      }
      return;
    }

    if (enemy.target === 'tower') {
      if (enemy.x <= playerTower.x + TOWER_ATTACK_REACH && enemy.canAttack()) {
        // The keep takes the hit when the club lands, with a chip of stone flying off the wall.
        enemy.playAttackAnimation(() => {
          playerTower.takeDamage(rollDamage(ENEMY_DAMAGE[enemy.kind].melee.keep));
          this.world.effects.impact({ x: playerTower.x + TOWER_HALF_WIDTH - 4, y: enemy.y - 30 * enemy.scale.y });
        });
      }
      return;
    }

    // No swing at a bowman who is in the air; once he lands in reach, the enemy swings again.
    const overlapsBowman = Math.abs(enemy.x - bowman.x) <= MELEE_REACH;
    const bowmanAirborne = bowman.y < groundAt(bowman.x) - 20;
    if (!bowman.isInTower && !bowman.isDead && !bowmanAirborne && overlapsBowman && Math.abs(enemy.y - bowman.y) <= 45) {
      if (enemy.canAttack()) {
        // Damage lands with the club: to dodge, the bowman has to get beyond this enemy's strike reach
        // (or into the keep) before it lands; jumping on the spot doesn't help.
        enemy.playAttackAnimation(() => {
          const stillInReach = Math.abs(enemy.x - bowman.x) <= enemy.strikeReach && Math.abs(enemy.y - bowman.y) <= 45 * enemy.size;
          if (stillInReach && !bowman.isInTower && !bowman.isDead) {
            this.events.bowmanDamaged(rollDamage(ENEMY_DAMAGE[enemy.kind].melee.bowman));
            this.world.effects.bloodBurst({ x: bowman.x, y: bowman.y - 20 });
          }
        });
      }
    }

    enemy.clearHitTint();
  }

  private drawDebugHitboxes(enemy: Foe): void {
    if (!SHOW_HITBOX_DEBUG) {
      return;
    }
    const { debug } = this.world;
    // Yellow: headshot zones, red: normal hits.
    CombatSystem.hitBoxes(enemy).forEach(({ bounds, headshot }) => {
      debug.rect(bounds.x, bounds.y, bounds.width, bounds.height).stroke({ width: 1, color: headshot ? 0xffd23f : 0xff5555, alpha: 0.9 });
    });
  }

  /**
   * Enemy archer: walk until the bowman (or the keep, if he's hiding in it) is in range, then stop,
   * aim with the real ballistics and shoot with a little spread.
   */
  private updateArcher(enemy: Enemy, deltaMs: number): void {
    const { bowman, playerTower } = this.world;
    const aimPoint = bowman.isInTower
      ? { x: playerTower.x, y: GROUND_Y - TOWER_HEIGHT * 0.55 }
      : { x: bowman.x, y: bowman.y - BOWMAN_CHEST };
    const inRange = Math.abs(aimPoint.x - enemy.x) <= ENEMY_ARCHER_RANGE;

    if (enemy.isDown || !inRange) {
      enemy.update(deltaMs, { x: aimPoint.x, y: GROUND_Y }, 0);
      enemy.relaxBow(deltaMs);
      this.archerAim.delete(enemy);
    } else {
      const speed = bowSpeed(ENEMY_ARROW_POWER);
      const cached = this.archerAim.get(enemy);
      let angle = cached?.angle;
      if (!cached || cached.ageMs >= ARCHER_AIM_REFRESH_MS) {
        angle = solveLaunchAngle(enemy.getBowReleasePoint(), aimPoint, speed, Arrow.getFlightParams('normal', this.world.wind), GROUND_Y);
        this.archerAim.set(enemy, { angle, ageMs: 0 });
      } else {
        cached.ageMs += deltaMs;
      }
      if (enemy.aimBow(angle ?? Math.PI, deltaMs)) {
        const spread = (Math.random() * 2 - 1) * ENEMY_ARCHER_SPREAD;
        this.events.enemyShot(enemy.getBowReleasePoint(), (angle ?? Math.PI) + spread, speed * (0.97 + Math.random() * 0.06), enemy.kind);
      }
    }
    enemy.updateAnimation(deltaMs, enemy.isMoving());
  }

  /**
   * Dragon archer: flies to its hover point in front of the bowman (or the keep, if he's hiding), and
   * while the target is in range below it the rider aims with the same ballistics and wind and shoots.
   */
  private updateDragon(dragon: DragonEnemy, deltaMs: number): void {
    const { bowman, playerTower } = this.world;
    const aimPoint = bowman.isInTower
      ? { x: playerTower.x, y: GROUND_Y - TOWER_HEIGHT * 0.55 }
      : { x: bowman.x, y: bowman.y - BOWMAN_CHEST };
    dragon.update(deltaMs, aimPoint.x);
    const release = dragon.getBowReleasePoint();
    const inRange = release.x > aimPoint.x && release.x - aimPoint.x <= DRAGON_RANGE;
    if (!inRange || bowman.isDead) {
      dragon.relax(deltaMs);
      this.archerAim.delete(dragon);
    } else {
      const speed = bowSpeed(ENEMY_ARROW_POWER);
      const cached = this.archerAim.get(dragon);
      let angle = cached?.angle;
      if (!cached || cached.ageMs >= ARCHER_AIM_REFRESH_MS) {
        angle = solveLaunchAngle(release, aimPoint, speed, Arrow.getFlightParams('normal', this.world.wind), GROUND_Y);
        this.archerAim.set(dragon, { angle, ageMs: 0 });
      } else {
        cached.ageMs += deltaMs;
      }
      if (dragon.aim(angle ?? Math.PI, deltaMs)) {
        const spread = (Math.random() * 2 - 1) * ENEMY_ARCHER_SPREAD;
        this.events.enemyShot(dragon.getBowReleasePoint(), (angle ?? Math.PI) + spread, speed * (0.97 + Math.random() * 0.06), 'dragon');
      }
    }
    dragon.updateAnimation(deltaMs);
  }

  /**
   * A lightning bolt hit the ground at `point`: everyone within LIGHTNING_RADIUS takes LIGHTNING_DAMAGE
   * (enemies are knocked down or killed stiff). The bowman is safe inside the keep.
   */
  public lightningStrike(point: Vec2): void {
    const { bowman, enemies, effects } = this.world;
    effects.lightningStrike(point);
    // Ground strikes don't reach flying dragons.
    struckBy(point.x, LIGHTNING_RADIUS, enemies.filter((enemy) => enemy.isAlive() && !enemy.isFlying))
      .forEach((enemy) => enemy.takeDamage(LIGHTNING_DAMAGE, { cause: 'lightning', fromX: point.x }));
    if (!bowman.isInTower && !bowman.isDead && struckBy(point.x, LIGHTNING_RADIUS, [bowman]).length > 0) {
      this.events.bowmanDamaged(LIGHTNING_DAMAGE);
    }
  }

  /** Enemy arrows hurt the bowman, or the keep while he hides inside it. */
  private resolveHostileArrow(arrow: Arrow): void {
    const { start, end } = arrow.getTravelSegment();
    const travel = { x: end.x - start.x, y: end.y - start.y };
    const { bowman, playerTower, effects } = this.world;

    if (bowman.isInTower) {
      const towerHit = segmentHitTime(start, travel, {
        left: playerTower.x - TOWER_HALF_WIDTH,
        right: playerTower.x + TOWER_HALF_WIDTH,
        top: GROUND_Y - TOWER_HEIGHT,
        bottom: GROUND_Y,
      });
      if (towerHit !== undefined) {
        playerTower.takeDamage(rollDamage(arrowDamage(arrow.shooter).keep));
        effects.impact(pointAlong(start, travel, towerHit));
        arrow.deactivate();
      }
      return;
    }

    if (bowman.isDead) {
      return; // Flies over the fallen bowman into the ground.
    }
    const bowmanHit = segmentHitTime(start, travel, {
      left: bowman.x - BOWMAN_HALF_WIDTH,
      right: bowman.x + BOWMAN_HALF_WIDTH,
      top: bowman.y - BOWMAN_HEIGHT,
      bottom: bowman.y,
    });
    if (bowmanHit !== undefined) {
      this.events.bowmanDamaged(rollDamage(arrowDamage(arrow.shooter).bowman));
      effects.bloodBurst(pointAlong(start, travel, bowmanHit));
      arrow.deactivate();
    }
  }

  private resolveArrow(arrow: Arrow, activeEnemies: readonly Foe[]): void {
    const { start, end } = arrow.getTravelSegment();
    const travel = { x: end.x - start.x, y: end.y - start.y };
    const hitEnemies = this.arrowHits.get(arrow) ?? new Set<Foe>();
    this.arrowHits.set(arrow, hitEnemies);

    const enemyHit = activeEnemies
      .filter((candidate) => candidate.isAlive() && !hitEnemies.has(candidate))
      .map((candidate) => CombatSystem.hitTest(start, travel, candidate))
      .filter((hit): hit is EnemyHit => hit !== undefined)
      .sort((first, second) => first.time - second.time)[0];

    const { enemyTower } = this.world;
    const towerHit = segmentHitTime(start, travel, {
      left: enemyTower.x - TOWER_HALF_WIDTH,
      right: enemyTower.x + TOWER_HALF_WIDTH,
      top: GROUND_Y - TOWER_HEIGHT,
      bottom: GROUND_Y,
    });

    if (towerHit !== undefined && (enemyHit === undefined || towerHit <= enemyHit.time)) {
      this.hitTower(arrow, pointAlong(start, travel, towerHit), activeEnemies);
      return;
    }
    if (enemyHit) {
      this.hitEnemy(arrow, enemyHit, pointAlong(start, travel, enemyHit.time), hitEnemies, activeEnemies);
    }
  }

  /** Earliest hit of the segment on an enemy's head or body; the head wins ties. */
  /** Earliest hit of the segment on any of the enemy's hit zones; a headshot zone wins ties. */
  private static hitTest(start: Vec2, travel: Vec2, enemy: Foe): EnemyHit | undefined {
    let best: EnemyHit | undefined;
    CombatSystem.hitBoxes(enemy).forEach(({ bounds, headshot }) => {
      const time = segmentHitTime(start, travel, bounds);
      if (time !== undefined && (!best || time < best.time || (time === best.time && headshot))) {
        best = { enemy, time, headshot };
      }
    });
    return best;
  }

  /** Stickmen: head and body. Dragons: rider and dragon head (headshots), body and tail. */
  private static hitBoxes(enemy: Foe): HitBox[] {
    return enemy instanceof DragonEnemy
      ? enemy.getHitBoxes()
      : [{ bounds: enemy.getHeadBounds(), headshot: true }, { bounds: enemy.getPhysicsBounds(), headshot: false }];
  }

  private hitTower(arrow: Arrow, impactPoint: Vec2, activeEnemies: readonly Foe[]): void {
    const explosive = arrow.type === 'explosive';
    this.world.enemyTower.takeDamage(ENEMY_TOWER_DAMAGE * (explosive ? 1.25 : 1));
    if (explosive) {
      this.explode(impactPoint, activeEnemies);
    } else {
      this.world.effects.impact(impactPoint);
    }
    arrow.deactivate();
  }

  /**
   * A kamikaze blows up: it bursts apart, the blast hurts the enemies around it like an explosive arrow,
   * and the bowman (unless he's in the keep) and the keep take its damage if they're close.
   */
  private detonate(kamikaze: Enemy): void {
    const { bowman, playerTower, effects } = this.world;
    const body = kamikaze.getPhysicsBounds();
    const point = { x: body.x + body.width / 2, y: body.y + body.height / 2 };
    const damage = ENEMY_DAMAGE.kamikaze.melee;
    kamikaze.takeDamage(Number.MAX_SAFE_INTEGER, { cause: 'blast', fromX: point.x, point });
    this.explode(point, this.world.enemies.filter((enemy) => enemy.isAlive()), kamikaze);
    if (!bowman.isInTower && !bowman.isDead && Math.hypot(bowman.x - point.x, bowman.y - BOWMAN_CHEST - point.y) <= EXPLOSION_RADIUS * KAMIKAZE_REACH) {
      this.events.bowmanDamaged(rollDamage(damage.bowman));
      effects.bloodBurst({ x: bowman.x, y: bowman.y - BOWMAN_CHEST });
    }
    if (point.x - (playerTower.x + TOWER_HALF_WIDTH) <= EXPLOSION_RADIUS * KAMIKAZE_REACH) {
      playerTower.takeDamage(rollDamage(damage.keep));
    }
  }

  /**
   * Explosion visuals plus splash damage and knockback for every living enemy whose body centre is
   * within EXPLOSION_RADIUS (except `directHit`, which already took the arrow's damage).
   */
  private explode(point: Vec2, activeEnemies: readonly Foe[], directHit?: Foe): void {
    this.world.effects.explosion(point);
    this.events.sound('explosion', point);
    activeEnemies
      .filter((candidate) => candidate !== directHit && candidate.isAlive())
      .forEach((candidate) => {
        const body = candidate.getPhysicsBounds();
        const dx = body.x + body.width / 2 - point.x;
        const dy = body.y + body.height / 2 - point.y;
        if (Math.hypot(dx, dy) > EXPLOSION_RADIUS) {
          return;
        }
        // Survivors are knocked down away from the blast and get back up; the rest die thrown back.
        candidate.takeDamage(EXPLOSION_DAMAGE, { cause: 'explosion', fromX: point.x, point, blastDistance: Math.hypot(dx, dy) / EXPLOSION_RADIUS });
      });
  }

  private hitEnemy(
    arrow: Arrow,
    { enemy, headshot }: EnemyHit,
    impactPoint: Vec2,
    hitEnemies: Set<Foe>,
    activeEnemies: readonly Foe[],
  ): void {
    const { effects, debug } = this.world;
    effects.bloodBurst(impactPoint, enemy.bodyColors);
    if (SHOW_HITBOX_DEBUG) {
      debug.circle(impactPoint.x, impactPoint.y, 3).fill({ color: 0x55ff88, alpha: 1 });
    }

    const baseDamage = arrow.type === 'piercing'
      ? PROJECTILE_DAMAGE * Math.pow(PIERCING_DAMAGE_MULTIPLIER, arrow.impacts)
      : arrow.type === 'fragment' ? PROJECTILE_DAMAGE * SHRAPNEL_FRAGMENT_DAMAGE : PROJECTILE_DAMAGE;
    const arrowDamage = headshot ? baseDamage * HEADSHOT_DAMAGE_MULTIPLIER : baseDamage;
    // A direct explosive hit also takes the blast; a kill blows the body apart.
    const damage = arrow.type === 'explosive' ? arrowDamage + EXPLOSION_DAMAGE : arrowDamage;
    if (headshot) {
      this.events.headshot();
    }
    const fromLeft = arrow.x < enemy.x;
    enemy.applyHitReaction(fromLeft ? 6 : -4);
    const cause = arrow.type === 'explosive' ? 'blast' : headshot ? 'headshot' : 'arrow';
    enemy.takeDamage(damage, { cause, fromX: fromLeft ? enemy.x - 1 : enemy.x + 1, point: impactPoint });
    // Every arrow hit makes the enemy cry out (kills and headshots too); an explosive kill is just the blast.
    if (arrow.type !== 'explosive' || enemy.isAlive()) {
      this.events.sound('groan', impactPoint);
    }
    hitEnemies.add(enemy);
    arrow.registerImpact();

    if (arrow.type === 'explosive') {
      this.explode(impactPoint, activeEnemies, enemy);
      arrow.deactivate();
    } else if (arrow.type === 'piercing') {
      effects.impact(impactPoint);
      if (arrow.impacts >= PIERCING_MAX_IMPACTS) {
        arrow.deactivate();
      }
    } else {
      // Pinned to the body: it rides along with walking, falls and the corpse.
      arrow.stickToEnemy(enemy, impactPoint);
    }
  }
}
