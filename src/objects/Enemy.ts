import { Container, Graphics } from 'pixi.js';
import { ENEMY_ARCHER_COOLDOWN_MS, ENEMY_ARCHER_DRAW_MS, ENEMY_ATTACK_INTERVAL_MS, ENEMY_GROUND_Y } from '../config';
import { getArcherRig, toArcherLocalAngle } from '../rendering/archer';
import { STICKMAN_HEAD, drawStickman, type StickmanPose } from '../rendering/stickman';
import { FALL_DURATION_MS, drawStickmanFall, getFallPose, type FallKind, type FallPose } from '../rendering/stickmanFall';
import { CHEER_KINDS, drawStickmanCheer, type CheerKind } from '../rendering/stickmanCheer';
import { GibSimulation, drawStickmanGibs } from '../rendering/stickmanGibs';
import { fromBodyAnchor, spriteToWorld, toBodyAnchor, worldToSprite, type BodyAnchor, type BodyTransform, type Torso } from '../systems/bodyAnchor';
import type { Bounds, EnemyType, Vec2 } from '../types';

const ATTACK_ANIMATION_DURATION_MS = 1_130;

export type EnemyTarget = 'bowman' | 'tower';

/** What dealt the damage, and from which side, so the right reaction plays. */
export interface HitInfo {
  /** 'blast' = hit directly by an explosive arrow (a kill blows the body apart). */
  cause: 'arrow' | 'headshot' | 'explosion' | 'blast';
  /** World x the hit came from; the enemy turns to face it before falling. */
  fromX: number;
  /** World point of impact (used for 'blast' to throw the pieces away from it). */
  point?: Vec2;
}

/** A playing fall animation. Dead enemies stay in their last frame. */
interface FallState {
  kind: FallKind;
  timeMs: number;
  /** +1: fall-space +x is world +x; −1: mirrored. */
  facing: number;
  /** Knockback only: get up after lying down this long, then fight on. */
  getUpAfterMs?: number;
}

/** Time a knocked-down (surviving) enemy lies on the ground before getting up. */
const KNOCKDOWN_LIE_MS = 450;
/** Body sprite scale (x is mirrored by facing). */
const BODY_SCALE = { x: 0.5, y: 0.52 };
const BODY_ORIGIN_Y = -25;
const ENEMY_POSE: StickmanPose = { armed: true, originY: BODY_ORIGIN_Y };
/** drawStickman's hip and shoulder (sprite space) for walking, standing and attacking. */
/** Health bar size and placement in container space (the container is drawn at 2/3 scale). */
const HEALTH_BAR = { width: 30, height: 4, standingY: -68, aboveHead: 14 };
const STANDING_TORSO: Torso = { hip: { x: 0, y: 0 }, shoulder: { x: 0, y: -35 } };
/** Archers are tinted slightly red to tell them apart from club fighters. */
const ARCHER_TINT = 0xffc2b4;
const BOW_RAISE_MS = 220;
const BOW_LOWER_MS = 400;
/** Explosive kills throw the pieces with a random force in this range (the lab uses 1). */
const GIB_FORCE_MIN = 1;
const GIB_FORCE_MAX = 1.7;
/** Torso piece of a gib simulation is hip→neck top (43); anchors use hip→shoulder (35). */
const TORSO_TO_NECK = 43;
const TORSO_TO_SHOULDER = 35;

export default class Enemy extends Container {
  private readonly body: Graphics;
  private readonly healthBar: Graphics;
  private readonly maxHealth: number;
  private health: number;
  private readonly speed: number;
  private attackCooldown = 0;
  private hitStaggerMs = 0;
  private animationTime = 0;
  private attackTimerMs = 0;
  private velocity = { x: 0, y: 0 };
  private alive = true;
  private fall?: FallState;
  /** Set when the enemies win: a looping cheer (played at a slightly random tempo). */
  private cheer?: { kind: CheerKind; timeMs: number; tempo: number };
  /** Set when blown apart by a direct explosive hit. */
  private gibs?: GibSimulation;
  /** Archer bow state: raised (0..1), draw tension (0..1), aim angle (world) and time to the next shot. */
  private bowReady = 0;
  private bowTension = 0;
  private aimAngle = Math.PI;
  private bowCooldownMs = 0;
  public target: EnemyTarget;

  public constructor(
    x: number,
    health = 3,
    speed = 60,
    target: EnemyTarget = 'bowman',
    public readonly kind: EnemyType = 'basic',
  ) {
    super();
    this.body = new Graphics();
    this.drawPlaceholder();
    this.addChild(this.body);
    this.healthBar = new Graphics();
    this.addChild(this.healthBar);
    this.health = Math.max(0, health);
    this.maxHealth = Math.max(1, health);
    this.speed = Math.max(0, speed);
    this.target = target;
    this.scale.set(2 / 3, 2 / 3);
    this.position.set(x, ENEMY_GROUND_Y);
    this.zIndex = 1;
    this.velocity.x = -this.speed;
    if (this.isArcher) {
      this.body.tint = ARCHER_TINT;
    }
    this.drawHealthBar();
  }

  public get isArcher(): boolean {
    return this.kind === 'archer';
  }

  /**
   * Archer: face `angle`, raise the bow, draw, and return true on the frame the arrow is released.
   * Call every frame while standing in range; call relaxBow() otherwise.
   */
  public aimBow(angle: number, deltaMs: number): boolean {
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
  public relaxBow(deltaMs: number): void {
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

  /** Pose options for the current look: club fighters carry a club, archers a bow. */
  private pose(extra: StickmanPose): StickmanPose {
    if (!this.isArcher) {
      return { ...ENEMY_POSE, ...extra };
    }
    return {
      ...ENEMY_POSE,
      ...extra,
      armed: false,
      attackPhase: 0,
      archerPose: true,
      bowReady: this.bowReady,
      bowTension: this.bowTension,
      bowAngle: this.aimAngle,
      facingDirection: Math.sign(this.body.scale.x) || -1,
    };
  }

  private drawPlaceholder(): void {
    drawStickman(this.body, 0, { ...ENEMY_POSE, idleBlend: 1 });
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

    this.health = Math.max(0, this.health - Math.max(0, amount));
    this.drawHealthBar();
    if (this.health === 0) {
      this.alive = false;
      this.velocity = { x: 0, y: 0 };
      this.healthBar.visible = false;
      if (hit.cause === 'blast') {
        this.blowApart(hit.fromX, hit.point ?? { x: this.x, y: this.y - 20 });
      } else {
        this.startFall(Enemy.deathKind(hit.cause), hit.fromX);
      }
    } else if (hit.cause === 'explosion' || hit.cause === 'blast') {
      this.startFall('knockback', hit.fromX, KNOCKDOWN_LIE_MS);
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
  }

  public get isCelebrating(): boolean {
    return this.isAlive() && this.cheer !== undefined;
  }

  /** True while a surviving enemy is knocked down (can't move or attack). */
  public get isDown(): boolean {
    return this.isAlive() && this.fall !== undefined;
  }

  public clearHitTint(): void {
    if (!this.isAlive()) {
      return;
    }
    this.body.alpha = 1;
  }

  public applyHitReaction(pushX: number): void {
    if (!this.isAlive() || this.fall) {
      return;
    }
    this.hitStaggerMs = Math.max(this.hitStaggerMs, 120);
    this.x += Math.max(-6, Math.min(8, pushX));
  }

  public playAttackAnimation(): void {
    this.attackTimerMs = ATTACK_ANIMATION_DURATION_MS;
    this.body.rotation = -0.18;
  }

  public updateAnimation(deltaMs: number, moving: boolean): void {
    if (this.gibs) {
      this.gibs.step(deltaMs);
      drawStickmanGibs(this.body, this.gibs, BODY_ORIGIN_Y);
      return;
    }
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
      drawStickmanCheer(this.body, this.cheer.kind, this.cheer.timeMs, BODY_ORIGIN_Y, { club: !this.isArcher });
      return;
    }

    if (this.attackTimerMs > 0) {
      this.attackTimerMs = Math.max(0, this.attackTimerMs - deltaMs);
      const attackProgress = 1 - this.attackTimerMs / ATTACK_ANIMATION_DURATION_MS;
      drawStickman(this.body, this.animationTime, {
        ...ENEMY_POSE,
        idleBlend: 1,
        attackPhase: Math.max(0.001, attackProgress * Math.PI * 2),
      });
      if (this.attackTimerMs === 0) {
        this.body.rotation = 0;
      }
      return;
    }

    if (!moving) {
      this.body.rotation = 0;
      this.body.y = -29;
      drawStickman(this.body, this.animationTime, this.pose({ idleBlend: 1 }));
      return;
    }

    this.animationTime += deltaMs;
    this.body.scale.x = this.velocity.x < 0 ? -BODY_SCALE.x : BODY_SCALE.x;
    drawStickman(this.body, this.animationTime / 150, this.pose({}));
    if (!this.isArcher) {
      // Archers keep drawStickman's own lean so the bow rig stays consistent.
      this.body.rotation = this.velocity.x < 0 ? -0.06 : 0.06;
    }
  }

  public isAlive(): boolean {
    return this.alive && this.health > 0;
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
    const width = 14;
    // Reach up to (and 1 px into) the head box so there's no gap at the neck for arrows to slip through.
    const y = Math.min(this.y - 28, this.getHeadBounds().bottom - 1);
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

  public update(deltaMs: number, target?: Vec2, stopDistance = 0): void {
    if (!this.isAlive() || this.fall) {
      return;
    }

    this.hitStaggerMs = Math.max(0, this.hitStaggerMs - deltaMs);
    if (this.hitStaggerMs > 0) {
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.y = ENEMY_GROUND_Y;
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

    const deltaSeconds = deltaMs / 1000;
    this.x += this.velocity.x * deltaSeconds;
    this.y = ENEMY_GROUND_Y;
  }

  public canAttack(deltaMs: number): boolean {
    if (this.fall) {
      return false;
    }
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaMs);
    if (this.attackCooldown > 0) {
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
    if (cause === 'headshot') {
      return 'deathStiff';
    }
    if (cause === 'explosion') {
      return 'knockback';
    }
    return Math.random() < 0.5 ? 'death' : 'deathCrumple';
  }

  /** Explosive kill: the body bursts into pieces thrown away from the impact point. */
  private blowApart(fromX: number, point: Vec2): void {
    const facing = fromX >= this.x ? 1 : -1;
    this.fall = undefined;
    this.attackTimerMs = 0;
    this.body.rotation = 0;
    this.body.y = BODY_ORIGIN_Y;
    this.body.scale.set(BODY_SCALE.x * facing, BODY_SCALE.y);
    const blast = worldToSprite(point, this.bodyTransform());
    const force = GIB_FORCE_MIN + Math.random() * (GIB_FORCE_MAX - GIB_FORCE_MIN);
    this.gibs = new GibSimulation(blast, Math.floor(Math.random() * 1e9), force);
    drawStickmanGibs(this.body, this.gibs, BODY_ORIGIN_Y);
  }

  /** Turns to face the hit (so backwards falls go away from it) and starts a fall animation. */
  private startFall(kind: FallKind, fromX: number, getUpAfterMs?: number): void {
    const facing = fromX >= this.x ? 1 : -1;
    this.fall = { kind, timeMs: 0, facing, getUpAfterMs };
    this.attackTimerMs = 0;
    this.hitStaggerMs = 0;
    this.body.scale.set(BODY_SCALE.x * facing, BODY_SCALE.y);
    this.drawFall();
  }

  private get fallProgress(): number {
    return this.fall ? Math.min(1, this.fall.timeMs / FALL_DURATION_MS[this.fall.kind]) : 0;
  }

  private drawFall(): void {
    if (this.fall) {
      drawStickmanFall(this.body, this.fall.kind, this.fallProgress, BODY_ORIGIN_Y);
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
    if (fall.kind === 'knockback' && fall.getUpAfterMs !== undefined && fall.timeMs >= duration + fall.getUpAfterMs) {
      this.fall = { kind: 'getUp', timeMs: 0, facing: fall.facing };
    } else if (fall.kind === 'getUp' && fall.timeMs >= duration) {
      // The get-up ends standing away from where the knockback started; move there for real.
      const endHipX = getFallPose('getUp', 1).hip.x;
      this.x += endHipX * BODY_SCALE.x * fall.facing * this.scale.x;
      this.fall = undefined;
      drawStickman(this.body, this.animationTime, { ...ENEMY_POSE, idleBlend: 1 });
      return;
    }
    this.drawFall();
  }

  /** The current fall pose and a mapping from its sprite space to world space (only while falling). */
  private fallPointsWorld(): { pose: FallPose; toWorld: (point: Vec2) => Vec2 } | undefined {
    if (!this.fall) {
      return undefined;
    }
    const pose = getFallPose(this.fall.kind, this.fallProgress);
    const { body } = this;
    return {
      pose,
      toWorld: (point) => ({
        x: this.x + (body.x + point.x * body.scale.x) * this.scale.x,
        y: this.y + (body.y + point.y * body.scale.y) * this.scale.y,
      }),
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
    if (this.fall) {
      const { hip, shoulder } = getFallPose(this.fall.kind, this.fallProgress);
      return { hip, shoulder };
    }
    return STANDING_TORSO;
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
