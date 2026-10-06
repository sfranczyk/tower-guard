import { Container, Graphics } from 'pixi.js';
import { DRAGON_DRAW_MS, DRAGON_SCALE, DRAGON_SHOT_INTERVAL_MS } from '../config';
import { STICKMAN_HEAD } from '../rendering/stickman';
import { drawDragonRider, type DragonPose } from '../rendering/dragon';
import type { BodyAnchor } from '../systems/bodyAnchor';
import { cruiseAltitude, fallStep, flyTowards, hoverX, type FallState } from '../systems/dragonFlight';
import { groundAt } from '../systems/terrain';
import type { Bounds, Vec2 } from '../types';
import type { HitInfo } from './Enemy';

/** Wraps an angle into (−π, π]. */
const normalizeAngle = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Local aim limits for the rider (radians, + = down): no shooting backwards or straight up. */
const AIM_MIN = -0.25;
const AIM_MAX = 1.35;
const RELAX_MS = 400;
const HIT_FLASH_MS = 120;
/** Health bar above the dragon, in local (unscaled) units. */
const HEALTH_BAR = { width: 70, height: 8, y: -112 };
/** Body box of the dragon in local space: the body up to its back ridge (the rider above is the "head"). */
const BODY_BOX = { left: -66, right: 66, top: -28, bottom: 28 };
/** The corpse lies with its belly this far above the ground (local units). */
const LYING_CLEARANCE = 26;

/**
 * Flying dragon with an archer rider. Flies in high, hovers in front of the bowman (systems/dragonFlight),
 * and the rider draws and shoots hostile arrows like an enemy archer (CombatSystem aims for it). Arrows hit
 * the dragon's body or, for a headshot, the rider's head, and stick into it. A killed dragon falls out of
 * the sky and stays on the ground. Offers the same interface as Enemy where the combat code shares it.
 */
export default class DragonEnemy extends Container {
  public readonly kind = 'dragon' as const;
  public readonly isArcher = false;
  public readonly isFlying = true;
  public readonly isDown = false;
  public readonly size = 1;
  public readonly strikeReach = 0;
  private readonly art = new Graphics();
  private readonly healthBar = new Graphics();
  private readonly maxHealth: number;
  private health: number;
  private readonly speed: number;
  private timeMs = Math.random() * 1000;
  private pose: DragonPose;
  /** World aim angle and draw progress of the rider's bow. */
  private aimAngle = Math.PI;
  private tension = 0;
  private shotTimerMs = DRAGON_SHOT_INTERVAL_MS * 0.5;
  private flashMs = 0;
  private fall?: FallState;
  private cheering = false;
  private paused = false;

  public constructor(x: number, health: number, speed: number) {
    super();
    this.maxHealth = Math.max(1, health);
    this.health = this.maxHealth;
    this.speed = speed;
    // Faces left, towards the player's keep.
    this.scale.set(-DRAGON_SCALE, DRAGON_SCALE);
    this.position.set(x, cruiseAltitude(this.timeMs));
    this.zIndex = 1;
    this.healthBar.scale.set(1 / this.scale.x, 1 / this.scale.y);
    this.addChild(this.art, this.healthBar);
    this.pose = this.redraw();
    this.drawHealthBar();
  }

  public isAlive(): boolean {
    return this.health > 0;
  }

  public get isCelebrating(): boolean {
    return this.isAlive() && this.cheering;
  }

  /** The enemies won: stop shooting and keep circling in place. */
  public celebrate(): void {
    if (this.isAlive()) {
      this.cheering = true;
      this.tension = 0;
    }
  }

  public isMoving(): boolean {
    return this.isAlive();
  }

  public takeDamage(amount: number, _hit?: HitInfo): number {
    if (!this.isAlive()) {
      return this.health;
    }
    this.health = Math.max(0, this.health - Math.max(0, amount));
    this.drawHealthBar();
    if (this.health === 0) {
      this.fall = { y: this.y, vy: -60, rotation: 0, landed: false };
      this.healthBar.visible = false;
      this.tension = 0;
    }
    return this.health;
  }

  public applyHitReaction(_pushX: number): void {
    this.flashMs = HIT_FLASH_MS;
  }

  public clearHitTint(): void {}

  /** Debug (O key): freeze or resume the wing beat. */
  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  /** Flies towards its hover point in front of `targetX` at cruising altitude (alive and not cheering). */
  public update(deltaMs: number, targetX: number): void {
    if (!this.isAlive()) {
      return;
    }
    if (!this.cheering) {
      this.x = flyTowards(this.x, hoverX(targetX), this.speed, deltaMs);
    }
    this.y = flyTowards(this.y, cruiseAltitude(this.timeMs), 40, deltaMs);
  }

  /**
   * Turns the bow towards `worldAngle` and draws; returns true on the frame the arrow is loosed (then waits
   * DRAGON_SHOT_INTERVAL_MS, drawing over the last DRAGON_DRAW_MS of it).
   */
  public aim(worldAngle: number, deltaMs: number): boolean {
    if (!this.isAlive() || this.cheering) {
      return false;
    }
    this.aimAngle = worldAngle;
    this.shotTimerMs -= deltaMs;
    this.tension = Math.max(0, Math.min(1, 1 - this.shotTimerMs / DRAGON_DRAW_MS));
    if (this.shotTimerMs > 0) {
      return false;
    }
    this.shotTimerMs = DRAGON_SHOT_INTERVAL_MS;
    this.tension = 0;
    return true;
  }

  /** Out of range: ease the string back. */
  public relax(deltaMs: number): void {
    this.tension = Math.max(0, this.tension - deltaMs / RELAX_MS);
    this.shotTimerMs = Math.max(this.shotTimerMs, DRAGON_DRAW_MS);
  }

  /** Where the rider's arrow leaves the string, in world space. */
  public getBowReleasePoint(): Vec2 {
    const nock = this.pose.bow?.rig.stringNock ?? this.pose.rider.shoulder;
    return this.toWorld(nock);
  }

  public updateAnimation(deltaMs: number): void {
    this.flashMs = Math.max(0, this.flashMs - deltaMs);
    if (this.fall) {
      // Wings stop beating; it drops, tipping nose-down, and comes to rest on the ground.
      this.fall = fallStep(this.fall, groundAt(this.x) - LYING_CLEARANCE * DRAGON_SCALE, deltaMs);
      this.y = this.fall.y;
      this.rotation = -this.fall.rotation;
    } else if (!this.paused) {
      this.timeMs += deltaMs;
    }
    this.pose = this.redraw();
    this.art.tint = this.flashMs > 0 ? 0xffb0a8 : 0xffffff;
  }

  public getPhysicsBounds(): Bounds {
    const bob = this.pose.bob;
    return DragonEnemy.boundsAround([
      { x: BODY_BOX.left, y: BODY_BOX.top + bob }, { x: BODY_BOX.right, y: BODY_BOX.top + bob },
      { x: BODY_BOX.left, y: BODY_BOX.bottom + bob }, { x: BODY_BOX.right, y: BODY_BOX.bottom + bob },
    ].map((point) => this.toWorld(point)), 0);
  }

  /** The rider (head and shoulders above the dragon's back): hitting him counts as a headshot. */
  public getHeadBounds(): Bounds {
    const { head, shoulder } = this.pose.rider;
    const radius = STICKMAN_HEAD.radius * DRAGON_SCALE;
    return DragonEnemy.boundsAround([this.toWorld(head), this.toWorld(shoulder)], radius);
  }

  /** Arrows stick at a local point (stored in BodyAnchor's along/side) and follow the dragon. */
  public toBodyAnchor(point: Vec2, angle: number): BodyAnchor {
    const local = this.toLocalPoint(point);
    return { along: local.x, side: local.y, angle: Math.PI - (angle - this.rotation) };
  }

  public resolveBodyAnchor(anchor: BodyAnchor): { position: Vec2; rotation: number } {
    return { position: this.toWorld({ x: anchor.along, y: anchor.side }), rotation: this.rotation + Math.PI - anchor.angle };
  }

  private redraw(): DragonPose {
    // The sprite faces left (mirrored) and tilts while falling: turn the world aim into the rider's local aim.
    const local = normalizeAngle(Math.PI - (this.aimAngle - this.rotation));
    const aim = Math.min(AIM_MAX, Math.max(AIM_MIN, local));
    // Once killed the clock stops, so the wings freeze mid-beat while it falls.
    return drawDragonRider(this.art, this.timeMs, 'archer', { aim, tension: this.tension });
  }

  private toWorld(local: Vec2): Vec2 {
    const x = local.x * this.scale.x;
    const y = local.y * this.scale.y;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    return { x: this.x + x * cos - y * sin, y: this.y + x * sin + y * cos };
  }

  private toLocalPoint(world: Vec2): Vec2 {
    const dx = world.x - this.x;
    const dy = world.y - this.y;
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    return { x: (dx * cos - dy * sin) / this.scale.x, y: (dx * sin + dy * cos) / this.scale.y };
  }

  private drawHealthBar(): void {
    const ratio = this.health / this.maxHealth;
    const color = ratio > 0.6 ? 0x6fd36b : ratio > 0.3 ? 0xf2c94c : 0xe5534b;
    const { width, height, y } = HEALTH_BAR;
    this.healthBar.position.set(0, y);
    this.healthBar.clear()
      .rect(-width / 2 - 1, -height / 2 - 1, width + 2, height + 2).fill({ color: 0x1b1a20, alpha: 0.85 })
      .rect(-width / 2, -height / 2, width * ratio, height).fill({ color });
  }

  private static boundsAround(points: Vec2[], padding: number): Bounds {
    const left = Math.min(...points.map((point) => point.x)) - padding;
    const right = Math.max(...points.map((point) => point.x)) + padding;
    const top = Math.min(...points.map((point) => point.y)) - padding;
    const bottom = Math.max(...points.map((point) => point.y)) + padding;
    return { x: left, y: top, width: right - left, height: bottom - top, left, right, top, bottom };
  }
}
