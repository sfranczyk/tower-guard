import type { Graphics } from 'pixi.js';
import {
  BOWMAN_Y,
  ENEMY_TOWER_DAMAGE,
  EXPLOSION_DAMAGE,
  EXPLOSION_RADIUS,
  GROUND_Y,
  HEADSHOT_DAMAGE_MULTIPLIER,
  PIERCING_DAMAGE_MULTIPLIER,
  PROJECTILE_DAMAGE,
  SHOW_HITBOX_DEBUG,
} from '../config';
import type Arrow from '../objects/Arrow';
import type Bowman from '../objects/Bowman';
import type Enemy from '../objects/Enemy';
import { TOWER_HEIGHT } from '../objects/Tower';
import type Tower from '../objects/Tower';
import type { Vec2 } from '../types';
import { segmentHitTime } from './collision';
import type { EffectsSystem } from './EffectsSystem';

const MELEE_REACH = 25;
const TOWER_ATTACK_REACH = 40;
const TOWER_HALF_WIDTH = 48;
const PIERCING_MAX_IMPACTS = 5;

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

  public constructor(
    private readonly world: CombatWorld,
    private readonly events: CombatEvents,
  ) {}

  /** With `enemiesActive` false (debug: enemies hidden) enemies freeze and arrows pass through them. */
  public update(deltaMs: number, enemiesActive = true): void {
    const activeEnemies = enemiesActive ? this.world.enemies.filter((enemy) => enemy.isAlive()) : [];
    activeEnemies.forEach((enemy) => this.updateEnemy(enemy, deltaMs));

    const { arrows } = this.world;
    arrows.filter((arrow) => arrow.isActive).forEach((arrow) => arrow.update(deltaMs));
    arrows.filter((arrow) => arrow.isActive && !arrow.isStuck).forEach((arrow) => this.resolveArrow(arrow, activeEnemies));
    arrows
      .filter((arrow) => arrow.isActive && !arrow.isStuck && arrow.y >= GROUND_Y - 3)
      .forEach((arrow) => arrow.stickToGround(GROUND_Y - 3));
  }

  private updateEnemy(enemy: Enemy, deltaMs: number): void {
    const { bowman, playerTower, debug } = this.world;
    enemy.target = bowman.isInTower ? 'tower' : 'bowman';
    const bowmanBehindEnemy = enemy.target === 'bowman' && bowman.x > enemy.x + MELEE_REACH;
    const targetPosition = enemy.target === 'bowman'
      ? { x: bowmanBehindEnemy ? enemy.x + 100 : bowman.x, y: BOWMAN_Y }
      : { x: playerTower.x, y: GROUND_Y };

    enemy.update(deltaMs, targetPosition, enemy.target === 'tower' ? TOWER_ATTACK_REACH : MELEE_REACH);
    enemy.updateAnimation(deltaMs, enemy.isMoving());

    if (SHOW_HITBOX_DEBUG) {
      const hitbox = enemy.getPhysicsBounds();
      debug.rect(hitbox.x, hitbox.y, hitbox.width, hitbox.height).stroke({ width: 1, color: 0xff5555, alpha: 0.9 });
      const head = enemy.getHeadBounds();
      debug.rect(head.x, head.y, head.width, head.height).stroke({ width: 1, color: 0xffd23f, alpha: 0.9 });
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
      this.hitTower(arrow, pointAlong(start, travel, towerHit));
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

  private hitTower(arrow: Arrow, impactPoint: Vec2): void {
    const explosive = arrow.type === 'explosive';
    this.world.enemyTower.takeDamage(ENEMY_TOWER_DAMAGE * (explosive ? 1.25 : 1));
    this.world.effects.impact(impactPoint, explosive);
    if (explosive) {
      this.world.effects.explosion(impactPoint);
    }
    arrow.deactivate();
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
    enemy.applyHitReaction(arrow.x < enemy.x ? 6 : -4);
    enemy.takeDamage(damage);
    hitEnemies.add(enemy);
    arrow.registerImpact();

    if (arrow.type === 'explosive') {
      effects.explosion(impactPoint);
      activeEnemies
        .filter((candidate) => candidate !== enemy && candidate.isAlive()
          && Math.hypot(candidate.x - impactPoint.x, candidate.y - impactPoint.y) <= EXPLOSION_RADIUS)
        .forEach((candidate) => {
          candidate.takeDamage(EXPLOSION_DAMAGE);
          if (!candidate.isAlive()) {
            this.events.enemyKilled();
          }
        });
      arrow.deactivate();
    } else if (arrow.type === 'piercing') {
      effects.impact(impactPoint, false);
      if (arrow.impacts >= PIERCING_MAX_IMPACTS) {
        arrow.deactivate();
      }
    } else {
      arrow.stickToEnemy(enemy, impactPoint);
    }

    if (!enemy.isAlive()) {
      this.events.enemyKilled();
    }
  }
}
