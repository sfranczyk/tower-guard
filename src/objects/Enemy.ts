import { Container, Graphics } from 'pixi.js';
import { ENEMY_ATTACK_INTERVAL_MS, KAMIKAZE_GIB_FORCE, PLAYER_TOWER_X, PRIEST_CAST_MS, WORLD_WIDTH } from '../config';
import { getArcherRig, toArcherLocalAngle } from '../rendering/archer';
import { attackImpactProgress, type AttackStyle } from '../rendering/attackSwing';
import { WALK_STRIDE_PER_RADIAN } from '../rendering/stickman';
import { RUN_STRIDE_PER_RADIAN } from '../rendering/runCycle';
import { FALL_DURATION_MS, getFallPose, type FallKind, type FallPose } from '../rendering/stickmanFall';
import { CHEER_KINDS, getCheerPose, type CheerKind } from '../rendering/stickmanCheer';
import { PINNED_FOOT, getPinnedPose } from '../rendering/stickmanPinned';
import { getFlailPose } from '../rendering/stickmanFlail';
import { BodyMotion } from '../systems/bodyMotion';
import { ManaPool } from '../systems/healing';
import { GibSimulation } from '../rendering/stickmanGibs';
import type { BodyColors } from '../rendering/bodyColors';
import { drawEnemyBody, drawEnemyGibs, enemyGibColors, type EnemyBodyState } from '../rendering/enemyBody';
import { fromBodyAnchor, spriteToContainer, spriteToWorld, toBodyAnchor, worldToSprite, type BodyAnchor, type BodyTransform, type Torso } from '../systems/bodyAnchor';
import { ENEMY_LOOKS, blowsApart, knockbackPush, type EnemyLook } from '../data/enemies';
import { enemyArchetype } from '../data/enemyKinds';
import { groundAt } from '../systems/terrain';
import { drawHealthBar } from '../rendering/healthBar';
import { STANDING_BURN_POINTS, burnPoints } from '../rendering/burning';
import { FROZEN_TINT } from '../rendering/afflictionArt';
import type { Bounds, EnemyType, Vec2 } from '../types';
import { AfflictionLayer, type AfflictionNet } from './AfflictionLayer';
import { EnemyBow } from './EnemyBow';
import { bodyBounds, headBounds, torsoOf, type EnemyShape } from './enemyHitShape';
import { KNOCKDOWN_LIE_MS, deathKind, fallProgress, startFallState, stepFall, type FallState } from './enemyFall';

export type { ThrowNet } from '../systems/bodyMotion';
import type { ThrowNet } from '../systems/bodyMotion';

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

/** What a co-op guest needs of a ground enemy besides its position (Enemy.getNetState). */
export interface EnemyNet {
  vx: number;
  aim?: number;
  tension?: number;
  ready?: number;
  pinned?: number;
  af?: AfflictionNet;
  th?: ThrowNet;
  /** The priest's mana. */
  mana?: number;
}

/** Pushed enemies stay this far inside the world and out of the player's keep. */
const PUSH_MARGIN = 30;

/** Body sprite scale (x is mirrored by facing). */
const BODY_SCALE = { x: 0.5, y: 0.52 };
const BODY_ORIGIN_Y = -25;
/** drawStickman's hip and shoulder (sprite space) for walking, standing and attacking. */
/** Health bar size and placement in container space (the container is drawn at 2/3 scale). */
const HEALTH_BAR = { width: 30, height: 4, standingY: -68, aboveHead: 14 };
/** The priest's mana bar, just under its health bar. */
const MANA_BAR = { height: 2.5, gap: 1.5, color: 0x5b8cff };
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
  /** The swing under way (a black knight picks one of its three each time). */
  private swingStyle: AttackStyle;
  /** Time left of a spell being cast (the priest's heal). */
  private castTimerMs = 0;
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
  /** Archer: the bow (raised, drawn, aimed, the pause between shots). */
  private readonly bow = new EnemyBow();
  /** Killed while frozen: its pieces are ice. */
  private shattered = false;
  /** Pieces dropping back to the ground after being blown apart in the air (px/s). */
  private dropSpeed = 0;
  /** A settled corpse has been drawn as it rests (isSettledCorpse): it isn't redrawn again. */
  private settledDrawn = false;
  /**
   * Thrown through the air (a vortex threw it out, or it was hit up there), flailing until it lands; pinned to the
   * ground by a pinning arrow (it can't walk until the pin runs out, but can still swing or shoot).
   */
  private readonly motion = new BodyMotion();
  public target: EnemyTarget;
  /** Fire, frost and vortex (fire, frost and vortex arrows): drawn over the body. */
  public readonly afflictions: AfflictionLayer;
  /** The priest's mana (healers only): refills fast, spent on heals (EnemyAI); drawn under the health bar. */
  public readonly mana?: ManaPool;
  private readonly manaBar?: Graphics;
  /** Co-op host: hears about every hit, swing, heal and spell, to replay them on the guest's screen. */
  public netHooks?: { damaged(amount: number, hit: HitInfo): void; attacked(style: AttackStyle): void; healed?(amount: number): void; cast?(): void };

  public constructor(
    x: number,
    health = 3,
    speed = 60,
    target: EnemyTarget = 'bowman',
    public readonly kind: EnemyType = 'basic',
  ) {
    super();
    this.look = ENEMY_LOOKS[kind];
    this.swingStyle = this.look.attackStyle;
    this.body = new Graphics();
    this.drawPlaceholder();
    this.afflictions = new AfflictionLayer(kind);
    this.addChild(this.body, this.afflictions.art);
    this.healthBar = new Graphics();
    this.addChild(this.healthBar);
    if (enemyArchetype(kind).heals) {
      this.mana = new ManaPool();
      this.manaBar = new Graphics();
      this.healthBar.addChild(this.manaBar);
    }
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
    this.drawManaBar();
  }

  /** Ground enemies walk; only dragons fly (lightning strikes the ground, not the sky). */
  public readonly isFlying = false;

  /** Host: told when it lands from a throw, with the speed it hit the ground at (for the fall damage). */
  public get onLanded(): ((impactSpeed: number) => void) | undefined {
    return this.motion.onLanded;
  }

  public set onLanded(callback: ((impactSpeed: number) => void) | undefined) {
    this.motion.onLanded = callback;
  }

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
    this.velocity = { x: 0, y: 0 };
    this.body.scale.x = Math.cos(angle) < 0 ? -BODY_SCALE.x : BODY_SCALE.x;
    return this.bow.draw(angle, deltaMs);
  }

  /** Archer: lower the bow (walking, knocked down, no target). */
  public relaxBow(realDeltaMs: number): void {
    this.bow.relax(realDeltaMs * this.afflictions.timeScale);
  }

  /** Archer: where the arrow is nocked, in world space (matches the drawn bow). */
  public getBowReleasePoint(): Vec2 {
    const facing = Math.sign(this.body.scale.x) || -1;
    const localAngle = toArcherLocalAngle(this.bow.aimAngle, this.body.rotation, facing);
    const nock = getArcherRig(localAngle, this.bow.tension, this.bow.ready).stringNock;
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
    const { aimAngle, tension, ready } = this.bow;
    return { mode: 'archer', localAngle: toArcherLocalAngle(aimAngle, 0, facing), tension, ready, walkPhase };
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
    const aloft = this.motion.isThrown || this.afflictions.inVortex;
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
        if (!this.motion.isThrown) {
          this.throwInAir(0, 0, 0);
        }
      } else {
        this.afflictions.thaw();
        this.startFall(deathKind(hit.cause), hit.fromX, undefined, push);
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
    this.castTimerMs = 0;
    this.hitStaggerMs = 0;
    this.pendingImpact = undefined;
  }

  public get isCelebrating(): boolean {
    return this.isAlive() && this.cheer !== undefined;
  }

  /** True while a surviving enemy is knocked down or flying through the air (can't move or attack). */
  public get isDown(): boolean {
    return this.isAlive() && (this.fall !== undefined || this.motion.isThrown);
  }

  public get isThrown(): boolean {
    return this.motion.isThrown;
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
   * Swings the club (`style`, or one of its swings at random); `onImpact` runs when the club lands (mid-swing),
   * unless the enemy is knocked down, killed or starts cheering first.
   */
  public playAttackAnimation(onImpact?: () => void, style?: AttackStyle): void {
    const { attackStyles } = this.look;
    this.swingStyle = style ?? attackStyles[Math.floor(Math.random() * attackStyles.length)];
    this.attackTimerMs = ATTACK_ANIMATION_DURATION_MS;
    this.pendingImpact = onImpact;
    this.netHooks?.attacked(this.swingStyle);
  }

  /** Healed by a priest: gets `amount` health back (up to its full health). */
  public heal(amount: number): void {
    if (!this.isAlive() || amount <= 0) {
      return;
    }
    this.netHooks?.healed?.(amount);
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.drawHealthBar();
  }

  /** Healed this much short of its full health. */
  public get missingHealth(): number {
    return this.maxHealth - this.health;
  }

  /** The priest raises its scepter and casts (planted meanwhile); the heals themselves come from EnemyAI. */
  public castHeal(): void {
    this.castTimerMs = PRIEST_CAST_MS;
    this.velocity = { x: 0, y: 0 };
    this.netHooks?.cast?.();
  }

  public get isCasting(): boolean {
    return this.castTimerMs > 0;
  }

  /** Mid-swing (its club on the way). */
  public get isAttacking(): boolean {
    return this.attackTimerMs > 0;
  }

  /** The priest's mana refills (host); the bar follows it. */
  public updateMana(deltaMs: number): void {
    if (this.mana && this.isAlive()) {
      this.mana.update(deltaMs);
      this.drawManaBar();
    }
  }

  /** Pins the enemy to the ground for `durationMs` (a fresh pin restarts the time); not while it's up in the air. */
  public pin(durationMs: number): void {
    if (this.isAlive() && !this.motion.isThrown && !this.afflictions.inVortex && this.motion.pin(durationMs)) {
      this.struggleMs = 0;
    }
  }

  /**
   * Held by a vortex this frame at `x`, lifted `lift` px off the ground (it flails once off its feet) and turned
   * `lean` (leaning into the pull on the ground, tumbling up in the funnel); `levitating` when the vortex arrow hit
   * it (it glows). Meanwhile it can't walk or swing.
   */
  public holdInVortex(x: number, lift: number, lean: number, levitating = false): void {
    if (!this.isAlive() || this.fall || this.motion.isThrown) {
      return;
    }
    this.x = Math.max(PLAYER_TOWER_X + PUSH_MARGIN, Math.min(WORLD_WIDTH - PUSH_MARGIN, x));
    this.y = groundAt(this.x) - lift;
    this.afflictions.holdInVortex(lift, lean, levitating);
    this.velocity = { x: 0, y: 0 };
    this.attackTimerMs = 0;
    this.castTimerMs = 0;
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
    this.motion.throw(this.x, this.y, vx, vy, spin, rotation);
    this.velocity = { x: 0, y: 0 };
    this.attackTimerMs = 0;
    this.castTimerMs = 0;
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
    return this.isAlive() && this.motion.isPinned;
  }

  /** Co-op: what the guest needs besides the position (walking speed; an archer's bow; time left pinned). */
  public getNetState(): EnemyNet {
    const pinned = this.motion.isPinned ? this.motion.pinnedMs : undefined;
    const af = this.afflictions.getNetState();
    const th = this.motion.netThrow;
    const mana = this.mana ? Math.round(this.mana.mana) : undefined;
    return this.isArcher
      ? { vx: this.velocity.x, ...this.bow.net, pinned, af, th }
      : { vx: this.velocity.x, pinned, af, th, mana };
  }

  /**
   * Co-op guest: puts the enemy where the host has it (no AI runs on the guest); walking speed drives the
   * stride and facing, an archer's bow follows the host's aim and draw.
   */
  public applyNetState(state: EnemyNet & { x: number; y: number }): void {
    if (!this.isAlive()) {
      return;
    }
    if (this.mana && state.mana !== undefined) {
      this.mana.set(state.mana);
      this.drawManaBar();
    }
    if (state.th && !this.motion.isThrown && !this.fall) {
      this.throwInAir(state.th.vx, 0, state.th.spin);
      this.motion.fromNet = true;
    }
    if (this.motion.isThrown) {
      // The host flies it; this side tumbles it and lands it.
      this.motion.placeFlight(state.x, state.y, state.y >= this.y ? 1 : -1);
      this.position.set(state.x, state.y);
      return;
    }
    this.position.set(state.x, state.y);
    this.velocity = { x: state.vx, y: 0 };
    this.motion.setPin(state.pinned ?? 0);
    this.afflictions.applyNetState(state.af);
    if (this.isArcher && state.aim !== undefined) {
      this.bow.apply({ aim: state.aim, tension: state.tension, ready: state.ready });
      if (this.bow.ready > 0 && Math.abs(state.vx) <= 1) {
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
    if (this.motion.isThrown) {
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
    const { vx } = this.motion.flight!;
    this.lookTimeMs += deltaMs;
    // A co-op guest's living enemy flies where the host has it (it only tumbles and lands it here).
    const driven = this.motion.fromNet && this.isAlive();
    const step = this.motion.step(deltaMs, PLAYER_TOWER_X + PUSH_MARGIN, WORLD_WIDTH - PUSH_MARGIN, driven);
    if (step.landed) {
      this.land(vx, step.impactSpeed);
      return;
    }
    const { flight } = step;
    this.position.set(flight.x, flight.y);
    if (this.afflictions.isFrozen) {
      this.drawBody({ mode: 'stand', phase: 0 });
    } else {
      this.drawBody({ mode: 'joints', pose: getFlailPose(this.lookTimeMs), club: this.carriesClub });
    }
    this.body.rotation = flight.rotation;
    this.body.tint = this.afflictions.tint;
    this.afflictions.draw(this.afflictionPoints(), AFFLICTION_SIZE, this.afflictionPoints(STANDING_BURN_POINTS));
  }

  /** Hits the ground on its back, sliding on the way it flew; a living one gets up after a while. */
  private land(vx: number, impactSpeed: number): void {
    const landed = this.motion.endFlight();
    this.y = groundAt(this.x);
    this.body.rotation = 0;
    // Falls backwards away from `fromX`: put that behind where it came from.
    this.startFall('knockback', this.x - Math.sign(vx || 1), this.isAlive() ? KNOCKDOWN_LIE_MS : undefined);
    if (this.fall) {
      this.fall.timeMs = FALL_DURATION_MS.knockback * LANDING_PROGRESS;
      this.drawFall();
    }
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
    const pose = this.jointPose();
    return spriteToContainer(standing ?? (pose ? burnPoints(pose) : STANDING_BURN_POINTS), this.body);
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

    if (this.castTimerMs > 0) {
      this.castTimerMs = Math.max(0, this.castTimerMs - deltaMs);
      this.body.rotation = 0;
      this.drawBody({ mode: 'cast', progress: 1 - this.castTimerMs / PRIEST_CAST_MS });
      return;
    }

    if (this.attackTimerMs > 0) {
      this.attackTimerMs = Math.max(0, this.attackTimerMs - deltaMs);
      const attackProgress = 1 - this.attackTimerMs / ATTACK_ANIMATION_DURATION_MS;
      if (this.pendingImpact && attackProgress >= attackImpactProgress(this.swingStyle)) {
        const impact = this.pendingImpact;
        this.pendingImpact = undefined;
        impact();
      }
      this.body.rotation = 0;
      this.drawBody(this.isArcher ? this.archerState() : { mode: 'attack', progress: attackProgress, style: this.swingStyle });
      return;
    }

    // Pinned by one foot: lunges, gets yanked back, looks down at it, tries again (an archer still shoots).
    if (this.motion.isPinned && !(this.isArcher && this.bow.ready > 0)) {
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
    return bodyBounds(this.shape());
  }

  /** Box around the drawn head (follows bob, lean, scale and falls), in world space. */
  public getHeadBounds(): Bounds {
    return headBounds(this.shape());
  }

  /** How it's drawn now, for its hit shape (objects/enemyHitShape.ts). */
  private shape(): EnemyShape {
    return { transform: this.bodyTransform(), size: this.look.size, pose: this.jointPose() };
  }

  public update(realDeltaMs: number, target?: Vec2, stopDistance = 0): void {
    // A pin holds for its full time; everything else runs at the afflictions' pace (slowed, or held when frozen).
    this.motion.tickPin(realDeltaMs);
    const deltaMs = realDeltaMs * this.afflictions.timeScale;
    // The pause between swings runs down all the time, also while the bowman is out of reach.
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaMs);
    if (!this.isAlive() || this.fall) {
      return;
    }
    // Frozen solid, held by a vortex (which also sets its position) or flying: no walking of its own.
    if (this.afflictions.isFrozen || this.afflictions.inVortex || this.motion.isThrown) {
      this.velocity.x = 0;
      this.velocity.y = 0;
      return;
    }
    // Pinned: struggles on the spot.
    if (this.motion.isPinned) {
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.y = groundAt(this.x);
      return;
    }
    // Planted while swinging (the club is moving, the feet aren't) or casting.
    if (this.attackTimerMs > 0 || this.castTimerMs > 0) {
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
    if (this.fall || this.motion.isThrown || this.attackTimerMs > 0 || this.castTimerMs > 0 || this.attackCooldown > 0 || this.afflictions.isFrozen || this.afflictions.inVortex) {
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

  /** Explosive kill: the body bursts into pieces thrown away from the impact point. */
  private blowApart(fromX: number, point: Vec2): void {
    this.pendingImpact = undefined;
    this.motion.endFlight();
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
    this.fall = startFallState(kind, fromX, this.x, getUpAfterMs, push);
    this.attackTimerMs = 0;
    this.castTimerMs = 0;
    this.hitStaggerMs = 0;
    this.body.scale.set(BODY_SCALE.x * this.fall.facing, BODY_SCALE.y);
    this.drawFall();
  }

  /**
   * Dead and done moving: its death fall played to the end (and any push slid), or its pieces at rest on the
   * ground, with nothing burning, icy or held by a vortex on it. Nothing can change it after that.
   */
  private get isSettledCorpse(): boolean {
    const { afflictions } = this;
    if (this.isAlive() || this.motion.isThrown || afflictions.isBurning || afflictions.isFrozen || afflictions.isChilled || afflictions.inVortex) {
      return false;
    }
    if (this.gibs) {
      return this.gibs.settled && this.y >= groundAt(this.x);
    }
    return this.fall !== undefined && this.fall.getUpAfterMs === undefined && this.fallProgress >= 1;
  }

  private get fallProgress(): number {
    return this.fall ? fallProgress(this.fall) : 0;
  }

  private drawFall(): void {
    if (this.fall) {
      this.body.rotation = 0;
      this.drawBody({ mode: 'joints', pose: getFallPose(this.fall.kind, this.fallProgress), club: false });
    }
  }

  /** Advances the fall (sliding away from a blast, along the ground); a knocked-down survivor gets up and is moved to where it ended up. */
  private updateFall(deltaMs: number): void {
    const fall = this.fall;
    if (!fall) {
      return;
    }
    const step = stepFall(fall, deltaMs);
    this.fall = step.fall;
    if (fall.push) {
      // It faced the blast, so away is −facing.
      this.x = Math.max(PLAYER_TOWER_X + PUSH_MARGIN, Math.min(WORLD_WIDTH - PUSH_MARGIN, this.x - fall.facing * step.slide));
      this.y = groundAt(this.x);
    }
    if (step.stoodUp) {
      // The get-up ends standing away from where the knockback started; move there for real.
      const endHipX = getFallPose('getUp', 1).hip.x;
      this.x += endHipX * BODY_SCALE.x * fall.facing * this.scale.x;
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
    const flailing = this.motion.isThrown || (this.afflictions.inVortex && this.afflictions.lift > FLAIL_LIFT);
    return flailing && !this.afflictions.isFrozen ? getFlailPose(this.lookTimeMs) : undefined;
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
    return torsoOf(this.jointPose(), this.gibs?.pieces[0]);
  }

  /** Bar above the head: dark track, fill from green (full) through yellow to red (low). */
  private drawHealthBar(): void {
    drawHealthBar(this.healthBar, this.getHealthRatio(), HEALTH_BAR.width, HEALTH_BAR.height);
  }

  /** The priest's mana under the health bar. */
  private drawManaBar(): void {
    if (!this.manaBar || !this.mana) {
      return;
    }
    const { width } = HEALTH_BAR;
    const top = HEALTH_BAR.height / 2 + 1 + MANA_BAR.gap;
    this.manaBar.clear()
      .rect(-width / 2 - 1, top, width + 2, MANA_BAR.height + 2).fill({ color: 0x1b1a20, alpha: 0.85 })
      .rect(-width / 2, top + 1, width * this.mana.ratio, MANA_BAR.height).fill({ color: MANA_BAR.color });
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
