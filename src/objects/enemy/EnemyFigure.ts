import { Graphics } from 'pixi.js';
import { KAMIKAZE_GIB_FORCE, PLAYER_TOWER_X, WORLD_WIDTH } from '../../config';
import { toArcherLocalAngle } from '../../rendering/archer';
import { MARCH_STRIDE_PER_RADIAN, WALK_STRIDE_PER_RADIAN } from '../../rendering/stickman';
import { RUN_STRIDE_PER_RADIAN } from '../../rendering/runCycle';
import { FALL_DURATION_MS, getFallPose, type FallKind, type FallPose } from '../../rendering/stickmanFall';
import { getCheerPose } from '../../rendering/stickmanCheer';
import { getPinnedPose } from '../../rendering/stickmanPinned';
import { getFlailPose } from '../../rendering/stickmanFlail';
import { GibSimulation } from '../../rendering/stickmanGibs';
import { drawEnemyBody, drawEnemyGibs, type EnemyBodyState } from '../../rendering/enemyBody';
import { STANDING_BURN_POINTS, burnPoints } from '../../rendering/burning';
import { FROZEN_TINT } from '../../rendering/afflictionArt';
import { mountedBodyPoints, mountedIcePoints } from '../../rendering/horseHitZones';
import { spriteToContainer, worldToSprite, type BodyTransform, type Torso } from '../../systems/bodyAnchor';
import { enemyArchetype } from '../../data/enemyKinds';
import { groundAt } from '../../systems/terrain';
import type { Vec2 } from '../../types';
import type Enemy from './Enemy';
import { torsoOf } from './enemyHitShape';
import { KNOCKDOWN_LIE_MS, fallProgress, startFallState, stepFall, type FallState } from './enemyFall';

/** Body sprite scale (x is mirrored by facing). */
export const BODY_SCALE = { x: 0.5, y: 0.52 };
const BODY_ORIGIN_Y = -25;
/** Pushed or thrown enemies stay this far inside the world and out of the player's keep. */
const PUSH_MARGIN = 30;
export const FIELD = { min: PLAYER_TOWER_X + PUSH_MARGIN, max: WORLD_WIDTH - PUSH_MARGIN } as const;
/** Explosive kills throw the pieces with a random force in this range (the lab uses 1). */
const GIB_FORCE_MIN = 1;
const GIB_FORCE_MAX = 1.7;
/** Blown apart up in the air: the pieces' frame drops back to the ground this fast (px/s²). */
const DROP_GRAVITY = 1400;
/** A thrown enemy lands into the knockback this far through it (hitting the ground on its back). */
const LANDING_PROGRESS = 0.72;
/** Lifted this high (px) in a vortex, it flails. */
const FLAIL_LIFT = 4;
/** Drawn over the vortex while levitating (the vortex is at 3). */
const LEVITATE_Z = 4;
/** Flames and frost glints in container units (the bowman's at his scale, to match). */
const AFFLICTION_SIZE = 0.5;
const RUN_LEAN = 0.14;

/**
 * An enemy's drawn body: its look in the state it is in (walking, swinging, casting, cheering, pinned, flailing in a
 * vortex, flying, falling, blown apart), the falls' clock, and the body's transform for hit shapes and stuck arrows.
 * A mounted knight's horse side is MountedRider's.
 */
export class EnemyFigure {
  public readonly body = new Graphics();
  /** A playing fall (death, knockdown, getting up). */
  public fall?: FallState;
  /** Set when blown apart (or shattered). */
  public gibs?: GibSimulation;
  private animationTime = 0;
  /** Always-running clock for the look's own motion (a burning fuse, flapping cloth). */
  private lookTimeMs = Math.random() * 1000;
  /** Walk/run cycle phase: advances with the distance covered, so the feet stay planted at any speed. */
  private stridePhase = 0;
  /** Clock of the pinned struggle (stickmanPinned), from when the pin went in. */
  private struggleMs = 0;
  /** Killed while frozen: its pieces are ice. */
  private shattered = false;
  /** Pieces dropping back to the ground after being blown apart in the air (px/s). */
  private dropSpeed = 0;
  /** A settled corpse has been drawn as it rests (isSettledCorpse): it isn't redrawn again. */
  private settledDrawn = false;

  public constructor(private readonly enemy: Enemy) {}

  /** +1 facing right, −1 left. */
  public get facing(): number {
    return Math.sign(this.body.scale.x) || -1;
  }

  /** Turns the body to face `direction` (±1). */
  public face(direction: number): void {
    this.body.scale.x = direction * BODY_SCALE.x;
  }

  /** Draws the body in this enemy's look (rendering/enemyBody) in the given state. */
  public draw(state: EnemyBodyState): void {
    drawEnemyBody(this.body, this.enemy.kind, state, BODY_ORIGIN_Y, this.lookTimeMs);
  }

  /** The first drawing, standing (on its horse) and facing left. */
  public drawPlaceholder(): void {
    if (this.enemy.rider) {
      this.enemy.rider.draw('stand', { thrust: 0 });
    } else {
      this.drawStanding();
    }
    this.body.position.set(0, -29);
    this.body.scale.set(-BODY_SCALE.x, BODY_SCALE.y);
  }

  /** The pin just went in: the struggle starts over. */
  public startStruggle(): void {
    this.struggleMs = 0;
  }

  /** Animation phase for standing poses (zombie arm sway, kamikaze fuse flicker). */
  private get walkPhase(): number {
    return this.animationTime / (this.enemy.look.stepMs ?? 150);
  }

  /** Club fighters carry a club (their archetype); archers, kamikazes and zombies don't. */
  private get carriesClub(): boolean {
    return enemyArchetype(this.enemy.kind).club;
  }

  /** Standing still (an archer with its bow as it is now), upright. */
  private drawStanding(): void {
    this.body.rotation = 0;
    this.draw(this.enemy.isArcher ? this.archerState() : { mode: 'stand', phase: this.walkPhase });
  }

  /** An archer's bow state (upright sprite, so the aim needs no lean correction); `walkPhase` while walking. */
  private archerState(walkPhase?: number): EnemyBodyState {
    const { aimAngle, tension, ready } = this.enemy.bow;
    return { mode: 'archer', localAngle: toArcherLocalAngle(aimAngle, 0, this.facing), tension, ready, walkPhase };
  }

  /**
   * Counts the afflictions down (real time), plays the animation at their pace (slowed when chilled, held when
   * frozen) and draws them over the body.
   */
  public update(deltaMs: number, moving: boolean): void {
    const { enemy } = this;
    const { afflictions } = enemy;
    afflictions.tick(deltaMs);
    // A corpse at rest stays as it was last drawn (no redrawing every frame).
    if (this.isSettledCorpse) {
      if (this.settledDrawn) {
        return;
      }
      this.settledDrawn = true;
    } else {
      this.settledDrawn = false;
    }
    // Held up by a vortex arrow, it glows in front of the funnel.
    enemy.zIndex = afflictions.levitating ? LEVITATE_Z : 1;
    if (enemy.motion.isThrown) {
      this.updateFlight(deltaMs);
      return;
    }
    if (this.gibs) {
      this.dropToGround(deltaMs);
      this.gibs.step(deltaMs);
      this.lookTimeMs += deltaMs;
      drawEnemyGibs(this.body, enemy.kind, this.gibs, BODY_ORIGIN_Y, this.lookTimeMs);
      this.body.tint = this.shattered ? FROZEN_TINT : 0xffffff;
      afflictions.art.clear();
      return;
    }
    const lifted = !enemy.rides && afflictions.inVortex && afflictions.lift > FLAIL_LIFT && !this.fall && !afflictions.isFrozen;
    if (lifted) {
      // Off its feet in the funnel: flailing, tumbling round.
      this.lookTimeMs += deltaMs;
      this.draw({ mode: 'joints', pose: getFlailPose(this.lookTimeMs), club: this.carriesClub });
      this.body.rotation = afflictions.lean;
    } else {
      this.animate(deltaMs * afflictions.timeScale, moving);
      if (afflictions.inVortex && !this.fall) {
        // Leaning into the pull, flailing a little.
        this.body.rotation += afflictions.lean + Math.sin(this.lookTimeMs / 90) * 0.06;
      }
    }
    this.body.tint = afflictions.tint;
    const horse = enemy.rider?.pose;
    if (horse) {
      afflictions.draw(this.afflictionPoints(mountedBodyPoints(horse)), AFFLICTION_SIZE, this.afflictionPoints(mountedIcePoints(horse)));
      return;
    }
    afflictions.draw(this.afflictionPoints(this.fall || lifted ? undefined : STANDING_BURN_POINTS), AFFLICTION_SIZE, this.afflictionPoints(STANDING_BURN_POINTS));
  }

  /**
   * Flying (thrown by a vortex): falls, tumbles, flails (a frozen one flies as a block of ice) and lands on its back
   * into the knockback (a living one gets up later); then onLanded.
   */
  private updateFlight(deltaMs: number): void {
    const { enemy } = this;
    const { vx } = enemy.motion.flight!;
    this.lookTimeMs += deltaMs;
    // A co-op guest's living enemy flies where the host has it (it only tumbles and lands it here).
    const driven = enemy.motion.fromNet && enemy.isAlive();
    const step = enemy.motion.step(deltaMs, FIELD.min, FIELD.max, driven);
    if (step.landed) {
      this.land(vx, step.impactSpeed);
      return;
    }
    const { flight } = step;
    enemy.position.set(flight.x, flight.y);
    if (enemy.rider) {
      enemy.rider.draw('stand', { thrust: 0 });
    } else if (enemy.afflictions.isFrozen) {
      this.draw({ mode: 'stand', phase: 0 });
    } else {
      this.draw({ mode: 'joints', pose: getFlailPose(this.lookTimeMs), club: this.carriesClub });
    }
    this.body.rotation = flight.rotation;
    this.body.tint = enemy.afflictions.tint;
    enemy.afflictions.draw(this.afflictionPoints(), AFFLICTION_SIZE, this.afflictionPoints(STANDING_BURN_POINTS));
  }

  /** Hits the ground on its back, sliding on the way it flew; a living one gets up after a while. */
  private land(vx: number, impactSpeed: number): void {
    const { enemy } = this;
    const landed = enemy.motion.endFlight();
    enemy.y = groundAt(enemy.x);
    this.body.rotation = 0;
    // Falls backwards away from `fromX`: put that behind where it came from (a horse lands on its hooves).
    if (!enemy.rides) {
      this.startFall('knockback', enemy.x - Math.sign(vx || 1), enemy.isAlive() ? KNOCKDOWN_LIE_MS : undefined);
    }
    if (this.fall) {
      this.fall.timeMs = FALL_DURATION_MS.knockback * LANDING_PROGRESS;
      this.drawFall();
    }
    landed?.(impactSpeed);
  }

  /** Blown apart up in the air: the pieces' frame drops back to the ground. */
  private dropToGround(deltaMs: number): void {
    const { enemy } = this;
    const ground = groundAt(enemy.x);
    if (enemy.y >= ground) {
      this.dropSpeed = 0;
      return;
    }
    this.dropSpeed += (DROP_GRAVITY * deltaMs) / 1000;
    enemy.y = Math.min(ground, enemy.y + (this.dropSpeed * deltaMs) / 1000);
  }

  /** Body points (where flames burn and frost glints) in container space: the fall pose's joints, or `standing`. */
  private afflictionPoints(standing?: readonly Vec2[]): Vec2[] {
    const pose = this.jointPose();
    return spriteToContainer(standing ?? (pose ? burnPoints(pose) : STANDING_BURN_POINTS), this.body);
  }

  private animate(deltaMs: number, moving: boolean): void {
    const { enemy } = this;
    const { actions } = enemy;
    this.lookTimeMs += deltaMs;
    enemy.bars.place(this.body, enemy.rides, this.fall);
    if (this.fall) {
      // Dead enemies keep playing (then holding) their death; survivors get back up.
      this.updateFall(deltaMs);
      return;
    }
    if (enemy.rider) {
      enemy.rider.animate(deltaMs, moving);
      return;
    }
    if (!enemy.isAlive()) {
      return;
    }

    const cheer = actions.advanceCheer(deltaMs);
    if (cheer) {
      this.body.scale.set(-BODY_SCALE.x, BODY_SCALE.y);
      this.body.rotation = 0;
      this.draw({ mode: 'joints', pose: getCheerPose(cheer.kind, cheer.timeMs), club: this.carriesClub });
      return;
    }

    if (actions.casting) {
      const progress = actions.advanceCast(deltaMs);
      this.body.rotation = 0;
      this.draw({ mode: 'cast', progress });
      return;
    }

    if (actions.swinging) {
      const progress = actions.advanceSwing(deltaMs);
      this.body.rotation = 0;
      this.draw(enemy.isArcher ? this.archerState() : { mode: 'attack', progress, style: actions.style });
      return;
    }

    // Pinned by one foot: lunges, gets yanked back, looks down at it, tries again (an archer still shoots).
    if (enemy.motion.isPinned && !(enemy.isArcher && enemy.bow.ready > 0)) {
      this.struggleMs += deltaMs;
      this.body.rotation = 0;
      this.draw({ mode: 'joints', pose: getPinnedPose(this.struggleMs), club: this.carriesClub });
      return;
    }

    if (!moving) {
      this.drawStanding();
      return;
    }

    const { velocity, look } = enemy;
    this.animationTime += deltaMs;
    this.face(velocity.x < 0 ? -1 : 1);
    const { runs } = look;
    // Stride in world px per radian of phase (bigger bodies take longer strides).
    const walkStride = look.walkStyle === 'march' ? MARCH_STRIDE_PER_RADIAN : WALK_STRIDE_PER_RADIAN;
    const stride = (runs ? RUN_STRIDE_PER_RADIAN : walkStride) * BODY_SCALE.x * enemy.scale.x;
    this.stridePhase += (Math.hypot(velocity.x, velocity.y) * deltaMs) / 1000 / stride;
    if (enemy.isArcher) {
      // Archers walk upright so the bow rig matches the aim (getBowReleasePoint).
      this.body.rotation = 0;
      this.draw(this.archerState(this.stridePhase));
    } else {
      const lean = runs ? RUN_LEAN : 0.06;
      this.body.rotation = velocity.x < 0 ? -lean : lean;
      this.draw({ mode: 'walk', phase: this.stridePhase, running: runs });
    }
  }

  /** Explosive kill (or shattered ice): the body bursts into pieces thrown away from the impact point. */
  public blowApart(fromX: number, point: Vec2, shattered = false): void {
    const { enemy } = this;
    enemy.actions.interrupt();
    enemy.motion.endFlight();
    this.shattered = shattered;
    const facing = fromX >= enemy.x ? 1 : -1;
    this.fall = undefined;
    this.body.rotation = 0;
    this.body.y = BODY_ORIGIN_Y;
    this.body.scale.set(BODY_SCALE.x * facing, BODY_SCALE.y);
    const blast = worldToSprite(point, this.transform());
    // A kamikaze's own bomb goes off with it: its pieces fly much farther.
    const bomb = enemyArchetype(enemy.kind).detonates ? KAMIKAZE_GIB_FORCE : 1;
    const force = (GIB_FORCE_MIN + Math.random() * (GIB_FORCE_MAX - GIB_FORCE_MIN)) * bomb;
    this.gibs = new GibSimulation(blast, Math.floor(Math.random() * 1e9), force);
    drawEnemyGibs(this.body, enemy.kind, this.gibs, BODY_ORIGIN_Y, this.lookTimeMs);
  }

  /** Turns to face the hit (so backwards falls go away from it) and starts a fall animation. */
  public startFall(kind: FallKind, fromX: number, getUpAfterMs?: number, push = 0): void {
    this.enemy.actions.stop();
    this.fall = startFallState(kind, fromX, this.enemy.x, getUpAfterMs, push);
    this.body.scale.set(BODY_SCALE.x * this.fall.facing, BODY_SCALE.y);
    this.drawFall();
  }

  /**
   * Dead and done moving: its death fall played to the end (and any push slid), or its pieces at rest on the
   * ground, with nothing burning, icy or held by a vortex on it. Nothing can change it after that.
   */
  private get isSettledCorpse(): boolean {
    const { enemy } = this;
    const { afflictions } = enemy;
    if (enemy.isAlive() || enemy.motion.isThrown || afflictions.isBurning || afflictions.isFrozen || afflictions.isChilled || afflictions.inVortex) {
      return false;
    }
    const mounted = enemy.rider?.settled;
    if (mounted !== undefined) {
      return mounted;
    }
    if (this.gibs) {
      return this.gibs.settled && enemy.y >= groundAt(enemy.x);
    }
    return this.fall !== undefined && this.fall.getUpAfterMs === undefined && fallProgress(this.fall) >= 1;
  }

  private drawFall(): void {
    if (this.fall) {
      this.body.rotation = 0;
      this.draw({ mode: 'joints', pose: getFallPose(this.fall.kind, fallProgress(this.fall)), club: false });
    }
  }

  /** Advances the fall (sliding away from a blast, along the ground); a knocked-down survivor gets up and is moved to where it ended up. */
  private updateFall(deltaMs: number): void {
    const { fall, enemy } = this;
    if (!fall) {
      return;
    }
    const step = stepFall(fall, deltaMs);
    this.fall = step.fall;
    if (fall.push) {
      // It faced the blast, so away is −facing.
      enemy.x = Math.max(FIELD.min, Math.min(FIELD.max, enemy.x - fall.facing * step.slide));
      enemy.y = groundAt(enemy.x);
    }
    if (step.stoodUp) {
      // The get-up ends standing away from where the knockback started; move there for real.
      const endHipX = getFallPose('getUp', 1).hip.x;
      enemy.x += endHipX * BODY_SCALE.x * fall.facing * enemy.scale.x;
      this.drawStanding();
      return;
    }
    this.drawFall();
  }

  /** The joint pose drawn while falling, flying or flailing in a vortex (undefined otherwise). */
  public jointPose(): FallPose | undefined {
    if (this.fall) {
      return getFallPose(this.fall.kind, fallProgress(this.fall));
    }
    const { motion, afflictions } = this.enemy;
    const flailing = motion.isThrown || (afflictions.inVortex && afflictions.lift > FLAIL_LIFT);
    return flailing && !afflictions.isFrozen ? getFlailPose(this.lookTimeMs) : undefined;
  }

  /** Where the body sprite is in the world (hit shapes, stuck arrows, the bow's release point). */
  public transform(): BodyTransform {
    const { body, enemy } = this;
    return {
      x: enemy.x,
      y: enemy.y,
      scale: enemy.scale.x,
      bodyX: body.x,
      bodyY: body.y,
      rotation: body.rotation,
      scaleX: body.scale.x,
      scaleY: body.scale.y,
    };
  }

  /** Hip and shoulder of the pose currently drawn, in body-sprite space; on horseback the horse's back (croup to withers). */
  public torso(): Torso {
    return this.enemy.rider?.torso() ?? torsoOf(this.jointPose(), this.gibs?.pieces[0]);
  }
}
