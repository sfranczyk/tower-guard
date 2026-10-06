import { Graphics, Sprite, Texture } from 'pixi.js';
import { ARROW_GRAVITY, GAME_HEIGHT, WORLD_WIDTH } from '../config';
import { DEFAULT_AIM_COLORS } from '../data/battlegrounds';
import { flightParams } from '../data/projectiles';
import { advanceProjectile, type FlightParams } from '../systems/ballistics';
import type { BodyAnchor } from '../systems/bodyAnchor';
import type { ProjectileType, Vec2 } from '../types';

/** Something an arrow can be pinned to that moves and changes pose (an enemy). */
export interface AnchorTarget {
  toBodyAnchor(point: Vec2, angle: number): BodyAnchor;
  resolveBodyAnchor(anchor: BodyAnchor): { position: Vec2; rotation: number };
}

export default class Arrow extends Sprite {
  private stuck = false;
  private stuckTarget: AnchorTarget | undefined;
  private stuckAnchor: BodyAnchor | undefined;
  private readonly velocity = { x: 0, y: 0 };
  private readonly trail: Graphics;
  private previousPosition = { x: 0, y: 0 };
  private segmentStart = { x: 0, y: 0 };
  private segmentEnd = { x: 0, y: 0 };
  private trailAge = 0;
  private trailVisible = true;
  private activeProjectile = false;
  private projectileType: ProjectileType = 'normal';
  private hitCount = 0;
  /** Shot by an enemy archer: hurts the bowman/keep, ignores enemies. */
  private hostileShot = false;

  public constructor(
    x: number,
    y: number,
    texture: Texture,
    trail: Graphics,
    private readonly trailColors: { glow: number; core: number } = { glow: DEFAULT_AIM_COLORS.trailGlow, core: DEFAULT_AIM_COLORS.trailCore },
  ) {
    super(texture);
    this.trail = trail;
    this.anchor.set(0.5, 0.5);
    this.scale.set(0.5);
    this.position.set(x, y);
    this.zIndex = 2;
    this.visible = false;
  }

  public fire(angle: number, power: number, projectileType: ProjectileType = 'normal', hostile = false): this {
    this.hostileShot = hostile;
    this.stuck = false;
    this.stuckTarget = undefined;
    this.stuckAnchor = undefined;
    this.trail.clear().visible = true;
    this.trail.alpha = 1;
    this.trailAge = 0;
    this.trailVisible = true;
    this.previousPosition = { x: this.x, y: this.y };
    this.segmentStart = { x: this.x, y: this.y };
    this.segmentEnd = { x: this.x, y: this.y };
    this.visible = true;
    this.activeProjectile = true;
    this.projectileType = projectileType;
    this.hitCount = 0;
    this.rotation = angle;
    this.velocity.x = Math.cos(angle) * power;
    this.velocity.y = Math.sin(angle) * power;
    return this;
  }

  public update(deltaMs: number): void {
    if (!this.activeProjectile) {
      return;
    }

    if (this.stuck) {
      if (this.stuckTarget && this.stuckAnchor) {
        // Ride along with the target's torso: walking, falling and lying.
        this.segmentStart = { x: this.x, y: this.y };
        const { position, rotation } = this.stuckTarget.resolveBodyAnchor(this.stuckAnchor);
        this.position.set(position.x, position.y);
        this.rotation = rotation;
        this.segmentEnd = { x: this.x, y: this.y };
      }
      return;
    }

    this.segmentStart = { x: this.x, y: this.y };
    const state = { x: this.x, y: this.y, vx: this.velocity.x, vy: this.velocity.y };
    advanceProjectile(state, deltaMs / 1000, Arrow.getFlightParams(this.projectileType));
    this.position.set(state.x, state.y);
    this.velocity.x = state.vx;
    this.velocity.y = state.vy;

    this.segmentEnd = { x: this.x, y: this.y };

    // Only the player's arrows leave a trail; enemy arrows fly clean.
    if (this.trailVisible && !this.hostileShot && Math.hypot(this.previousPosition.x - this.x, this.previousPosition.y - this.y) > 1) {
      this.trail.moveTo(this.previousPosition.x, this.previousPosition.y).lineTo(this.x, this.y)
        .stroke({ width: 2.5, color: this.trailColors.glow, alpha: 0.16 });
      this.trail.moveTo(this.previousPosition.x, this.previousPosition.y).lineTo(this.x, this.y)
        .stroke({ width: 1, color: this.trailColors.core, alpha: 0.72 });
      this.previousPosition = { x: this.x, y: this.y };
    }

    const velocityLengthSq = this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y;
    if (velocityLengthSq > 0) {
      this.rotation = Math.atan2(this.velocity.y, this.velocity.x);
    }

    const margin = 48;
    if (this.x < -margin || this.x > WORLD_WIDTH + margin || this.y > GAME_HEIGHT + margin) {
      this.deactivate();
    }
  }

  public stickToGround(y: number): this {
    this.stuck = true;
    this.stuckTarget = undefined;
    this.stuckAnchor = undefined;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.y = y;
    return this;
  }

  /** Pins the arrow where it hit; it then follows the target's body, including death falls. */
  public stickToEnemy(target: AnchorTarget, impactPoint = { x: this.x, y: this.y }): this {
    this.stuck = true;
    this.stuckTarget = target;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.position.set(impactPoint.x, impactPoint.y);
    this.stuckAnchor = target.toBodyAnchor(impactPoint, this.rotation);
    return this;
  }

  /** Current velocity (px/s), e.g. for a shrapnel burst. */
  public get velocityVector(): Vec2 {
    return { x: this.velocity.x, y: this.velocity.y };
  }

  public get isStuck(): boolean {
    return this.stuck;
  }

  /** Gravity and per-type air drag shared by arrows, the trajectory preview and enemy aim. */
  public static getFlightParams(type: ProjectileType): FlightParams {
    return flightParams(type, ARROW_GRAVITY);
  }

  public getTravelSegment(): { start: Vec2; end: Vec2 } {
    return {
      start: { ...this.segmentStart },
      end: { ...this.segmentEnd },
    };
  }

  public ageTrail(): void {
    if (!this.trailVisible) {
      return;
    }

    this.trailAge += 1;
    if (this.trailAge >= 3) {
      this.trail.clear();
      this.trail.visible = false;
      this.trailVisible = false;
      return;
    }

    this.trail.alpha = 1 - this.trailAge / 3;
  }

  public deactivate(): this {
    this.stuck = false;
    this.stuckTarget = undefined;
    this.stuckAnchor = undefined;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.visible = false;
    this.activeProjectile = false;
    return this;
  }

  public get hostile(): boolean {
    return this.hostileShot;
  }

  public get isActive(): boolean {
    return this.activeProjectile;
  }

  public get type(): ProjectileType {
    return this.projectileType;
  }

  public get impacts(): number {
    return this.hitCount;
  }

  public registerImpact(): void {
    this.hitCount += 1;
  }
}
