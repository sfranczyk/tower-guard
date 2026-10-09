import {
  BOWMAN_MASS,
  BURN_TICK_MS,
  ENEMY_BURN_DPS,
  FIRE_PATCH_MS,
  FIRE_PATCH_RADIUS,
  FIRE_SPREAD_CHANCE,
  FIRE_SPREAD_RADIUS,
  VORTEX,
} from '../config';
import type { SoundId } from '../audio/SoundManager';
import type { MountPart } from '../data/enemies';
import { enemyArchetype, enemyMass } from '../data/enemyKinds';
import Bowman from '../objects/bowman/Bowman';
import DragonEnemy from '../objects/dragon/DragonEnemy';
import type Enemy from '../objects/enemy/Enemy';
import type { ProjectileType, Vec2 } from '../types';
import type { BowmanHit } from './bowmanDeath';
import {
  VORTEX_CORE, VORTEX_SPIN, fallDamage, flingVelocity, funnelCeiling, funnelPosition, levitateHeight, levitateShare, massPace, resistsVortex, throwVelocity,
  vortexPull, vortexRise, vortexStrength,
} from './vortex';
import type { EffectsSystem } from './EffectsSystem';
import { groundAt } from './terrain';

type Foe = Enemy | DragonEnemy;
/**
 * What a vortex can catch, a fire patch set alight: a ground enemy, or (friendly fire) a bowman out in the open. Both
 * have the same afflictions (AfflictionLayer) and the same hold, throw and pin (`holdInVortex`, `throwInAir`,
 * `onLanded`, `isPinned`; systems/bodyMotion.ts); only what hurts them differs (an enemy's own health, a bowman's
 * through the scene).
 */
type Walker = Enemy | Bowman;

/** How heavy it is for a vortex (1 = a man): an enemy's race and variant, a bowman BOWMAN_MASS. */
const massOf = (body: Walker): number => (body instanceof Bowman ? BOWMAN_MASS : enemyMass(body.kind));

/** How far an enemy being pulled in leans into it at full strength (radians). */
const VORTEX_LEAN = 0.32;
/** How far the lifted ones rock to and fro as they go round (radians). */
const FUNNEL_TUMBLE = 0.9;
/** Thrown enemies tumble this fast (radians/s) on the way up. */
const THROW_SPIN: readonly [number, number] = [8, 14];
/** Landing this hard (damage) makes them cry out. */
const GROAN_DAMAGE = 4;

/** An enemy a vortex has hold of: still being pulled in, or going up the funnel (`height` px, `angle` round it). */
interface Caught {
  phase: 'pull' | 'rise';
  height: number;
  angle: number;
}

interface Vortex {
  x: number;
  ageMs: number;
  caught: Map<Walker, Caught>;
  /**
   * The enemy the arrow hit: it levitates straight up (at `x`) instead of being caught in the funnel, `boost` px
   * higher (easing towards `boostTarget`) for every further vortex arrow that hits it.
   */
  levitating?: { enemy: Walker; x: number; boost: number; boostTarget: number };
}

/** A levitating enemy sways this much (radians) as it hangs in the air. */
const LEVITATE_SWAY = 0.25;
/** Dropped when the vortex dies away, it drifts sideways at most this fast (px/s). */
const LEVITATE_DRIFT = 30;
/** How quickly a levitating enemy rises to a boost (1/s). */
const BOOST_RATE = 3;
/** A rider pulled out of the saddle starts levitating from this high (px; Enemy.liftFromSaddle). */
const SADDLE_LIFT = 22;

export interface ArrowMagicHooks {
  /** A kamikaze thrown by a vortex goes off where it lands (CombatSystem.detonate). */
  detonate(kamikaze: Enemy): void;
  /** Kills a frozen enemy by shattering it (CombatSystem.shatter). */
  shatter(enemy: Enemy, fromX: number): void;
  sound(id: SoundId, at: Vec2): void;
  /** Friendly fire: a bowman is hurt (a fall) or catches fire, or his ice breaks (landing frozen). */
  hurtBowman(bowman: Bowman, amount: number, hit: BowmanHit): void;
  bowmanIgnited(bowman: Bowman): void;
  breakIce(bowman: Bowman): void;
}

/** The arrows ArrowMagic handles. */
export const isMagicArrow = (type: ProjectileType): type is 'fire' | 'frost' | 'vortex' => type === 'fire' || type === 'frost' || type === 'vortex';

/**
 * What the fire, frost and vortex arrows do in the battle (the co-op host runs it; the guest sees the
 * afflictions in snapshots and the visuals as effects): setting enemies alight (and the fire spreading and the
 * burn hurting), chilling and freezing, fires left in the ground, and vortices pulling enemies in, lifting them up
 * and throwing them out (they take damage from the landing; a kamikaze goes off, a frozen one shatters).
 */
export class ArrowMagic {
  private patches: Array<{ x: number; msLeft: number }> = [];
  private vortices: Vortex[] = [];
  /** Horses whose riders a vortex pulled out of the saddle: bolting, slowed by the wind while in a vortex's reach. */
  private fleeing: Enemy[] = [];
  private burnClockMs = 0;

  public constructor(private readonly effects: EffectsSystem, private readonly hooks: ArrowMagicHooks) {}

  /**
   * A fire, frost or vortex arrow hit `enemy` (its damage is already dealt): the fire sets it alight (a corpse
   * burns too), frost chills or freezes the living, a vortex opens on the ground under it. With friendly fire a
   * bowman it hits gets the same. A vortex arrow in a mounted knight's rider (`part`) pulls him out of the saddle.
   */
  public hitEnemy(type: ProjectileType, enemy: Foe | Bowman, headshot: boolean, impact: Vec2, part?: MountPart): void {
    if (type === 'fire') {
      this.effects.fireBurst(impact);
      this.ignite(enemy);
    } else if (type === 'frost') {
      this.effects.frostBurst(impact);
      const froze = enemy instanceof Bowman ? enemy.chill(headshot) : enemy.isAlive() && enemy.afflictions.chill(headshot);
      if (froze) {
        this.hooks.sound('shrapnelBurst', impact);
      }
    } else if (type === 'vortex') {
      if (enemy instanceof DragonEnemy) {
        // Up in the air: a ring of wind swirls round it and throws it about (no vortex on the ground).
        if (enemy.isAlive()) {
          enemy.afflictions.stir();
          this.hooks.sound('shrapnelBurst', impact);
        }
      } else if (!enemy.isAlive()) {
        this.openVortex(enemy.x);
      } else if (!(enemy instanceof Bowman) && enemy.rides && part === 'rider') {
        this.unseat(enemy);
      } else {
        const held = this.vortices.find((other) => other.levitating?.enemy === enemy)?.levitating;
        if (held) {
          // Already levitating: it goes up higher still.
          held.boostTarget += VORTEX.levitateBoost;
          this.hooks.sound('shrapnelBurst', impact);
          return;
        }
        // The one it hits levitates; the vortex opens under it for the others.
        this.vortices.forEach((other) => other.caught.delete(enemy));
        this.openVortex(enemy.x, enemy);
      }
    }
  }

  /** A magic arrow in the ground: the fire keeps burning there, frost puffs, a vortex opens. */
  public groundImpact(type: ProjectileType, point: Vec2): void {
    if (type === 'fire') {
      this.effects.firePatch(point);
      this.patches.push({ x: point.x, msLeft: FIRE_PATCH_MS });
    } else if (type === 'frost') {
      this.effects.frostBurst(point);
    } else if (type === 'vortex') {
      this.openVortex(point.x);
    }
  }

  /** A fire or frost arrow against the enemy keep's stone: a burst of flame or frost (a vortex arrow does nothing there). */
  public wallImpact(type: ProjectileType, point: Vec2): void {
    if (type === 'fire') {
      this.effects.fireBurst(point);
    } else if (type === 'frost') {
      this.effects.frostBurst(point);
    }
  }

  /**
   * Fires in the ground, vortices and the burning (`living`: the enemies still in the fight; `bowmen`: with
   * friendly fire, the bowmen out in the open, caught and set alight like the enemies).
   */
  public update(deltaMs: number, living: readonly Foe[], bowmen: readonly Bowman[] = []): void {
    const walkers: Walker[] = [
      ...living.filter((enemy): enemy is Enemy => !(enemy instanceof DragonEnemy) && enemy.isAlive()),
      ...bowmen.filter((bowman) => !bowman.isDead && !bowman.isInTower),
    ];
    // Fire in the ground sets alight whoever walks through it.
    this.patches = this.patches.filter((patch) => {
      patch.msLeft -= deltaMs;
      walkers.filter((walker) => Math.abs(walker.x - patch.x) <= FIRE_PATCH_RADIUS && !walker.afflictions.isBurning)
        .forEach((walker) => this.ignite(walker));
      return patch.msLeft > 0;
    });
    this.vortices = this.vortices.filter((vortex) => this.updateVortex(vortex, deltaMs, walkers));
    if (this.vortices.length === 0) {
      this.fleeing = [];
    }
    this.burnClockMs += deltaMs;
    while (this.burnClockMs >= BURN_TICK_MS) {
      this.burnClockMs -= BURN_TICK_MS;
      this.burnTick(living, walkers);
    }
  }

  /** Every BURN_TICK_MS: the burning take their damage, and the fire may catch on those right next to them (a bowman burns by his own clock). */
  private burnTick(living: readonly Foe[], walkers: readonly Walker[]): void {
    const burning = living.filter((enemy) => enemy.isAlive() && enemy.afflictions.isBurning);
    burning.forEach((enemy) => enemy.takeDamage((ENEMY_BURN_DPS * BURN_TICK_MS) / 1000, { cause: 'burn', fromX: enemy.x }));
    burning.filter((enemy): enemy is Enemy => !(enemy instanceof DragonEnemy)).forEach((source) => {
      walkers
        .filter((other) => other !== source && !other.afflictions.isBurning && Math.abs(other.x - source.x) <= FIRE_SPREAD_RADIUS)
        .forEach((other) => {
          if (Math.random() < FIRE_SPREAD_CHANCE) {
            this.ignite(other);
          }
        });
    });
  }

  /** Sets an enemy (a corpse too) or a bowman alight. */
  private ignite(body: Foe | Bowman): void {
    if (!(body instanceof Bowman)) {
      body.afflictions.ignite();
    } else if (!body.isDead && body.ignite()) {
      this.hooks.bowmanIgnited(body);
    }
  }

  /**
   * A vortex arrow hit a mounted knight's rider: he's pulled up out of the saddle and levitates over the vortex it opens,
   * from saddle height; his horse bolts (slowed while in a vortex's reach).
   */
  private unseat(mounted: Enemy): void {
    const rider = mounted.unseat();
    this.fleeing.push(mounted);
    this.openVortex(rider?.x ?? mounted.x, rider, SADDLE_LIFT);
  }

  /** Opens a vortex at `x`; `levitating` (the one the arrow hit) levitates over it, starting `startHeight` px up. */
  private openVortex(x: number, levitating?: Walker, startHeight = 0): void {
    this.effects.vortex({ x, y: groundAt(x) });
    // The levitation's boost is scaled by its share (vortex.levitateHeight): this much starts it at `startHeight`.
    const boost = levitating ? startHeight / levitateShare(massOf(levitating)) : 0;
    this.vortices.push({
      x, ageMs: 0, caught: new Map(), levitating: levitating ? { enemy: levitating, x: levitating.x, boost, boostTarget: boost } : undefined,
    });
    this.hooks.sound('shrapnelBurst', { x, y: groundAt(x) });
  }

  /**
   * Catches the ground enemies in reach, pulls them to the centre, lifts them up the funnel and throws them out at
   * the top; once its time is up it dies away. Returns false then.
   */
  private updateVortex(vortex: Vortex, deltaMs: number, walkers: readonly Walker[]): boolean {
    vortex.ageMs += deltaMs;
    if (vortex.ageMs >= VORTEX.ms) {
      this.dieAway(vortex);
      return false;
    }
    const strength = vortexStrength(vortex.ageMs);
    const { caught, levitating } = vortex;
    if (levitating) {
      const { enemy } = levitating;
      if (!enemy.isAlive() || enemy.isDown || enemy.isPinned) {
        vortex.levitating = undefined;
      } else {
        // Straight up, glowing, swaying a little (and higher with every further hit).
        levitating.boost += (levitating.boostTarget - levitating.boost) * Math.min(1, (BOOST_RATE * deltaMs) / 1000);
        const height = levitateHeight(vortex.ageMs, massOf(enemy), levitating.boost);
        enemy.holdInVortex(levitating.x, height, Math.sin(vortex.ageMs / 420) * LEVITATE_SWAY, true);
      }
    }
    // Knocked down, pinned or killed: it lets go (a dead one falls).
    caught.forEach((_, enemy) => {
      if (!enemy.isAlive() || enemy.isDown || enemy.isPinned) {
        caught.delete(enemy);
      }
    });
    const inReach = (enemy: Walker): boolean => Math.abs(enemy.x - vortex.x) <= VORTEX.radius;
    // Brutes are too heavy to be caught: the wind only slows them down (and a horse bolting from it).
    [...walkers.filter((enemy) => resistsVortex(massOf(enemy))), ...this.fleeing]
      .filter((enemy) => inReach(enemy) && strength > 0)
      .forEach((enemy) => enemy.afflictions.slowByWind(VORTEX.heavyWalk));
    walkers
      .filter((enemy) => !resistsVortex(massOf(enemy)) && !caught.has(enemy) && !enemy.isDown && !enemy.isPinned && inReach(enemy))
      .filter((enemy) => !this.vortices.some((other) => other.caught.has(enemy) || other.levitating?.enemy === enemy))
      .forEach((enemy) => caught.set(enemy, { phase: 'pull', height: 0, angle: 0 }));

    caught.forEach((state, enemy) => {
      const mass = massOf(enemy);
      if (state.phase === 'pull') {
        const dx = enemy.x - vortex.x;
        const x = enemy.x + vortexPull(dx, vortex.ageMs, deltaMs, mass);
        if (Math.abs(x - vortex.x) <= VORTEX_CORE) {
          // Caught by the funnel: up it goes, starting on the side it came from.
          state.phase = 'rise';
          state.angle = dx >= 0 ? 0 : Math.PI;
        }
        enemy.holdInVortex(x, 0, -Math.sign(dx) * VORTEX_LEAN * strength);
        return;
      }
      // Too heavy to reach the top, it circles as high as it gets until the vortex lets go (and slower, the heavier).
      const ceiling = funnelCeiling(mass);
      state.height = Math.min(ceiling, state.height + vortexRise(deltaMs, mass) * strength);
      state.angle += (VORTEX_SPIN * Math.min(1, massPace(mass)) * deltaMs) / 1000;
      if (ceiling >= VORTEX.top && state.height >= VORTEX.top) {
        // Out of the top: thrown up and away on the side it's going round on.
        caught.delete(enemy);
        this.launch(enemy, throwVelocity(Math.cos(state.angle) >= 0 ? 1 : -1, Math.random(), Math.random(), mass));
        return;
      }
      const position = funnelPosition({ x: vortex.x, y: groundAt(vortex.x) }, state.height, state.angle);
      enemy.holdInVortex(position.x, groundAt(position.x) - position.y, Math.sin(state.angle) * FUNNEL_TUMBLE);
    });
    return true;
  }

  /**
   * The vortex dies away: it flings out the ones it hasn't thrown yet, away from its centre, and drops the one it
   * held up (that one takes VORTEX.levitateFall of the fall damage).
   */
  private dieAway(vortex: Vortex): void {
    this.effects.vortexFade({ x: vortex.x, y: groundAt(vortex.x) });
    const held = vortex.levitating?.enemy;
    if (held?.isAlive() && !held.isDown) {
      this.launch(held, { x: (Math.random() * 2 - 1) * LEVITATE_DRIFT, y: 0 }, VORTEX.levitateFall);
    }
    vortex.caught.forEach((state, enemy) => {
      if (enemy.isAlive()) {
        this.launch(enemy, flingVelocity(enemy.x - vortex.x, state.phase === 'rise', Math.random(), Math.random(), massOf(enemy)));
      }
    });
    vortex.caught.clear();
  }

  /** Throws `enemy` through the air; when it lands it takes the fall (× `damageScale`, see landed). */
  private launch(enemy: Walker, velocity: Vec2, damageScale = 1): void {
    const spin = Math.sign(velocity.x || 1) * (THROW_SPIN[0] + Math.random() * (THROW_SPIN[1] - THROW_SPIN[0]));
    enemy.throwInAir(velocity.x, velocity.y, spin);
    enemy.onLanded = (impactSpeed) => this.landed(enemy, impactSpeed, damageScale);
  }

  /**
   * A thrown enemy hits the ground: a kamikaze goes off, a frozen one shatters, the rest take the fall's damage. A
   * bowman takes the fall too (frozen, his ice breaks first).
   */
  private landed(enemy: Walker, impactSpeed: number, damageScale: number): void {
    const point = { x: enemy.x, y: groundAt(enemy.x) - 4 };
    this.effects.impact(point);
    if (!enemy.isAlive()) {
      return;
    }
    if (enemy instanceof Bowman) {
      if (enemy.isFrozen) {
        this.hooks.breakIce(enemy);
      }
      const damage = fallDamage(impactSpeed) * damageScale;
      if (damage > 0) {
        this.hooks.hurtBowman(enemy, damage, { cause: 'fall', fromX: enemy.x });
      }
      if (damage >= GROAN_DAMAGE) {
        this.hooks.sound('groan', point);
      }
      return;
    }
    if (enemyArchetype(enemy.kind).detonates) {
      this.hooks.detonate(enemy);
    } else if (enemy.afflictions.isFrozen) {
      this.hooks.shatter(enemy, enemy.x);
    } else {
      const damage = fallDamage(impactSpeed) * damageScale;
      if (damage > 0) {
        enemy.takeDamage(damage, { cause: 'fall', fromX: enemy.x });
      }
      if (damage >= GROAN_DAMAGE) {
        this.hooks.sound('groan', point);
      }
    }
  }
}
