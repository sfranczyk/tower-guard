import type { Graphics } from 'pixi.js';
import {
  BOWMAN_Y,
  DRAGON_RANGE,
  DRAGON_TURBULENCE_SPREAD,
  ENEMY_ARCHER_RANGE,
  ENEMY_ARCHER_SPREAD,
  ENEMY_ARROW_POWER,
  FIRE_DRAGON_RANGE,
  GROUND_Y,
  SHOW_HITBOX_DEBUG,
} from '../config';
import { enemyDamage, rollDamage } from '../data/enemies';
import { enemyArchetype } from '../data/enemyKinds';
import { bowSpeed } from '../data/projectiles';
import Arrow from '../objects/Arrow';
import type Bowman from '../objects/Bowman';
import DragonEnemy from '../objects/DragonEnemy';
import type Enemy from '../objects/Enemy';
import { TOWER_HEIGHT } from '../objects/Tower';
import type Tower from '../objects/Tower';
import type { EnemyType, Vec2 } from '../types';
import { solveLaunchAngle } from './ballistics';
import { flamesTouch } from './burning';
import type { BowmanHit } from './bowmanDeath';
import { BOWMAN_CHEST, TOWER_HALF_WIDTH, bowmanBox, foeHitBoxes, type Foe } from './combatGeometry';
import type { EffectsSystem } from './EffectsSystem';
import { nearestExposedBowman } from './targeting';
import { groundAt } from './terrain';

const MELEE_REACH = 25;
const TOWER_ATTACK_REACH = 40;
/** The fire dragon aims this far above the bowman's feet. */
const FIRE_AIM_ABOVE_FEET = 10;
/** Enemy archers re-solve their aim this often (the solver simulates many trajectories). */
const ARCHER_AIM_REFRESH_MS = 250;

/** What the enemies need of the battle. */
export interface EnemyAIWorld {
  readonly bowmen: readonly Bowman[];
  readonly playerTower: Tower;
  readonly effects: EffectsSystem;
  readonly debug: Graphics;
  /** The level's wind (px/s² on a normal arrow); archers aim with it. */
  readonly wind: number;
}

export interface EnemyAIEvents {
  bowmanDamaged(bowman: Bowman, amount: number, hit: BowmanHit): void;
  bowmanIgnited(bowman: Bowman): void;
  /** A hostile arrow loosed by `shooter` (its damage depends on who shot it). */
  enemyShot(from: Vec2, angle: number, speed: number, shooter: EnemyType): void;
}

/**
 * What every living enemy does each frame (CombatSystem calls `update`): walk at the nearest bowman out in the open
 * (or the keep), swing when in reach, a kamikaze blows itself up there; archers stop in range and shoot with the real
 * ballistics; dragons fly to their hover point, the archer's rider shoots and the fire dragon breathes fire.
 */
export class EnemyAI {
  /** Cached aim per enemy archer. */
  private readonly archerAim = new Map<Foe, { angle: number; ageMs: number }>();

  public constructor(
    private readonly world: EnemyAIWorld,
    private readonly events: EnemyAIEvents,
    private readonly actions: { detonate(kamikaze: Enemy): void },
  ) {}

  /** One living enemy's frame. */
  public update(enemy: Foe, deltaMs: number): void {
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
    const { playerTower } = this.world;
    // The nearest bowman out in the open, or the keep when everyone left is hiding in it.
    const bowman = nearestExposedBowman(this.world.bowmen, enemy.x);
    enemy.target = bowman ? 'bowman' : 'tower';
    const bowmanBehindEnemy = bowman !== undefined && bowman.x > enemy.x + MELEE_REACH;
    const targetPosition = bowman
      ? { x: bowmanBehindEnemy ? enemy.x + 100 : bowman.x, y: BOWMAN_Y }
      : { x: playerTower.x, y: GROUND_Y };

    enemy.update(deltaMs, targetPosition, enemy.target === 'tower' ? TOWER_ATTACK_REACH : MELEE_REACH);
    enemy.updateAnimation(deltaMs, enemy.isMoving());
    this.drawDebugHitboxes(enemy);

    // Knocked down by an explosion, frozen solid or caught in a vortex: no moving or attacking meanwhile.
    if (enemy.isDown || enemy.afflictions.isFrozen || enemy.afflictions.inVortex) {
      return;
    }

    // Kamikaze: no swing, it blows itself up on reaching the bowman (jumping doesn't help) or the keep.
    if (enemyArchetype(enemy.kind).detonates) {
      const atKeep = !bowman && enemy.x <= playerTower.x + TOWER_ATTACK_REACH;
      const atBowman = bowman !== undefined && Math.abs(enemy.x - bowman.x) <= MELEE_REACH && Math.abs(enemy.y - bowman.y) <= 60;
      if (atKeep || atBowman) {
        this.actions.detonate(enemy);
      }
      return;
    }

    if (!bowman) {
      if (enemy.x <= playerTower.x + TOWER_ATTACK_REACH && enemy.canAttack()) {
        // The keep takes the hit when the club lands, with a chip of stone flying off the wall.
        enemy.playAttackAnimation(() => {
          // Chips fly off the wall where the club lands.
          playerTower.takeDamage(rollDamage(enemyDamage(enemy.kind, 'melee', 'keep')), { x: playerTower.x + TOWER_HALF_WIDTH - 4, y: enemy.y - 30 * enemy.scale.y });
        });
      }
      return;
    }

    // No swing at a bowman who is in the air; once he lands in reach, the enemy swings again.
    const overlapsBowman = Math.abs(enemy.x - bowman.x) <= MELEE_REACH;
    const bowmanAirborne = bowman.y < groundAt(bowman.x) - 20;
    if (!bowmanAirborne && overlapsBowman && Math.abs(enemy.y - bowman.y) <= 45) {
      if (enemy.canAttack()) {
        // Damage lands with the club: to dodge, the bowman has to get beyond this enemy's strike reach
        // (or into the keep) before it lands; jumping on the spot doesn't help.
        enemy.playAttackAnimation(() => {
          const stillInReach = Math.abs(enemy.x - bowman.x) <= enemy.strikeReach && Math.abs(enemy.y - bowman.y) <= 45 * enemy.size;
          if (stillInReach && !bowman.isInTower && !bowman.isDead) {
            this.events.bowmanDamaged(bowman, rollDamage(enemyDamage(enemy.kind, 'melee', 'bowman')), { cause: 'melee', fromX: enemy.x });
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
    foeHitBoxes(enemy).forEach(({ bounds, headshot }) => {
      debug.rect(bounds.x, bounds.y, bounds.width, bounds.height).stroke({ width: 1, color: headshot ? 0xffd23f : 0xff5555, alpha: 0.9 });
    });
  }

  /**
   * Enemy archer: walk until the bowman (or the keep, if he's hiding in it) is in range, then stop,
   * aim with the real ballistics and shoot with a little spread.
   */
  private updateArcher(enemy: Enemy, deltaMs: number): void {
    const aimPoint = this.aimPointFrom(enemy.x);
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
    const bowman = nearestExposedBowman(this.world.bowmen, dragon.x);
    const aimPoint = this.aimPointFrom(dragon.x);
    dragon.update(deltaMs, aimPoint.x);
    if (enemyArchetype(dragon.kind).breathesFire) {
      this.updateFireDragon(dragon, bowman, aimPoint, deltaMs);
      return;
    }
    const release = dragon.getBowReleasePoint();
    // In front of it (it faces either way) and in range; it doesn't shoot while turning round.
    const ahead = (aimPoint.x - release.x) * dragon.facingX;
    const inRange = !dragon.isTurning && ahead > 0 && ahead <= DRAGON_RANGE;
    if (!inRange || this.world.bowmen.every((candidate) => candidate.isDead)) {
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
        // Buffeted by turbulence the rider can't aim well.
        const spread = (Math.random() * 2 - 1) * ENEMY_ARCHER_SPREAD * (dragon.afflictions.isTurbulent ? DRAGON_TURBULENCE_SPREAD : 1);
        this.events.enemyShot(dragon.getBowReleasePoint(), (angle ?? Math.PI) + spread, speed * (0.97 + Math.random() * 0.06), 'dragon');
      }
    }
    dragon.updateAnimation(deltaMs);
  }

  /**
   * Fire dragon: hovers lower and closer (DragonEnemy) and breathes fire at the bowman (or the keep, if he's
   * hiding) whenever the target is within FIRE_DRAGON_RANGE of its mouth, ahead of and below it. Its flames
   * set the bowman alight (systems/burning.ts); the burn's damage is applied in update.
   */
  private updateFireDragon(dragon: DragonEnemy, bowman: Bowman | undefined, aimPoint: Vec2, deltaMs: number): void {
    // The hot gas rises towards the end of the stream: aim at his legs rather than his chest.
    const target = bowman ? { x: aimPoint.x, y: bowman.y - FIRE_AIM_ABOVE_FEET } : aimPoint;
    const mouth = dragon.getMouthPoint();
    const dx = target.x - mouth.x;
    const dy = target.y - mouth.y;
    const inReach = dx * dragon.facingX > 0 && dy > 0 && Math.hypot(dx, dy) <= FIRE_DRAGON_RANGE;
    if (inReach && this.world.bowmen.some((candidate) => !candidate.isDead)) {
      dragon.breathe(Math.atan2(dy, dx));
    }
    dragon.updateAnimation(deltaMs);
    // The flames set any bowman they touch alight (not inside the keep); staying in them keeps relighting the burn.
    const flames = dragon.getFlames();
    if (flames.length === 0) {
      return;
    }
    this.world.bowmen
      .filter((candidate) => !candidate.isInTower && !candidate.isDead && flamesTouch(flames, bowmanBox(candidate)))
      .forEach((candidate) => {
        if (candidate.ignite()) {
          this.events.bowmanIgnited(candidate);
        }
      });
  }

  /**
   * Where ranged enemies at `fromX` aim: the chest of the nearest bowman out in the open, or the keep when
   * everyone left is hiding in it.
   */
  private aimPointFrom(fromX: number): Vec2 {
    const bowman = nearestExposedBowman(this.world.bowmen, fromX);
    return bowman
      ? { x: bowman.x, y: bowman.y - BOWMAN_CHEST }
      : { x: this.world.playerTower.x, y: GROUND_Y - TOWER_HEIGHT * 0.55 };
  }
}
