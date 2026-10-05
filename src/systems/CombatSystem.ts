import type { Graphics } from 'pixi.js';
import {
  BOWMAN_Y,
  ENEMY_ARCHER_RANGE,
  ENEMY_ARCHER_SPREAD,
  ENEMY_ARROW_DAMAGE,
  ENEMY_ARROW_POWER,
  ENEMY_TOWER_DAMAGE,
  EXPLOSION_DAMAGE,
  EXPLOSION_RADIUS,
  GROUND_Y,
  HEADSHOT_DAMAGE_MULTIPLIER,
  PIERCING_DAMAGE_MULTIPLIER,
  PROJECTILE_DAMAGE,
  SHOW_HITBOX_DEBUG,
} from '../config';
import Arrow from '../objects/Arrow';
import { launchSpeed } from '../data/projectiles';
import type Bowman from '../objects/Bowman';
import type Enemy from '../objects/Enemy';
import { TOWER_HEIGHT } from '../objects/Tower';
import type Tower from '../objects/Tower';
import type { Vec2 } from '../types';
import { solveLaunchAngle } from './ballistics';
import { segmentHitTime } from './collision';
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

export interface CombatWorld {
  readonly bowman: Bowman;
  readonly playerTower: Tower;
  readonly enemyTower: Tower;
  readonly enemies: readonly Enemy[];
  readonly arrows: readonly Arrow[];
  readonly effects: EffectsSystem;
  readonly debug: Graphics;
}

export interface CombatEvents {
  bowmanDamaged(amount: number): void;
  enemyKilled(): void;
  headshot(): void;
  /** An enemy archer looses an arrow. */
  enemyShot(from: Vec2, angle: number, speed: number): void;
}

interface EnemyHit {
  enemy: Enemy;
  time: number;
  headshot: boolean;
}

const randomEnemyDamage = (): number => Math.floor(Math.random() * 6) + 2;

const pointAlong = (start: Vec2, travel: Vec2, time: number): Vec2 => ({
  x: start.x + travel.x * time,
  y: start.y + travel.y * time,
});

/** Enemy movement and melee attacks, arrow flight and every arrow hit (enemies and enemy tower). */
export class CombatSystem {
  /** Enemies the bowman has jumped over; they no longer hit him. */
  private readonly jumpedEnemies = new Set<Enemy>();
  /** Enemies each arrow has already hit, so piercing arrows hit each enemy once. */
  private readonly arrowHits = new Map<Arrow, Set<Enemy>>();
  /** Cached aim per enemy archer. */
  private readonly archerAim = new Map<Enemy, { angle: number; ageMs: number }>();

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
      .filter((arrow) => arrow.isActive && !arrow.isStuck && arrow.y >= GROUND_Y - 3)
      .forEach((arrow) => {
        if (arrow.type === 'explosive') {
          this.explode({ x: arrow.x, y: GROUND_Y - 3 }, activeEnemies);
          arrow.deactivate();
        } else {
          arrow.stickToGround(GROUND_Y - 3);
        }
      });
  }

  private updateEnemy(enemy: Enemy, deltaMs: number): void {
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

    if (enemy.target === 'tower') {
      if (enemy.x <= playerTower.x + TOWER_ATTACK_REACH && enemy.canAttack(deltaMs)) {
        enemy.playAttackAnimation();
        playerTower.takeDamage(randomEnemyDamage());
      }
      return;
    }

    const overlapsBowman = Math.abs(enemy.x - bowman.x) <= MELEE_REACH;
    if (!bowman.isInTower && bowman.y < BOWMAN_Y - 20 && overlapsBowman) {
      this.jumpedEnemies.add(enemy);
    }

    if (!bowman.isInTower && !this.jumpedEnemies.has(enemy) && overlapsBowman && Math.abs(enemy.y - bowman.y) <= 45) {
      if (enemy.canAttack(deltaMs)) {
        enemy.playAttackAnimation();
        this.events.bowmanDamaged(randomEnemyDamage());
        this.world.effects.bloodBurst({ x: bowman.x, y: bowman.y - 20 });
      }
    }

    enemy.clearHitTint();
  }

  private drawDebugHitboxes(enemy: Enemy): void {
    if (!SHOW_HITBOX_DEBUG) {
      return;
    }
    const { debug } = this.world;
    const hitbox = enemy.getPhysicsBounds();
    debug.rect(hitbox.x, hitbox.y, hitbox.width, hitbox.height).stroke({ width: 1, color: 0xff5555, alpha: 0.9 });
    const head = enemy.getHeadBounds();
    debug.rect(head.x, head.y, head.width, head.height).stroke({ width: 1, color: 0xffd23f, alpha: 0.9 });
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
      const speed = launchSpeed('normal', ENEMY_ARROW_POWER);
      const cached = this.archerAim.get(enemy);
      let angle = cached?.angle;
      if (!cached || cached.ageMs >= ARCHER_AIM_REFRESH_MS) {
        angle = solveLaunchAngle(enemy.getBowReleasePoint(), aimPoint, speed, Arrow.getFlightParams('normal'), GROUND_Y);
        this.archerAim.set(enemy, { angle, ageMs: 0 });
      } else {
        cached.ageMs += deltaMs;
      }
      if (enemy.aimBow(angle ?? Math.PI, deltaMs)) {
        const spread = (Math.random() * 2 - 1) * ENEMY_ARCHER_SPREAD;
        this.events.enemyShot(enemy.getBowReleasePoint(), (angle ?? Math.PI) + spread, speed * (0.97 + Math.random() * 0.06));
      }
    }
    enemy.updateAnimation(deltaMs, enemy.isMoving());
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
        playerTower.takeDamage(ENEMY_ARROW_DAMAGE);
        effects.impact(pointAlong(start, travel, towerHit));
        arrow.deactivate();
      }
      return;
    }

    const bowmanHit = segmentHitTime(start, travel, {
      left: bowman.x - BOWMAN_HALF_WIDTH,
      right: bowman.x + BOWMAN_HALF_WIDTH,
      top: bowman.y - BOWMAN_HEIGHT,
      bottom: bowman.y,
    });
    if (bowmanHit !== undefined) {
      this.events.bowmanDamaged(ENEMY_ARROW_DAMAGE);
      effects.bloodBurst(pointAlong(start, travel, bowmanHit));
      arrow.deactivate();
    }
  }

  private resolveArrow(arrow: Arrow, activeEnemies: readonly Enemy[]): void {
    const { start, end } = arrow.getTravelSegment();
    const travel = { x: end.x - start.x, y: end.y - start.y };
    const hitEnemies = this.arrowHits.get(arrow) ?? new Set<Enemy>();
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
  private static hitTest(start: Vec2, travel: Vec2, enemy: Enemy): EnemyHit | undefined {
    const headTime = segmentHitTime(start, travel, enemy.getHeadBounds());
    const bodyTime = segmentHitTime(start, travel, enemy.getPhysicsBounds());
    if (headTime !== undefined && (bodyTime === undefined || headTime <= bodyTime)) {
      return { enemy, time: headTime, headshot: true };
    }
    return bodyTime === undefined ? undefined : { enemy, time: bodyTime, headshot: false };
  }

  private hitTower(arrow: Arrow, impactPoint: Vec2, activeEnemies: readonly Enemy[]): void {
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
   * Explosion visuals plus splash damage and knockback for every living enemy whose body centre is
   * within EXPLOSION_RADIUS (except `directHit`, which already took the arrow's damage).
   */
  private explode(point: Vec2, activeEnemies: readonly Enemy[], directHit?: Enemy): void {
    this.world.effects.explosion(point);
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
        candidate.takeDamage(EXPLOSION_DAMAGE, { cause: 'explosion', fromX: point.x });
        if (!candidate.isAlive()) {
          this.events.enemyKilled();
        }
      });
  }



  private hitEnemy(
    arrow: Arrow,
    { enemy, headshot }: EnemyHit,
    impactPoint: Vec2,
    hitEnemies: Set<Enemy>,
    activeEnemies: readonly Enemy[],
  ): void {
    const { effects, debug } = this.world;
    effects.bloodBurst(impactPoint);
    if (SHOW_HITBOX_DEBUG) {
      debug.circle(impactPoint.x, impactPoint.y, 3).fill({ color: 0x55ff88, alpha: 1 });
    }

    const baseDamage = arrow.type === 'piercing'
      ? PROJECTILE_DAMAGE * Math.pow(PIERCING_DAMAGE_MULTIPLIER, arrow.impacts)
      : PROJECTILE_DAMAGE;
    const damage = headshot ? baseDamage * HEADSHOT_DAMAGE_MULTIPLIER : baseDamage;
    if (headshot) {
      this.events.headshot();
    }
    const fromLeft = arrow.x < enemy.x;
    enemy.applyHitReaction(fromLeft ? 6 : -4);
    const cause = arrow.type === 'explosive' ? 'explosion' : headshot ? 'headshot' : 'arrow';
    enemy.takeDamage(damage, { cause, fromX: fromLeft ? enemy.x - 1 : enemy.x + 1 });
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

    if (!enemy.isAlive()) {
      this.events.enemyKilled();
    }
  }
}
