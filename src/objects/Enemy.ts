import { Container, Graphics } from 'pixi.js';
import { ENEMY_ARCHER_COOLDOWN_MS, ENEMY_ARCHER_DRAW_MS, ENEMY_ATTACK_INTERVAL_MS, KAMIKAZE_GIB_FORCE, PLAYER_TOWER_X, WORLD_WIDTH } from '../config';
import { getArcherRig, toArcherLocalAngle } from '../rendering/archer';
import { attackImpactProgress } from '../rendering/attackSwing';
import { STICKMAN_HEAD, WALK_STRIDE_PER_RADIAN } from '../rendering/stickman';
import { RUN_STRIDE_PER_RADIAN } from '../rendering/runCycle';
import { FALL_DURATION_MS, getFallPose, type FallKind, type FallPose } from '../rendering/stickmanFall';
import { CHEER_KINDS, getCheerPose, type CheerKind } from '../rendering/stickmanCheer';
import { PINNED_FOOT, getPinnedPose } from '../rendering/stickmanPinned';
import { getFlailPose } from '../rendering/stickmanFlail';
import { stepFlight, type Flight } from '../systems/flight';
import { GibSimulation } from '../rendering/stickmanGibs';
import type { BodyColors } from '../rendering/bodyColors';
import { drawEnemyBody, drawEnemyGibs, enemyGibColors, type EnemyBodyState } from '../rendering/enemyBody';
import { fromBodyAnchor, spriteToWorld, toBodyAnchor, worldToSprite, type BodyAnchor, type BodyTransform, type Torso } from '../systems/bodyAnchor';
import { ENEMY_LOOKS, blowsApart, knockbackPush, type EnemyLook } from '../data/enemies';
import { enemyArchetype } from '../data/enemyKinds';
import { groundAt } from '../systems/terrain';
import { STANDING_BURN_POINTS, burnPoints } from '../rendering/burning';
import { FROZEN_TINT } from '../rendering/afflictionArt';
import type { Bounds, EnemyType, Vec2 } from '../types';
import { AfflictionLayer, type AfflictionNet } from './AfflictionLayer';

/** Co-op: a thrown enemy's flight for the guest (its position comes in the snapshot). */
export interface ThrowNet {
  vx: number;
  spin: number;
}

const ATTACK_ANIMATION_DURATION_MS = 1_130;

export type EnemyTarget = 'bowman' | 'tower';

/** What dealt the damage, and from which side, so the right reaction plays. */
export interface HitInfo {
  /**
   * 'blast' = hit directly by an explosive arrow (a kill blows the body apart); 'burn' = a fire arrow's burn;
   * 'shatter' = killed while frozen (it bursts into pieces of ice); 'fall' = landing after a vortex threw it.
   */
  cause: 'arrow' | 'headshot' | 'explosion' | 'blast' | 'lightning' | 'burn' | 'shatter' | 'fall';
  /** World x the hit came from; the enemy turns to face it before falling. */
  fromX: number;
  /** World point of impact (used for 'blast' to throw the pieces away from it). */
  point?: Vec2;
  /** Splash explosions: distance from the blast as a fraction of its radius (0 centre .. 1 edge). */
  blastDistance?: number;
}

/** A playing fall animation. Dead enemies stay in their last frame. */
interface FallState {
  kind: FallKind;
  timeMs: number;
  /** +1: fall-space +x is world +x; −1: mirrored. */
  facing: number;
  /** Knockback only: get up after lying down this long, then fight on. */
  getUpAfterMs?: number;
  /** Knockback only: extra world px it slides away from the blast over the fall, and how much is done. */
  push?: { total: number; applied: number };
}

/** Share (0..1) of a knockback's extra push done at fall progress `p`: mostly in the flight, a little slide. */
const pushShare = (p: number): number => {
  const smooth = (value: number): number => value * value * (3 - 2 * value);
  if (p <= 0.12) {
    return 0.1 * smooth(p / 0.12);
  }
  if (p <= 0.72) {
    return 0.1 + 0.8 * ((p - 0.12) / 0.6);
  }
  return 0.9 + 0.1 * smooth(Math.min(1, (p - 0.72) / 0.28));
};
/** Pushed enemies stay this far inside the world and out of the player's keep. */
const PUSH_MARGIN = 30;

/** Time a knocked-down (surviving) enemy lies on the ground before getting up. */
const KNOCKDOWN_LIE_MS = 450;
/** Body sprite scale (x is mirrored by facing). */
const BODY_SCALE = { x: 0.5, y: 0.52 };
const BODY_ORIGIN_Y = -25;
/** drawStickman's hip and shoulder (sprite space) for walking, standing and attacking. */
/** Health bar size and placement in container space (the container is drawn at 2/3 scale). */
const HEALTH_BAR = { width: 30, height: 4, standingY: -68, aboveHead: 14 };
const STANDING_TORSO: Torso = { hip: { x: 0, y: 0 }, shoulder: { x: 0, y: -35 } };
const BOW_RAISE_MS = 220;
const BOW_LOWER_MS = 400;
/** Explosive kills throw the pieces with a random force in this range (the lab uses 1). */
const GIB_FORCE_MIN = 1;
const GIB_FORCE_MAX = 1.7;
/** Torso piece of a gib simulation is hip→neck top (43); anchors use hip→shoulder (35). */
const TORSO_TO_NECK = 43;
const TORSO_TO_SHOULDER = 35;

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

/** Container scale of a normal-sized enemy (bigger types multiply it by their size). */
const ENEMY_SCALE = 2 / 3;
const RUN_LEAN = 0.14;

export default class Enemy extends Container {
  private readonly body: Graphics;
  private readonly look: EnemyLook;
  private readonly healthBar: Graphics;
  private readonly maxHealth: number;
  private health: number;
  private readonly speed: number;
  private attackCooldown = 0;
  private hitStaggerMs = 0;
  private animationTime = 0;
  /** Always-running clock for the look's own motion (a burning fuse, flapping cloth). */
  private lookTimeMs = Math.random() * 1000;
  /** Walk/run cycle phase: advances with the distance covered, so the feet stay planted at any speed. */
  private stridePhase = 0;
  private attackTimerMs = 0;
  /** Pinned to the ground by a pinning arrow: can't walk until this runs out (it can still swing or shoot). */
  private pinnedMs = 0;
  /** Clock of the pinned struggle (stickmanPinned), from when the pin went in. */
  private struggleMs = 0;
  private velocity = { x: 0, y: 0 };
  private alive = true;
  private fall?: FallState;
  /** Damage to deal when the current swing lands. */
  private pendingImpact?: () => void;
  /** Set when the enemies win: a looping cheer (played at a slightly random tempo). */
  private cheer?: { kind: CheerKind; timeMs: number; tempo: number };
  /** Set when blown apart by a direct explosive hit. */
  private gibs?: GibSimulation;
  /** Archer bow state: raised (0..1), draw tension (0..1), aim angle (world) and time to the next shot. */
  private bowReady = 0;
  private bowTension = 0;
  private aimAngle = Math.PI;
  private bowCooldownMs = 0;
  /** Killed while frozen: its pieces are ice. */
  private shattered = false;
  /** Pieces dropping back to the ground after being blown apart in the air (px/s). */
  private dropSpeed = 0;
  /** A settled corpse has been drawn as it rests (isSettledCorpse): it isn't redrawn again. */
  private settledDrawn = false;
  /** Thrown through the air (a vortex threw it out, or it was hit up there), flailing until it lands. */
  private flight?: Flight;
  /** Co-op guest: the host moves it while it flies (it only lands it here). */
  private flightFromNet = false;
  /** Host: told when it lands from a throw, with the speed it hit the ground at (for the fall damage). */
  public onLanded?: (impactSpeed: number) => void;
  public target: EnemyTarget;
  /** Fire, frost and vortex (fire, frost and vortex arrows): drawn over the body. */
  public readonly afflictions: AfflictionLayer;
  /** Co-op host: hears about every hit and swing, to replay them on the guest's screen. */
  public netHooks?: { damaged(amount: number, hit: HitInfo): void; attacked(): void };

  public constructor(
    x: number,
    health = 3,
    speed = 60,
    target: EnemyTarget = 'bowman',
    public readonly kind: EnemyType = 'basic',
  ) {
    super();
    this.look = ENEMY_LOOKS[kind];
    this.body = new Graphics();
    this.drawPlaceholder();
    this.afflictions = new AfflictionLayer(kind);
    this.addChild(this.body, this.afflictions.art);
    this.healthBar = new Graphics();
    this.addChild(this.healthBar);
    this.health = Math.max(0, health);
    this.maxHealth = Math.max(1, health);
    this.speed = Math.max(0, speed);
    this.target = target;
    this.scale.set(ENEMY_SCALE * this.look.size);
    // The health bar keeps its normal size on big enemies.
    this.healthBar.scale.set(1 / this.look.size);
    this.position.set(x, groundAt(x));
    this.zIndex = 1;
    this.velocity.x = -this.speed;
    this.drawHealthBar();
  }

  /** Ground enemies walk; only dragons fly (lightning strikes the ground, not the sky). */
  public readonly isFlying = false;

  /** Body size (1 = a normal stickman; brutes are 1.5). */
  public get size(): number {
    return this.look.size;
  }

  /** How far the club reaches when it lands (see EnemyLook.strikeReach). */
  public get strikeReach(): number {
    return this.look.strikeReach;
  }

  /** Colours of its pieces when blown apart, and its blood (zombies bleed green). */
  public get bodyColors(): BodyColors {
    return enemyGibColors(this.kind);
  }

  /** Animation phase for standing poses (zombie arm sway, kamikaze fuse flicker). */
  private get walkPhase(): number {
    return this.animationTime / (this.look.stepMs ?? 150);
  }

  /** Club fighters carry a club (their archetype); archers, kamikazes and zombies don't. */
  private get carriesClub(): boolean {
    return enemyArchetype(this.kind).club;
  }

  public get isArcher(): boolean {
    return enemyArchetype(this.kind).shoots;
  }

  /**
   * Archer: face `angle`, raise the bow, draw, and return true on the frame the arrow is released.
   * Call every frame while standing in range; call relaxBow() otherwise.
   */
  public aimBow(angle: number, realDeltaMs: number): boolean {
    // Chilled archers draw slower; frozen or caught in a vortex, not at all.
    const deltaMs = this.afflictions.inVortex ? 0 : realDeltaMs * this.afflictions.timeScale;
    if (deltaMs === 0) {
      return false;
    }
    this.aimAngle = angle;
    this.velocity = { x: 0, y: 0 };
    this.body.scale.x = Math.cos(angle) < 0 ? -BODY_SCALE.x : BODY_SCALE.x;
    this.bowCooldownMs = Math.max(0, this.bowCooldownMs - deltaMs);
    this.bowReady = Math.min(1, this.bowReady + deltaMs / BOW_RAISE_MS);
    if (this.bowReady < 1 || this.bowCooldownMs > 0) {
      this.bowTension = Math.max(0, this.bowTension - deltaMs / 200);
      return false;
    }
    this.bowTension = Math.min(1, this.bowTension + deltaMs / ENEMY_ARCHER_DRAW_MS);
    if (this.bowTension < 1) {
      return false;
    }
    this.bowTension = 0;
    this.bowCooldownMs = ENEMY_ARCHER_COOLDOWN_MS;
    return true;
  }

  /** Archer: lower the bow (walking, knocked down, no target). */
  public relaxBow(realDeltaMs: number): void {
    const deltaMs = realDeltaMs * this.afflictions.timeScale;
    this.bowCooldownMs = Math.max(0, this.bowCooldownMs - deltaMs);
    this.bowTension = Math.max(0, this.bowTension - deltaMs / 200);
    this.bowReady = Math.max(0, this.bowReady - deltaMs / BOW_LOWER_MS);
  }

  /** Archer: where the arrow is nocked, in world space (matches the drawn bow). */
  public getBowReleasePoint(): Vec2 {
    const facing = Math.sign(this.body.scale.x) || -1;
    const localAngle = toArcherLocalAngle(this.aimAngle, this.body.rotation, facing);
    const nock = getArcherRig(localAngle, this.bowTension, this.bowReady).stringNock;
    return spriteToWorld(nock, this.bodyTransform());
  }

  /** Draws the body in this enemy's look (rendering/enemyBody) in the given state. */
  private drawBody(state: EnemyBodyState): void {
    drawEnemyBody(this.body, this.kind, state, BODY_ORIGIN_Y, this.lookTimeMs);
  }

  /** Standing still (an archer with its bow as it is now), upright. */
  private drawStanding(): void {
    this.body.rotation = 0;
    this.drawBody(this.isArcher ? this.archerState() : { mode: 'stand', phase: this.walkPhase });
  }

  /** An archer's bow state (upright sprite, so the aim needs no lean correction); `walkPhase` while walking. */
  private archerState(walkPhase?: number): EnemyBodyState {
    const facing = Math.sign(this.body.scale.x) || -1;
    return { mode: 'archer', localAngle: toArcherLocalAngle(this.aimAngle, 0, facing), tension: this.bowTension, ready: this.bowReady, walkPhase };
  }

  private drawPlaceholder(): void {
    this.drawStanding();
    this.body.position.set(0, -29);
    this.body.scale.set(-BODY_SCALE.x, BODY_SCALE.y);
  }

  /**
   * Applies damage and plays the reaction: a death animation when killed (headshot → stiff fall,
   * explosion → knockback, otherwise a random collapse), or a knockdown when an explosion doesn't kill.
   */
  public takeDamage(amount: number, hit: HitInfo = { cause: 'arrow', fromX: this.x - 1 }): number {
    if (!this.isAlive()) {
      return this.health;
    }
    this.netHooks?.damaged(amount, hit);

    this.health = Math.max(0, this.health - Math.max(0, amount));
    this.drawHealthBar();
    // Explosions throw the closer ones further (a direct hit counts as the centre).
    const blastDistance = hit.blastDistance ?? (hit.cause === 'blast' ? 0 : 1);
    const push = hit.cause === 'explosion' || hit.cause === 'blast' ? knockbackPush(blastDistance) : 0;
    // Up in the air (lifted or flying) it falls back down first and lands lying.
    const aloft = this.flight !== undefined || this.afflictions.inVortex;
    if (this.health === 0) {
      this.alive = false;
      this.velocity = { x: 0, y: 0 };
      this.healthBar.visible = false;
      if (hit.cause === 'fall') {
        // Already lying from the landing: it just doesn't get up.
        if (this.fall) {
          this.fall.getUpAfterMs = undefined;
        }
      } else if (hit.cause === 'shatter') {
        this.afflictions.thaw();
        this.shattered = true;
        this.afflictions.extinguish();
        this.blowApart(hit.fromX, hit.point ?? { x: this.x, y: this.y - 20 });
      } else if (blowsApart(hit.cause, blastDistance)) {
        this.afflictions.thaw();
        this.afflictions.extinguish();
        this.blowApart(hit.fromX, hit.point ?? { x: this.x, y: this.y - 20 });
      } else if (aloft) {
        this.afflictions.thaw();
        if (!this.flight) {
          this.throwInAir(0, 0, 0);
        }
      } else {
        this.afflictions.thaw();
        this.startFall(Enemy.deathKind(hit.cause), hit.fromX, undefined, push);
      }
    } else if (aloft) {
      // Hit while up in the air: it keeps flying (or stays in the funnel).
    } else if (hit.cause === 'explosion' || hit.cause === 'blast' || hit.cause === 'lightning') {
      this.afflictions.thaw();
      this.startFall('knockback', hit.fromX, KNOCKDOWN_LIE_MS, push);
    }

    return this.health;
  }

  /**
   * The enemies won: stop and cheer (a random one of three). A knocked-down enemy gets up first.
   * Faces the player's side.
   */
  public celebrate(): void {
    if (!this.isAlive() || this.cheer) {
      return;
    }
    this.cheer = {
      kind: CHEER_KINDS[Math.floor(Math.random() * CHEER_KINDS.length)],
      timeMs: Math.random() * 200,
      tempo: 0.9 + Math.random() * 0.2,
    };
    this.velocity = { x: 0, y: 0 };
    this.attackTimerMs = 0;
    this.hitStaggerMs = 0;
    this.pendingImpact = undefined;
  }

  public get isCelebrating(): boolean {
    return this.isAlive() && this.cheer !== undefined;
  }

  /** True while a surviving enemy is knocked down or flying through the air (can't move or attack). */
  public get isDown(): boolean {
    return this.isAlive() && (this.fall !== undefined || this.flight !== undefined);
  }

  public get isThrown(): boolean {
    return this.flight !== undefined;
  }

  public clearHitTint(): void {
    if (!this.isAlive()) {
      return;
    }
    this.body.alpha = 1;
  }

  public applyHitReaction(pushX: number): void {
    if (!this.isAlive() || this.fall || this.afflictions.isFrozen) {
      return;
    }
    this.hitStaggerMs = Math.max(this.hitStaggerMs, 120);
    this.x += Math.max(-6, Math.min(8, pushX));
  }

  /**
   * Swings the club; `onImpact` runs when the club lands (mid-swing), unless the enemy is knocked down,
   * killed or starts cheering first.
   */
  public playAttackAnimation(onImpact?: () => void): void {
    this.attackTimerMs = ATTACK_ANIMATION_DURATION_MS;
    this.pendingImpact = onImpact;
    this.netHooks?.attacked();
  }

  /** Pins the enemy to the ground for `durationMs` (a fresh pin restarts the time); not while it's up in the air. */
  public pin(durationMs: number): void {
    if (this.isAlive() && !this.flight && !this.afflictions.inVortex) {
      if (this.pinnedMs <= 0) {
        this.struggleMs = 0;
      }
      this.pinnedMs = Math.max(this.pinnedMs, durationMs);
    }
  }

  /**
   * Held by a vortex this frame at `x`, lifted `lift` px off the ground (it flails once off its feet) and turned
   * `lean` (leaning into the pull on the ground, tumbling up in the funnel); `levitating` when the vortex arrow hit
   * it (it glows). Meanwhile it can't walk or swing.
   */
  public holdInVortex(x: number, lift: number, lean: number, levitating = false): void {
    if (!this.isAlive() || this.fall || this.flight) {
      return;
    }
    this.x = Math.max(PLAYER_TOWER_X + PUSH_MARGIN, Math.min(WORLD_WIDTH - PUSH_MARGIN, x));
    this.y = groundAt(this.x) - lift;
    this.afflictions.holdInVortex(lift, lean, levitating);
    this.velocity = { x: 0, y: 0 };
    this.attackTimerMs = 0;
    this.pendingImpact = undefined;
  }

  /**
   * Thrown through the air at (`vx`, `vy`) px/s, tumbling at `spin` radians/s: it flails (or flies as a block of
   * ice) and lands on its back into the knockback; then `onLanded` (the host deals the fall damage).
   */
  public throwInAir(vx: number, vy: number, spin: number): void {
    if (this.gibs || this.fall) {
      return;
    }
    const rotation = this.afflictions.inVortex ? this.afflictions.lean : 0;
    this.afflictions.releaseVortex();
    this.flight = { x: this.x, y: this.y, vx, vy, rotation, spin, timeMs: 0 };
    this.velocity = { x: 0, y: 0 };
    this.attackTimerMs = 0;
    this.hitStaggerMs = 0;
    this.pendingImpact = undefined;
    // Faces against the way it flies, so it falls backwards along it.
    this.body.scale.x = (vx > 0 ? -1 : 1) * BODY_SCALE.x;
  }

  /** Where the stuck foot of a pinned enemy is (world): its rear foot, behind it (it faces the way it walked). */
  public pinnedFootPoint(): Vec2 {
    const facing = Math.sign(this.body.scale.x) || -1;
    return {
      x: this.x + PINNED_FOOT.x * BODY_SCALE.x * facing * this.scale.x,
      y: groundAt(this.x + PINNED_FOOT.x * BODY_SCALE.x * facing * this.scale.x),
    };
  }

  public get isPinned(): boolean {
    return this.isAlive() && this.pinnedMs > 0;
  }

  /** Co-op: what the guest needs besides the position (walking speed; an archer's bow; time left pinned). */
  public getNetState(): { vx: number; aim?: number; tension?: number; ready?: number; pinned?: number; af?: AfflictionNet; th?: ThrowNet } {
    const pinned = this.pinnedMs > 0 ? this.pinnedMs : undefined;
    const af = this.afflictions.getNetState();
    const th = this.flight ? { vx: Math.round(this.flight.vx), spin: Math.round(this.flight.spin * 10) / 10 } : undefined;
    return this.isArcher
      ? { vx: this.velocity.x, aim: this.aimAngle, tension: this.bowTension, ready: this.bowReady, pinned, af, th }
      : { vx: this.velocity.x, pinned, af, th };
  }

  /**
   * Co-op guest: puts the enemy where the host has it (no AI runs on the guest); walking speed drives the
   * stride and facing, an archer's bow follows the host's aim and draw.
   */
  public applyNetState(state: { x: number; y: number; vx: number; aim?: number; tension?: number; ready?: number; pinned?: number; af?: AfflictionNet; th?: ThrowNet }): void {
    if (!this.isAlive()) {
      return;
    }
    if (state.th && !this.flight && !this.fall) {
      this.throwInAir(state.th.vx, 0, state.th.spin);
      this.flightFromNet = true;
    }
    if (this.flight) {
      // The host flies it; this side tumbles it and lands it.
      this.flight = { ...this.flight, vy: state.y >= this.y ? 1 : -1, x: state.x, y: state.y };
      this.position.set(state.x, state.y);
      return;
    }
    this.position.set(state.x, state.y);
    this.velocity = { x: state.vx, y: 0 };
    this.pinnedMs = state.pinned ?? 0;
    this.afflictions.applyNetState(state.af);
    if (this.isArcher && state.aim !== undefined) {
      this.aimAngle = state.aim;
      this.bowTension = state.tension ?? 0;
      this.bowReady = state.ready ?? 0;
      if (this.bowReady > 0 && Math.abs(state.vx) <= 1) {
        this.body.scale.x = Math.cos(state.aim) < 0 ? -BODY_SCALE.x : BODY_SCALE.x;
      }
    }
  }

  /**
   * Counts the afflictions down (real time), plays the animation at their pace (slowed when chilled, held when
   * frozen) and draws them over the body.
   */
  public updateAnimation(deltaMs: number, moving: boolean): void {
    this.afflictions.tick(deltaMs);
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
    this.zIndex = this.afflictions.levitating ? LEVITATE_Z : 1;
    if (this.flight) {
      this.updateFlight(deltaMs);
      return;
    }
    if (this.gibs) {
      this.dropToGround(deltaMs);
      this.gibs.step(deltaMs);
      this.lookTimeMs += deltaMs;
      drawEnemyGibs(this.body, this.kind, this.gibs, BODY_ORIGIN_Y, this.lookTimeMs);
      this.body.tint = this.shattered ? FROZEN_TINT : 0xffffff;
      this.afflictions.art.clear();
      return;
    }
    const lifted = this.afflictions.inVortex && this.afflictions.lift > FLAIL_LIFT && !this.fall && !this.afflictions.isFrozen;
    if (lifted) {
      // Off its feet in the funnel: flailing, tumbling round.
      this.lookTimeMs += deltaMs;
      this.drawBody({ mode: 'joints', pose: getFlailPose(this.lookTimeMs), club: this.carriesClub });
      this.body.rotation = this.afflictions.lean;
    } else {
      this.animate(deltaMs * this.afflictions.timeScale, moving);
      if (this.afflictions.inVortex && !this.fall) {
        // Leaning into the pull, flailing a little.
        this.body.rotation += this.afflictions.lean + Math.sin(this.lookTimeMs / 90) * 0.06;
      }
    }
    this.body.tint = this.afflictions.tint;
    this.afflictions.draw(this.afflictionPoints(this.fall || lifted ? undefined : STANDING_BURN_POINTS), AFFLICTION_SIZE, this.afflictionPoints(STANDING_BURN_POINTS));
  }

  /**
   * Flying (thrown by a vortex): falls, tumbles, flails (a frozen one flies as a block of ice) and lands on its back
   * into the knockback (a living one gets up later); then onLanded.
   */
  private updateFlight(deltaMs: number): void {
    const flight = this.flight!;
    this.lookTimeMs += deltaMs;
    // A co-op guest's living enemy flies where the host has it (it only tumbles and lands it here).
    const driven = this.flightFromNet && this.isAlive();
    const step = stepFlight(flight, deltaMs, groundAt, PLAYER_TOWER_X + PUSH_MARGIN, WORLD_WIDTH - PUSH_MARGIN);
    const landed = driven ? flight.vy > 0 && this.y >= groundAt(this.x) - 0.5 : step.landed;
    if (landed) {
      this.land(flight.vx, step.impactSpeed);
      return;
    }
    this.flight = driven ? { ...step.flight, x: flight.x, y: flight.y, vy: flight.vy } : step.flight;
    this.position.set(this.flight.x, this.flight.y);
    if (this.afflictions.isFrozen) {
      this.drawBody({ mode: 'stand', phase: 0 });
    } else {
      this.drawBody({ mode: 'joints', pose: getFlailPose(this.lookTimeMs), club: this.carriesClub });
    }
    this.body.rotation = this.flight.rotation;
    this.body.tint = this.afflictions.tint;
    this.afflictions.draw(this.afflictionPoints(), AFFLICTION_SIZE, this.afflictionPoints(STANDING_BURN_POINTS));
  }

  /** Hits the ground on its back, sliding on the way it flew; a living one gets up after a while. */
  private land(vx: number, impactSpeed: number): void {
    this.flight = undefined;
    this.flightFromNet = false;
    this.y = groundAt(this.x);
    this.body.rotation = 0;
    // Falls backwards away from `fromX`: put that behind where it came from.
    this.startFall('knockback', this.x - Math.sign(vx || 1), this.isAlive() ? KNOCKDOWN_LIE_MS : undefined);
    if (this.fall) {
      this.fall.timeMs = FALL_DURATION_MS.knockback * LANDING_PROGRESS;
      this.drawFall();
    }
    const landed = this.onLanded;
    this.onLanded = undefined;
    landed?.(impactSpeed);
  }

  /** Blown apart up in the air: the pieces' frame drops back to the ground. */
  private dropToGround(deltaMs: number): void {
    const ground = groundAt(this.x);
    if (this.y >= ground) {
      this.dropSpeed = 0;
      return;
    }
    this.dropSpeed += (DROP_GRAVITY * deltaMs) / 1000;
    this.y = Math.min(ground, this.y + (this.dropSpeed * deltaMs) / 1000);
  }

  /** Body points (where flames burn and frost glints) in container space: the fall pose's joints, or `standing`. */
  private afflictionPoints(standing?: readonly Vec2[]): Vec2[] {
    const { body } = this;
    const pose = this.jointPose();
    const points = standing ?? (pose ? burnPoints(pose) : STANDING_BURN_POINTS);
    const cos = Math.cos(body.rotation);
    const sin = Math.sin(body.rotation);
    return points.map(({ x, y }) => {
      const scaledX = x * body.scale.x;
      const scaledY = y * body.scale.y;
      return { x: body.x + scaledX * cos - scaledY * sin, y: body.y + scaledX * sin + scaledY * cos };
    });
  }

  private animate(deltaMs: number, moving: boolean): void {
    this.lookTimeMs += deltaMs;
    this.positionHealthBar();
    if (this.fall) {
      // Dead enemies keep playing (then holding) their death; survivors get back up.
      this.updateFall(deltaMs);
      return;
    }
    if (!this.isAlive()) {
      return;
    }

    if (this.cheer) {
      this.cheer.timeMs += deltaMs * this.cheer.tempo;
      this.body.scale.set(-BODY_SCALE.x, BODY_SCALE.y);
      this.body.rotation = 0;
      this.drawBody({ mode: 'joints', pose: getCheerPose(this.cheer.kind, this.cheer.timeMs), club: this.carriesClub });
      return;
    }

    if (this.attackTimerMs > 0) {
      this.attackTimerMs = Math.max(0, this.attackTimerMs - deltaMs);
      const attackProgress = 1 - this.attackTimerMs / ATTACK_ANIMATION_DURATION_MS;
      if (this.pendingImpact && attackProgress >= attackImpactProgress(this.look.attackStyle)) {
        const impact = this.pendingImpact;
        this.pendingImpact = undefined;
        impact();
      }
      this.body.rotation = 0;
      this.drawBody(this.isArcher ? this.archerState() : { mode: 'attack', progress: attackProgress, style: this.look.attackStyle });
      return;
    }

    // Pinned by one foot: lunges, gets yanked back, looks down at it, tries again (an archer still shoots).
    if (this.pinnedMs > 0 && !(this.isArcher && this.bowReady > 0)) {
      this.struggleMs += deltaMs;
      this.body.rotation = 0;
      this.drawBody({ mode: 'joints', pose: getPinnedPose(this.struggleMs), club: this.carriesClub });
      return;
    }

    if (!moving) {
      this.drawStanding();
      return;
    }

    this.animationTime += deltaMs;
    this.body.scale.x = this.velocity.x < 0 ? -BODY_SCALE.x : BODY_SCALE.x;
    const { runs } = this.look;
    // Stride in world px per radian of phase (bigger bodies take longer strides).
    const stride = (runs ? RUN_STRIDE_PER_RADIAN : WALK_STRIDE_PER_RADIAN) * BODY_SCALE.x * this.scale.x;
    this.stridePhase += (Math.hypot(this.velocity.x, this.velocity.y) * deltaMs) / 1000 / stride;
    if (this.isArcher) {
      // Archers walk upright so the bow rig matches the aim (getBowReleasePoint).
      this.body.rotation = 0;
      this.drawBody(this.archerState(this.stridePhase));
    } else {
      const lean = runs ? RUN_LEAN : 0.06;
      this.body.rotation = this.velocity.x < 0 ? -lean : lean;
      this.drawBody({ mode: 'walk', phase: this.stridePhase, running: runs });
    }
  }

  public isAlive(): boolean {
    return this.alive && this.health > 0;
  }

  /** Health left (e.g. whether a hit will kill it). */
  public get currentHealth(): number {
    return this.health;
  }

  public getHealthRatio(): number {
    return this.health / this.maxHealth;
  }

  public getPhysicsBounds(): Bounds {
    const falling = this.fallPointsWorld();
    if (falling) {
      // Box around the falling/lying body.
      const { pose, toWorld } = falling;
      const points = [pose.hip, pose.shoulder, pose.head, pose.frontKnee, pose.rearKnee, pose.frontFoot, pose.rearFoot]
        .map(toWorld);
      return Enemy.boundsAround(points, 2);
    }
    const width = 14 * this.look.size;
    // Reach up to (and 1 px into) the head box so there's no gap at the neck for arrows to slip through.
    const y = Math.min(this.y - 28 * this.look.size, this.getHeadBounds().bottom - 1);
    const height = this.y - y;
    const x = this.x - width / 2;
    return {
      x,
      y,
      width,
      height,
      left: x,
      right: x + width,
      top: y,
      bottom: y + height,
    };
  }

  /** Box around the drawn head (follows bob, lean, scale and falls), in world space. */
  public getHeadBounds(): Bounds {
    const falling = this.fallPointsWorld();
    if (falling) {
      const center = falling.toWorld(falling.pose.head);
      return Enemy.boundsAround([center], STICKMAN_HEAD.radius * BODY_SCALE.x * this.scale.x);
    }
    const { body } = this;
    const cos = Math.cos(body.rotation);
    const sin = Math.sin(body.rotation);
    const localX = STICKMAN_HEAD.x * body.scale.x;
    const localY = STICKMAN_HEAD.y * body.scale.y;
    const centerX = this.x + (body.x + localX * cos - localY * sin) * this.scale.x;
    const centerY = this.y + (body.y + localX * sin + localY * cos) * this.scale.y;
    const radius = STICKMAN_HEAD.radius * Math.abs(body.scale.x) * this.scale.x;
    return Enemy.boundsAround([{ x: centerX, y: centerY }], radius);
  }

  public update(realDeltaMs: number, target?: Vec2, stopDistance = 0): void {
    // A pin holds for its full time; everything else runs at the afflictions' pace (slowed, or held when frozen).
    this.pinnedMs = Math.max(0, this.pinnedMs - realDeltaMs);
    const deltaMs = realDeltaMs * this.afflictions.timeScale;
    // The pause between swings runs down all the time, also while the bowman is out of reach.
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaMs);
    if (!this.isAlive() || this.fall) {
      return;
    }
    // Frozen solid, held by a vortex (which also sets its position) or flying: no walking of its own.
    if (this.afflictions.isFrozen || this.afflictions.inVortex || this.flight) {
      this.velocity.x = 0;
      this.velocity.y = 0;
      return;
    }
    // Pinned: struggles on the spot.
    if (this.pinnedMs > 0) {
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.y = groundAt(this.x);
      return;
    }
    // Planted while swinging (the club is moving, the feet aren't).
    if (this.attackTimerMs > 0) {
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.y = groundAt(this.x);
      return;
    }

    this.hitStaggerMs = Math.max(0, this.hitStaggerMs - deltaMs);
    if (this.hitStaggerMs > 0) {
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.y = groundAt(this.x);
      return;
    }

    if (target) {
      const distanceToTarget = target.x - this.x;
      if (Math.abs(distanceToTarget) <= stopDistance) {
        this.velocity.x = 0;
        this.velocity.y = 0;
      } else {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const length = Math.hypot(dx, dy) || 1;
        this.velocity.x = (dx / length) * this.speed;
        this.velocity.y = (dy / length) * this.speed;
      }
    } else {
      this.velocity.x = -this.speed;
      this.velocity.y = 0;
    }

    // A brute in a vortex's reach struggles on against the wind.
    const deltaSeconds = (deltaMs * this.afflictions.headwind) / 1000;
    this.x += this.velocity.x * deltaSeconds;
    this.y = groundAt(this.x);
  }

  /** Ready to start a swing (not down, not mid-swing, pause over); starting one restarts the pause. */
  public canAttack(): boolean {
    if (this.fall || this.flight || this.attackTimerMs > 0 || this.attackCooldown > 0 || this.afflictions.isFrozen || this.afflictions.inVortex) {
      return false;
    }
    this.attackCooldown = ENEMY_ATTACK_INTERVAL_MS;
    return true;
  }

  public isMoving(): boolean {
    return Math.abs(this.velocity.x) > 1 || Math.abs(this.velocity.y) > 1;
  }

  public setPaused(paused: boolean): void {
    if (paused) {
      this.velocity.x = 0;
      this.velocity.y = 0;
    }
  }

  private static deathKind(cause: HitInfo['cause']): FallKind {
    if (cause === 'headshot' || cause === 'lightning') {
      return 'deathStiff';
    }
    if (cause === 'explosion') {
      return 'knockback';
    }
    if (cause === 'burn') {
      return 'deathCrumple';
    }
    return Math.random() < 0.5 ? 'death' : 'deathCrumple';
  }

  /** Explosive kill: the body bursts into pieces thrown away from the impact point. */
  private blowApart(fromX: number, point: Vec2): void {
    this.pendingImpact = undefined;
    this.flight = undefined;
    const facing = fromX >= this.x ? 1 : -1;
    this.fall = undefined;
    this.attackTimerMs = 0;
    this.body.rotation = 0;
    this.body.y = BODY_ORIGIN_Y;
    this.body.scale.set(BODY_SCALE.x * facing, BODY_SCALE.y);
    const blast = worldToSprite(point, this.bodyTransform());
    // A kamikaze's own bomb goes off with it: its pieces fly much farther.
    const bomb = enemyArchetype(this.kind).detonates ? KAMIKAZE_GIB_FORCE : 1;
    const force = (GIB_FORCE_MIN + Math.random() * (GIB_FORCE_MAX - GIB_FORCE_MIN)) * bomb;
    this.gibs = new GibSimulation(blast, Math.floor(Math.random() * 1e9), force);
    drawEnemyGibs(this.body, this.kind, this.gibs, BODY_ORIGIN_Y, this.lookTimeMs);
  }

  /** Turns to face the hit (so backwards falls go away from it) and starts a fall animation. */
  private startFall(kind: FallKind, fromX: number, getUpAfterMs?: number, push = 0): void {
    this.pendingImpact = undefined;
    const facing = fromX >= this.x ? 1 : -1;
    this.fall = { kind, timeMs: 0, facing, getUpAfterMs, push: kind === 'knockback' && push > 0 ? { total: push, applied: 0 } : undefined };
    this.attackTimerMs = 0;
    this.hitStaggerMs = 0;
    this.body.scale.set(BODY_SCALE.x * facing, BODY_SCALE.y);
    this.drawFall();
  }

  /**
   * Dead and done moving: its death fall played to the end (and any push slid), or its pieces at rest on the
   * ground, with nothing burning, icy or held by a vortex on it. Nothing can change it after that.
   */
  private get isSettledCorpse(): boolean {
    const { afflictions } = this;
    if (this.isAlive() || this.flight || afflictions.isBurning || afflictions.isFrozen || afflictions.isChilled || afflictions.inVortex) {
      return false;
    }
    if (this.gibs) {
      return this.gibs.settled && this.y >= groundAt(this.x);
    }
    return this.fall !== undefined && this.fall.getUpAfterMs === undefined && this.fallProgress >= 1;
  }

  private get fallProgress(): number {
    return this.fall ? Math.min(1, this.fall.timeMs / FALL_DURATION_MS[this.fall.kind]) : 0;
  }

  private drawFall(): void {
    if (this.fall) {
      this.body.rotation = 0;
      this.drawBody({ mode: 'joints', pose: getFallPose(this.fall.kind, this.fallProgress), club: false });
    }
  }

  /** Advances the fall; a knocked-down survivor gets up and is moved to where it ended up. */
  private updateFall(deltaMs: number): void {
    const fall = this.fall;
    if (!fall) {
      return;
    }
    fall.timeMs += deltaMs;
    const duration = FALL_DURATION_MS[fall.kind];
    if (fall.push) {
      // Slide away from the blast (it faced the blast, so away is −facing), following the ground.
      const target = fall.push.total * pushShare(Math.min(1, fall.timeMs / duration));
      const step = target - fall.push.applied;
      fall.push.applied = target;
      this.x = Math.max(PLAYER_TOWER_X + PUSH_MARGIN, Math.min(WORLD_WIDTH - PUSH_MARGIN, this.x - fall.facing * step));
      this.y = groundAt(this.x);
    }
    if (fall.kind === 'knockback' && fall.getUpAfterMs !== undefined && fall.timeMs >= duration + fall.getUpAfterMs) {
      this.fall = { kind: 'getUp', timeMs: 0, facing: fall.facing };
    } else if (fall.kind === 'getUp' && fall.timeMs >= duration) {
      // The get-up ends standing away from where the knockback started; move there for real.
      const endHipX = getFallPose('getUp', 1).hip.x;
      this.x += endHipX * BODY_SCALE.x * fall.facing * this.scale.x;
      this.fall = undefined;
      this.drawStanding();
      return;
    }
    this.drawFall();
  }

  /** The joint pose drawn while falling, flying or flailing in a vortex (undefined otherwise). */
  private jointPose(): FallPose | undefined {
    if (this.fall) {
      return getFallPose(this.fall.kind, this.fallProgress);
    }
    const flailing = this.flight || (this.afflictions.inVortex && this.afflictions.lift > FLAIL_LIFT);
    return flailing && !this.afflictions.isFrozen ? getFlailPose(this.lookTimeMs) : undefined;
  }

  /** The current joint pose (falling, flying) and a mapping from its sprite space to world space. */
  private fallPointsWorld(): { pose: FallPose; toWorld: (point: Vec2) => Vec2 } | undefined {
    const pose = this.jointPose();
    if (!pose) {
      return undefined;
    }
    const { body } = this;
    const cos = Math.cos(body.rotation);
    const sin = Math.sin(body.rotation);
    return {
      pose,
      toWorld: (point) => {
        const x = point.x * body.scale.x;
        const y = point.y * body.scale.y;
        return { x: this.x + (body.x + x * cos - y * sin) * this.scale.x, y: this.y + (body.y + x * sin + y * cos) * this.scale.y };
      },
    };
  }

  /** Pins a world point/angle (e.g. an arrow hit) to this enemy's torso. */
  public toBodyAnchor(point: Vec2, angle: number): BodyAnchor {
    return toBodyAnchor(point, angle, this.bodyTransform(), this.torso());
  }

  /** Where a pinned anchor is now, following walking, attacks, falls and lying. */
  public resolveBodyAnchor(anchor: BodyAnchor): { position: Vec2; rotation: number } {
    return fromBodyAnchor(anchor, this.bodyTransform(), this.torso());
  }

  private bodyTransform(): BodyTransform {
    const { body } = this;
    return {
      x: this.x,
      y: this.y,
      scale: this.scale.x,
      bodyX: body.x,
      bodyY: body.y,
      rotation: body.rotation,
      scaleX: body.scale.x,
      scaleY: body.scale.y,
    };
  }

  /** Hip and shoulder of the pose currently drawn, in body-sprite space. */
  private torso(): Torso {
    if (this.gibs) {
      // Follow the flying torso piece.
      const piece = this.gibs.pieces[0];
      const dir = { x: Math.cos(piece.angle), y: Math.sin(piece.angle) };
      const hip = { x: piece.x - dir.x * TORSO_TO_NECK / 2, y: piece.y - dir.y * TORSO_TO_NECK / 2 };
      return { hip, shoulder: { x: hip.x + dir.x * TORSO_TO_SHOULDER, y: hip.y + dir.y * TORSO_TO_SHOULDER } };
    }
    const pose = this.jointPose();
    return pose ? { hip: pose.hip, shoulder: pose.shoulder } : STANDING_TORSO;
  }

  private static boundsAround(points: Vec2[], padding: number): Bounds {
    const left = Math.min(...points.map((point) => point.x)) - padding;
    const right = Math.max(...points.map((point) => point.x)) + padding;
    const top = Math.min(...points.map((point) => point.y)) - padding;
    const bottom = Math.max(...points.map((point) => point.y)) + padding;
    return { x: left, y: top, width: right - left, height: bottom - top, left, right, top, bottom };
  }

  /** Bar above the head: dark track, fill from green (full) through yellow to red (low). */
  private drawHealthBar(): void {
    const ratio = Math.max(0, Math.min(1, this.getHealthRatio()));
    const color = ratio > 0.6 ? 0x6fd36b : ratio > 0.3 ? 0xf2c94c : 0xe5534b;
    const { width, height } = HEALTH_BAR;
    this.healthBar.clear()
      .rect(-width / 2 - 1, -height / 2 - 1, width + 2, height + 2).fill({ color: 0x1b1a20, alpha: 0.85 })
      .rect(-width / 2, -height / 2, width * ratio, height).fill({ color });
  }

  /** Keeps the bar above the head, also while knocked down and getting up. */
  private positionHealthBar(): void {
    if (!this.fall) {
      this.healthBar.position.set(0, HEALTH_BAR.standingY);
      return;
    }
    const { head } = getFallPose(this.fall.kind, this.fallProgress);
    this.healthBar.position.set(
      this.body.x + head.x * this.body.scale.x,
      this.body.y + head.y * this.body.scale.y - HEALTH_BAR.aboveHead,
    );
  }
}
