import type { Graphics } from 'pixi.js';
import {
  BANNERS,
  BOWMAN_Y,
  EXPLOSION_RADIUS,
  GROUND_Y,
  PRIEST_ESCAPE_BEYOND,
  PRIEST_POST_SLACK,
  REGEN,
  SHOW_HITBOX_DEBUG,
} from '../config';
import type { EnemyEdge } from '../data/difficulty';
import { enemyDamage, rollDamage } from '../data/enemies';
import { ENEMY_KINDS, enemyArchetype, enemyRegenerates, enemyTraits } from '../data/enemyKinds';
import type Bowman from '../objects/bowman/Bowman';
import DragonEnemy from '../objects/dragon/DragonEnemy';
import type Enemy from '../objects/enemy/Enemy';
import type Tower from '../objects/Tower';
import type { EnemyType, Vec2 } from '../types';
import { enemyEscortPost, escortsBanner, type Banners } from './banners';
import { BlastDodge, blastZones, missChance, type BlastZone, type BombSpot, type DodgeStep } from './blastAwareness';
import { REGEN_START, regenStep, type RegenState } from './regeneration';
import { EnemyPriests } from './EnemyPriests';
import { EnemyRanged } from './EnemyRanged';
import type { BowmanHit } from './bowmanDeath';
import { TOWER_HALF_WIDTH, foeHitBoxes, type Foe } from './combatGeometry';
import type { EffectsSystem } from './EffectsSystem';
import { meleeBlow } from './AllyAI';
import { nearestMeleeTarget } from './targeting';
import { groundAt } from './terrain';
import { enemyKeepX, worldWidth } from './battlefield';

const MELEE_REACH = 25;
const TOWER_ATTACK_REACH = 40;

/** What the enemies need of the battle. */
export interface EnemyAIWorld {
  readonly bowmen: readonly Bowman[];
  readonly playerTower: Tower;
  /** Everyone on the field (a priest heals the others). */
  readonly enemies: readonly Foe[];
  /** The player's soldiers: they stop the melee enemies and draw the archers' arrows like the bowmen. */
  readonly allies: readonly Enemy[];
  readonly effects: EffectsSystem;
  readonly debug: Graphics;
  /** The level's wind now (px/s² on a normal arrow); archers aim with it. */
  wind(): number;
  /** More enemies still to come this level (waves not yet released, a rider about to come off his horse). */
  readonly reinforcementsDue: () => boolean;
  /** The difficulty's edge (data/difficulty.ts): enemy hits × `damage`, enemy archers' aim error × `aimSpread`. */
  readonly enemyEdge: EnemyEdge;
  /** Banners (systems/banners.ts): carriers walk home fighting only what reaches them; a soldier carrying ours is the target. */
  readonly banners?: Banners<Enemy>;
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
 * ballistics; dragons fly to their hover point, the archer's rider shoots and the fire dragon breathes fire; a priest
 * follows the soldiers and heals the wounded around it.
 */
export class EnemyAI {
  /** Regeneration clock per troll. */
  private readonly regen = new WeakMap<Enemy, RegenState>();
  private readonly ranged: EnemyRanged;
  private readonly priests: EnemyPriests;
  /** Each soldier's heed of the kamikazes (systems/blastAwareness.ts). */
  private readonly dodges = new WeakMap<Enemy, BlastDodge<Enemy>>();
  /** The kamikazes on the field this frame (their x) and the ground their bombs are about to blast (beginFrame). */
  private bombs: { kamikazes: Map<Enemy, number>; zones: BlastZone<Enemy>[] } = { kamikazes: new Map(), zones: [] };
  /** Banners: this frame's escort of the enemies' bearer, each with his rank (nearest to the bearer first). */
  private escortRanks = new Map<Enemy, number>();

  public constructor(
    private readonly world: EnemyAIWorld,
    private readonly events: EnemyAIEvents,
    private readonly actions: { detonate(kamikaze: Enemy): void },
  ) {
    this.ranged = new EnemyRanged(world, events);
    this.priests = new EnemyPriests(world);
  }

  /**
   * Before the enemies' frame: where each kamikaze would blow up (at what it runs at) and which bombs that blast would
   * set off in turn (blastZones). A pinned one only links a chain (else a bowman could shelter by it); frozen in ice a
   * bomb doesn't go off.
   */
  public beginFrame(): void {
    const kamikazes = this.world.enemies.filter((enemy): enemy is Enemy =>
      !(enemy instanceof DragonEnemy) && enemy.isAlive() && enemyArchetype(enemy.kind).detonates && !enemy.afflictions.isFrozen);
    const spots = kamikazes.flatMap((kamikaze): BombSpot<Enemy>[] => {
      const radius = EXPLOSION_RADIUS * kamikaze.buff.blastPower;
      const here = { owner: kamikaze, x: kamikaze.x, radius, fused: false };
      if (kamikaze.isPinned || kamikaze.isCelebrating) {
        return [here];
      }
      const target = nearestMeleeTarget(this.world.bowmen, this.world.allies, kamikaze.x);
      const victim = target?.bowman ?? target?.ally;
      const blastX = victim ? victim.x + Math.sign(kamikaze.x - victim.x) * MELEE_REACH : this.world.playerTower.x + TOWER_ATTACK_REACH;
      return [here, { owner: kamikaze, x: blastX, radius, fused: true }];
    });
    this.bombs = { kamikazes: new Map(kamikazes.map((kamikaze) => [kamikaze, kamikaze.x])), zones: blastZones(spots) };
    this.escortRanks = new Map();
    const { banners } = this.world;
    const bearer = banners?.bearer('enemy');
    if (banners && bearer) {
      this.world.enemies
        .filter((enemy): enemy is Enemy => !(enemy instanceof DragonEnemy) && enemy.isAlive() && enemy !== bearer
          && escortsBanner(ENEMY_KINDS[enemy.kind].archetype) && banners.fetchX(enemy) === undefined)
        .sort((a, b) => Math.abs(a.x - bearer.x) - Math.abs(b.x - bearer.x))
        .forEach((enemy, rank) => this.escortRanks.set(enemy, rank));
    }
  }

  /** Banners: where `enemy` walks escorting his team's bearer, if it is one of the escort. */
  private escortPost(enemy: Enemy): number | undefined {
    const rank = this.escortRanks.get(enemy);
    const bearer = this.world.banners?.bearer('enemy');
    return rank === undefined || !bearer ? undefined : enemyEscortPost(bearer.x, rank);
  }

  /** One living enemy's frame. */
  public update(enemy: Foe, deltaMs: number): void {
    if (enemy.isCelebrating) {
      enemy.updateAnimation(deltaMs, false);
      this.drawDebugHitboxes(enemy);
      return;
    }
    if (enemy.fleeing) {
      this.runOff(enemy, deltaMs);
      this.drawDebugHitboxes(enemy);
      return;
    }
    if (!(enemy instanceof DragonEnemy) && enemyRegenerates(enemy.kind)) {
      this.regenerate(enemy, deltaMs);
    }
    if (enemy instanceof DragonEnemy) {
      this.ranged.updateDragon(enemy, deltaMs);
      this.drawDebugHitboxes(enemy);
      return;
    }
    if (enemy.isArcher) {
      this.ranged.updateArcher(enemy, deltaMs, this.escortPost(enemy));
      this.drawDebugHitboxes(enemy);
      return;
    }
    if (enemyArchetype(enemy.kind).heals || enemyArchetype(enemy.kind).buffs) {
      this.priests.update(enemy, deltaMs);
      this.drawDebugHitboxes(enemy);
      return;
    }
    const { playerTower, banners } = this.world;
    if (banners && !enemyArchetype(enemy.kind).detonates) {
      // Banners: a carrier takes his banner home, the one sent for a fallen banner goes to pick it up, the rest go
      // for the soldier carrying ours off (kamikazes keep to their own business).
      const goal = banners.carriedBy(enemy) ? enemyKeepX() : banners.fetchX(enemy);
      if (goal !== undefined) {
        this.walkOnGuard(enemy, goal, deltaMs);
        return;
      }
      const thief = banners.thief('enemy');
      if (thief) {
        this.fightAlly(enemy, thief, deltaMs);
        return;
      }
      // Escorting their bearer: they walk with him and fight only what comes near their post.
      const post = this.escortPost(enemy);
      if (post !== undefined) {
        const near = nearestMeleeTarget(this.world.bowmen, this.world.allies, enemy.x);
        const foe = near?.ally ?? near?.bowman;
        if (near?.ally && Math.abs(near.ally.x - post) <= BANNERS.escortRange) {
          this.fightAlly(enemy, near.ally, deltaMs);
          return;
        }
        if (!foe || Math.abs(foe.x - post) > BANNERS.escortRange) {
          enemy.target = 'bowman';
          enemy.update(deltaMs, { x: post, y: groundAt(post) }, 4);
          enemy.updateAnimation(deltaMs, enemy.isMoving());
          this.drawDebugHitboxes(enemy);
          enemy.clearHitTint();
          return;
        }
        // A bowman near the post: fought as ever below.
      }
    }
    // The nearest bowman out in the open or soldier, or the keep when there's nobody out.
    const melee = nearestMeleeTarget(this.world.bowmen, this.world.allies, enemy.x);
    if (melee?.ally) {
      this.fightAlly(enemy, melee.ally, deltaMs);
      return;
    }
    const bowman = melee?.bowman;
    enemy.target = bowman ? 'bowman' : 'tower';
    // A mounted knight stops further off: its horse's head is ahead of it and its lance reaches past it.
    const meleeReach = enemy.reach?.bowman ?? MELEE_REACH;
    const keepReach = enemy.reach?.keep ?? TOWER_ATTACK_REACH;
    const bowmanBehindEnemy = bowman !== undefined && bowman.x > enemy.x + MELEE_REACH;
    const targetPosition = bowman
      ? { x: bowmanBehindEnemy ? enemy.x + 100 : bowman.x, y: BOWMAN_Y }
      : { x: playerTower.x, y: GROUND_Y };

    const dodge = this.heedBombs(enemy, bowman ? enemy.x >= bowman.x : true, deltaMs);
    if (dodge.kind !== 'free') {
      // Getting away from a kamikaze's blast (or waiting a moment before coming back): no attacking meanwhile.
      const toX = dodge.kind === 'flee' ? Math.min(worldWidth(), Math.max(playerTower.x + keepReach, dodge.toX)) : enemy.x;
      enemy.update(deltaMs, { x: toX, y: groundAt(toX) }, 2);
      enemy.updateAnimation(deltaMs, enemy.isMoving());
      this.drawDebugHitboxes(enemy);
      if (dodge.kind === 'flee' && dodge.startled) {
        const head = enemy.getHeadBounds();
        this.world.effects.alarm({ x: head.x + head.width / 2, y: head.y - 6 });
      }
      enemy.clearHitTint();
      return;
    }
    enemy.update(deltaMs, targetPosition, enemy.target === 'tower' ? keepReach : meleeReach);
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
      if (enemy.x <= playerTower.x + keepReach && enemy.canAttack()) {
        // The keep takes the hit when the club lands, with a chip of stone flying off the wall.
        enemy.playAttackAnimation(() => {
          // Chips fly off the wall where the club lands.
          playerTower.takeDamage(rollDamage(enemyDamage(enemy.kind, 'melee', 'keep')) * this.world.enemyEdge.damage, { x: playerTower.x + TOWER_HALF_WIDTH - 4, y: enemy.y - 30 * enemy.scale.y });
        });
      }
      return;
    }

    // No swing at a bowman who is in the air; once he lands in reach, the enemy swings again.
    const overlapsBowman = Math.abs(enemy.x - bowman.x) <= meleeReach;
    const bowmanAirborne = bowman.y < groundAt(bowman.x) - 20;
    if (!bowmanAirborne && overlapsBowman && Math.abs(enemy.y - bowman.y) <= 45) {
      if (enemy.canAttack()) {
        // Damage lands with the club: to dodge, the bowman has to get beyond this enemy's strike reach
        // (or into the keep) before it lands; jumping on the spot doesn't help.
        enemy.playAttackAnimation(() => {
          const stillInReach = Math.abs(enemy.x - bowman.x) <= enemy.strikeReach && Math.abs(enemy.y - bowman.y) <= 45 * enemy.size;
          if (stillInReach && !bowman.isInTower && !bowman.isDead) {
            this.events.bowmanDamaged(bowman, rollDamage(enemyDamage(enemy.kind, 'melee', 'bowman')) * this.world.enemyEdge.damage, { cause: 'melee', fromX: enemy.x });
            this.world.effects.bloodBurst({ x: bowman.x, y: bowman.y - 20 });
          }
        });
      }
    }

    enemy.clearHitTint();
  }

  /**
   * A melee enemy whose nearest foe is one of the player's soldiers: walks up to him and strikes (his plate turns most
   * of it); a kamikaze blows itself up at him. Kamikaze heed as against the bowman.
   */
  private fightAlly(enemy: Enemy, ally: Enemy, deltaMs: number): void {
    enemy.target = 'ally';
    const meleeReach = enemy.reach?.bowman ?? MELEE_REACH;
    const dodge = this.heedBombs(enemy, enemy.x >= ally.x, deltaMs);
    if (dodge.kind !== 'free') {
      const toX = dodge.kind === 'flee' ? Math.min(worldWidth(), Math.max(this.world.playerTower.x, dodge.toX)) : enemy.x;
      enemy.update(deltaMs, { x: toX, y: groundAt(toX) }, 2);
      enemy.updateAnimation(deltaMs, enemy.isMoving());
      this.drawDebugHitboxes(enemy);
      enemy.clearHitTint();
      return;
    }
    enemy.update(deltaMs, { x: ally.x, y: groundAt(ally.x) }, meleeReach);
    enemy.updateAnimation(deltaMs, enemy.isMoving());
    this.drawDebugHitboxes(enemy);
    if (enemy.isDown || enemy.afflictions.isFrozen || enemy.afflictions.inVortex) {
      return;
    }
    const inReach = Math.abs(enemy.x - ally.x) <= meleeReach + 2;
    if (enemyArchetype(enemy.kind).detonates) {
      if (inReach) {
        this.actions.detonate(enemy);
      }
      return;
    }
    if (inReach && enemy.canAttack()) {
      enemy.faceTowards(ally.x);
      enemy.playAttackAnimation(() => {
        if (ally.isAlive() && Math.abs(enemy.x - ally.x) <= enemy.strikeReach) {
          meleeBlow(ally, rollDamage(enemyDamage(enemy.kind, 'melee', 'bowman')) * this.world.enemyEdge.damage, enemy.x, this.world.effects);
        }
      });
    }
    enemy.clearHitTint();
  }

  /**
   * Banners: walks to `goalX` (home with a banner, or to a fallen one) fighting only in defence: a soldier or bowman
   * within reach stops it, and it strikes him standing where it is.
   */
  private walkOnGuard(enemy: Enemy, goalX: number, deltaMs: number): void {
    const melee = nearestMeleeTarget(this.world.bowmen, this.world.allies, enemy.x);
    const foe = melee?.ally ?? melee?.bowman;
    const reach = (enemy.reach?.bowman ?? MELEE_REACH) + 2;
    const engaged = foe !== undefined && Math.abs(foe.x - enemy.x) <= reach && Math.abs(foe.y - enemy.y) <= 45;
    const toX = engaged ? enemy.x : goalX;
    // A carrier sets his banner in the ground to fight and takes it up again once he's done.
    if (engaged) {
      enemy.banner.plant(enemy, foe.x);
    } else if (!enemy.isAttacking) {
      enemy.banner.lift();
    }
    enemy.target = melee?.ally ? 'ally' : 'bowman';
    enemy.update(deltaMs, { x: toX, y: groundAt(toX) }, 2);
    enemy.updateAnimation(deltaMs, enemy.isMoving());
    this.drawDebugHitboxes(enemy);
    if (!engaged || enemy.isDown || enemy.afflictions.isFrozen || enemy.afflictions.inVortex || !enemy.canAttack()) {
      enemy.clearHitTint();
      return;
    }
    enemy.faceTowards(foe.x);
    const damage = rollDamage(enemyDamage(enemy.kind, 'melee', 'bowman')) * this.world.enemyEdge.damage;
    if (melee?.ally) {
      const ally = melee.ally;
      enemy.playAttackAnimation(() => {
        if (ally.isAlive() && Math.abs(enemy.x - ally.x) <= enemy.strikeReach) {
          meleeBlow(ally, damage, enemy.x, this.world.effects);
        }
      });
    } else if (melee?.bowman) {
      const bowman = melee.bowman;
      enemy.playAttackAnimation(() => {
        if (!bowman.isInTower && !bowman.isDead && Math.abs(enemy.x - bowman.x) <= enemy.strikeReach && Math.abs(enemy.y - bowman.y) <= 45 * enemy.size) {
          this.events.bowmanDamaged(bowman, damage, { cause: 'melee', fromX: enemy.x });
          this.world.effects.bloodBurst({ x: bowman.x, y: bowman.y - 20 });
        }
      });
    }
    enemy.clearHitTint();
  }

  /**
   * A soldier (not a kamikaze) facing the bombs about to go off (beginFrame): one it noticed sends it beyond their blast
   * (`awayRight`: to the right of it), shouting "!"; one it missed it never heeds (systems/blastAwareness.ts).
   */
  private heedBombs(enemy: Enemy, awayRight: boolean, deltaMs: number): DodgeStep {
    if (enemyArchetype(enemy.kind).detonates) {
      return { kind: 'free' };
    }
    let dodge = this.dodges.get(enemy);
    if (!dodge) {
      dodge = new BlastDodge<Enemy>();
      this.dodges.set(enemy, dodge);
    }
    const { blastAwareness } = enemyTraits(enemy.kind);
    const miss = (): number => missChance({ awareness: blastAwareness, healthRatio: enemy.getHealthRatio(), buffed: enemy.buff.kind !== undefined, busy: enemy.isAttacking });
    return dodge.update(enemy.x, awayRight, this.bombs.kamikazes, this.bombs.zones, miss, deltaMs);
  }

  /** A troll's wounds close unless it burns (systems/regeneration.ts); each step reaches the guest as a heal event. */
  private regenerate(enemy: Enemy, deltaMs: number): void {
    const { afflictions } = enemy;
    const step = regenStep(this.regen.get(enemy) ?? REGEN_START, deltaMs, { burnMs: afflictions.burnMs, paused: afflictions.isFrozen }, REGEN);
    this.regen.set(enemy, step.state);
    if (step.heal > 0 && enemy.missingHealth > 0) {
      enemy.heal(step.heal);
    }
  }

  /** Survival's end: it runs (or flies) off the field's right edge without a fight and escapes there. */
  private runOff(enemy: Foe, deltaMs: number): void {
    if (enemy instanceof DragonEnemy) {
      enemy.flyOff(deltaMs);
      enemy.updateAnimation(deltaMs);
      return;
    }
    const escapeX = worldWidth() + PRIEST_ESCAPE_BEYOND;
    enemy.target = 'bowman';
    enemy.update(deltaMs, { x: escapeX + PRIEST_POST_SLACK, y: groundAt(worldWidth()) });
    enemy.updateAnimation(deltaMs, enemy.isMoving());
    enemy.clearHitTint();
    if (enemy.x >= escapeX) {
      enemy.escape();
    }
  }

  private drawDebugHitboxes(enemy: Foe): void {
    if (!SHOW_HITBOX_DEBUG) {
      return;
    }
    const { debug } = this.world;
    // Yellow: headshot zones, red: normal hits, orange: a horse's legs.
    foeHitBoxes(enemy).forEach(({ bounds, headshot, leg }) => {
      debug.rect(bounds.x, bounds.y, bounds.width, bounds.height).stroke({ width: 1, color: headshot ? 0xffd23f : leg ? 0xff9a3c : 0xff5555, alpha: 0.9 });
    });
  }
}
