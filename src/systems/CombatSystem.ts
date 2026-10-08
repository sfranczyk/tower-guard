import type { Graphics } from 'pixi.js';
import {
  BOWMAN_KNOCKBACK,
  BOWMAN_Y,
  DRAGON_RANGE,
  ENEMY_ARCHER_RANGE,
  ENEMY_ARCHER_SPREAD,
  ENEMY_ARROW_POWER,
  ENEMY_TOWER_DAMAGE,
  EXPLOSION_RADIUS,
  FIRE_DRAGON_BLAST_POWER,
  FIRE_DRAGON_RANGE,
  GROUND_Y,
  HEADSHOT_DAMAGE_MULTIPLIER,
  KAMIKAZE_BLAST_POWER,
  LIGHTNING_DAMAGE,
  LIGHTNING_RADIUS,
  PIERCING_DAMAGE_MULTIPLIER,
  PIN_DAMAGE,
  PROJECTILE_DAMAGE,
  SHOW_HITBOX_DEBUG,
  SHRAPNEL_FRAGMENT_DAMAGE,
} from '../config';
import type { SoundId } from '../audio/SoundManager';
import Arrow from '../objects/Arrow';
import { enemyDamage, explosionDamage, pinDurationMs, rollDamage, type DamageTarget } from '../data/enemies';
import { burnDamage, flamesTouch } from './burning';
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
import { nearestExposedBowman } from './targeting';
import { groundAt } from './terrain';
import type { EffectsSystem } from './EffectsSystem';

const MELEE_REACH = 25;
const TOWER_ATTACK_REACH = 40;
const TOWER_HALF_WIDTH = 48;
const PIERCING_MAX_IMPACTS = 5;
/** A pinning arrow's centre sits this far back from where its tip goes into the ground (the sprite is ~36 px long). */
const PIN_SINK = 13;
/** An arrow hitting a keep sticks into the stone with its centre this far back from the point of impact. */
const WALL_SINK = 14;
/** Bowman hit box (feet at bowman.y) and where enemy archers aim on him. */
const BOWMAN_HALF_WIDTH = 7;
const BOWMAN_HEIGHT = 40;
const BOWMAN_CHEST = 22;
/** The fire dragon aims this far above the bowman's feet. */
const FIRE_AIM_ABOVE_FEET = 10;
/** Enemy archers re-solve their aim this often (the solver simulates many trajectories). */
const ARCHER_AIM_REFRESH_MS = 250;
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
}

export interface CombatEvents {
  bowmanDamaged(bowman: Bowman, amount: number): void;
  /** `bowman` just caught fire. */
  bowmanIgnited(bowman: Bowman): void;
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
const arrowDamage = (shooter: EnemyType | undefined, target: DamageTarget) => enemyDamage(shooter ?? 'archer', 'arrow', target);

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
    // Burning: steady damage until the burn runs out (each bowman counts it down in his animation).
    this.world.bowmen
      .filter((bowman) => bowman.isBurning && !bowman.isDead)
      .forEach((bowman) => this.events.bowmanDamaged(bowman, burnDamage(bowman.burnRemainingMs, deltaMs)));
    if (SHOW_HITBOX_DEBUG) {
      // Cyan: the keeps' silhouettes that arrows hit.
      [this.world.playerTower, this.world.enemyTower].forEach((tower) => tower.hitParts().forEach((part) => {
        this.world.debug.rect(part.left, part.top, part.right - part.left, part.bottom - part.top).stroke({ width: 1, color: 0x55e0ff, alpha: 0.9 });
      }));
    }
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

    // Knocked down by an explosion: no moving or attacking until it gets back up.
    if (enemy.isDown) {
      return;
    }

    // Kamikaze: no swing, it blows itself up on reaching the bowman (jumping doesn't help) or the keep.
    if (enemy.kind === 'kamikaze') {
      const atKeep = !bowman && enemy.x <= playerTower.x + TOWER_ATTACK_REACH;
      const atBowman = bowman !== undefined && Math.abs(enemy.x - bowman.x) <= MELEE_REACH && Math.abs(enemy.y - bowman.y) <= 60;
      if (atKeep || atBowman) {
        this.detonate(enemy);
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
            this.events.bowmanDamaged(bowman, rollDamage(enemyDamage(enemy.kind, 'melee', 'bowman')));
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
    if (dragon.kind === 'fireDragon') {
      this.updateFireDragon(dragon, bowman, aimPoint, deltaMs);
      return;
    }
    const release = dragon.getBowReleasePoint();
    const inRange = release.x > aimPoint.x && release.x - aimPoint.x <= DRAGON_RANGE;
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
        const spread = (Math.random() * 2 - 1) * ENEMY_ARCHER_SPREAD;
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
    const inReach = dx < 0 && dy > 0 && Math.hypot(dx, dy) <= FIRE_DRAGON_RANGE;
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
      .filter((candidate) => !candidate.isInTower && !candidate.isDead && flamesTouch(flames, CombatSystem.bowmanBox(candidate)))
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

  /** A bowman's hit box (feet at his y). */
  private static bowmanBox(bowman: Bowman): { left: number; right: number; top: number; bottom: number } {
    return { left: bowman.x - BOWMAN_HALF_WIDTH, right: bowman.x + BOWMAN_HALF_WIDTH, top: bowman.y - BOWMAN_HEIGHT, bottom: bowman.y };
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
      .forEach((bowman) => this.events.bowmanDamaged(bowman, LIGHTNING_DAMAGE));
  }

  /** Enemy arrows hurt any bowman out in the open, or the keep while everyone left hides inside it. */
  private resolveHostileArrow(arrow: Arrow): void {
    const { start, end } = arrow.getTravelSegment();
    const travel = { x: end.x - start.x, y: end.y - start.y };
    const { bowmen, playerTower, effects } = this.world;
    const exposed = bowmen.filter((bowman) => !bowman.isInTower && !bowman.isDead);

    if (exposed.length === 0 && bowmen.some((bowman) => !bowman.isDead)) {
      // Follows the keep's silhouette; chips fly off where it lands.
      const towerHit = playerTower.hitTime(start, travel);
      if (towerHit !== undefined) {
        const impact = pointAlong(start, travel, towerHit);
        playerTower.takeDamage(rollDamage(arrowDamage(arrow.shooter, 'keep')), impact);
        arrow.stickToWall(impact, WALL_SINK);
      }
      return;
    }

    // The earliest bowman on its path (it flies over the fallen into the ground).
    const hit = exposed
      .map((bowman) => ({ bowman, time: segmentHitTime(start, travel, CombatSystem.bowmanBox(bowman)) }))
      .filter((candidate): candidate is { bowman: Bowman; time: number } => candidate.time !== undefined)
      .sort((first, second) => first.time - second.time)[0];
    if (hit) {
      this.events.bowmanDamaged(hit.bowman, rollDamage(arrowDamage(arrow.shooter, 'bowman')));
      effects.bloodBurst(pointAlong(start, travel, hit.time));
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
    const towerHit = enemyTower.hitTime(start, travel);

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
    // Chips fly off where it lands.
    this.world.enemyTower.takeDamage(ENEMY_TOWER_DAMAGE * (explosive ? 1.25 : 1), impactPoint);
    if (explosive) {
      this.explode(impactPoint, activeEnemies);
      arrow.deactivate();
    } else {
      // Sticks into the stone and stays there.
      arrow.stickToWall(impactPoint, WALL_SINK);
    }
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
    this.explode(point, this.world.enemies.filter((enemy) => enemy.isAlive()), kamikaze);
    const reach = EXPLOSION_RADIUS * KAMIKAZE_REACH;
    bowmen.filter((bowman) => !bowman.isInTower && !bowman.isDead).forEach((bowman) => {
      const bowmanDistance = Math.hypot(bowman.x - point.x, bowman.y - BOWMAN_CHEST - point.y);
      if (bowmanDistance > reach) {
        return;
      }
      this.events.bowmanDamaged(bowman, rollDamage(enemyDamage('kamikaze', 'melee', 'bowman')));
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
   */
  private explode(point: Vec2, activeEnemies: readonly Foe[], directHit?: Foe, power = 1, dragon = false): void {
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
        // Survivors are knocked down away from the blast and get back up; the rest die thrown back.
        const blastDistance = Math.hypot(dx, dy) / radius;
        candidate.takeDamage(explosionDamage(blastDistance) * power, { cause: 'explosion', fromX: point.x, point, blastDistance });
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

    // An explosive arrow deals only its blast (no impact damage, so no headshot either); a kill blows the body apart.
    const explosive = arrow.type === 'explosive';
    const baseDamage = arrow.type === 'piercing'
      ? PROJECTILE_DAMAGE * Math.pow(PIERCING_DAMAGE_MULTIPLIER, arrow.impacts)
      : arrow.type === 'fragment' ? PROJECTILE_DAMAGE * SHRAPNEL_FRAGMENT_DAMAGE : PROJECTILE_DAMAGE;
    // A pinning arrow only scratches (it's about holding them, not hurting them; no headshot bonus).
    const pinning = arrow.type === 'pinning';
    const damage = explosive
      ? explosionDamage(0)
      : pinning ? rollDamage(PIN_DAMAGE) : headshot ? baseDamage * HEADSHOT_DAMAGE_MULTIPLIER : baseDamage;
    if (headshot && !explosive && !pinning) {
      this.events.headshot();
    }
    const fromLeft = arrow.x < enemy.x;
    enemy.applyHitReaction(fromLeft ? 6 : -4);
    const cause = explosive ? 'blast' : headshot && !pinning ? 'headshot' : 'arrow';
    enemy.takeDamage(damage, { cause, fromX: fromLeft ? enemy.x - 1 : enemy.x + 1, point: impactPoint });
    // Every arrow hit makes the enemy cry out (kills and headshots too); an explosive kill is just the blast.
    if (!explosive || enemy.isAlive()) {
      this.events.sound('groan', impactPoint);
    }
    hitEnemies.add(enemy);
    arrow.registerImpact();

    if (explosive && enemy instanceof DragonEnemy && enemy.kind === 'fireDragon' && !enemy.isAlive()) {
      // A fire dragon killed by a direct explosive hit blows up: twice the blast, centred on its body, and the
      // arrows stuck in it go with it.
      const body = enemy.getPhysicsBounds();
      this.explode({ x: body.x + body.width / 2, y: body.y + body.height / 2 }, activeEnemies, enemy, FIRE_DRAGON_BLAST_POWER, true);
      this.world.arrows.filter((stuck) => stuck.stuckTo === enemy).forEach((stuck) => stuck.deactivate());
      arrow.deactivate();
    } else if (explosive && enemy.kind === 'kamikaze' && !enemy.isAlive()) {
      // A kamikaze killed by a direct explosive hit sets its bomb off: a twice-as-big blast where it stood.
      const body = enemy.getPhysicsBounds();
      this.explode({ x: body.x + body.width / 2, y: body.y + body.height / 2 }, activeEnemies, enemy, KAMIKAZE_BLAST_POWER);
      arrow.deactivate();
    } else if (explosive) {
      this.explode(impactPoint, activeEnemies, enemy);
      arrow.deactivate();
    } else if (arrow.type === 'piercing') {
      effects.impact(impactPoint);
      if (arrow.impacts >= PIERCING_MAX_IMPACTS) {
        arrow.deactivate();
      }
    } else if (arrow.type === 'pinning' && enemy.isAlive() && !(enemy instanceof DragonEnemy) && pinDurationMs(enemy.kind) > 0) {
      // Through the rear foot into the ground: the enemy is held there for a while, struggling.
      enemy.pin(pinDurationMs(enemy.kind));
      const heading = Math.atan2(arrow.velocityVector.y, arrow.velocityVector.x);
      const foot = enemy.pinnedFootPoint();
      arrow.position.set(foot.x - Math.cos(heading) * PIN_SINK, foot.y - Math.sin(heading) * PIN_SINK);
      arrow.stickToGround(arrow.y);
      effects.impact({ x: foot.x, y: foot.y - 2 });
    } else {
      // Pinned to the body: it rides along with walking, falls and the corpse.
      arrow.stickToEnemy(enemy, impactPoint);
    }
  }
}
