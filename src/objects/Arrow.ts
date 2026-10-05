import { Graphics, Sprite, Texture } from 'pixi.js';
import { ARROW_GRAVITY, GAME_HEIGHT, WORLD_WIDTH } from '../config';
import type { ProjectileType } from '../types';

export interface Vec2 {
  x: number;
  y: number;
}

export default class Arrow extends Sprite {
  private static currentGravity = ARROW_GRAVITY;
  private stuck = false;
  private stuckTarget: { x: number; y: number } | undefined;
  private stuckOffset = { x: 0, y: 0 };
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

  public constructor(x: number, y: number, texture: Texture, trail: Graphics) {
    super(texture);
    this.trail = trail;
    this.anchor.set(0.5, 0.5);
    this.scale.set(0.5);
    this.position.set(x, y);
    this.zIndex = 2;
    this.visible = false;
  }

  public fire(angle: number, power: number, projectileType: ProjectileType = 'normal'): this {
    this.stuck = false;
    this.stuckTarget = undefined;
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
    this.tint = projectileType === 'explosive'
      ? 0xffa63d
      : projectileType === 'piercing'
        ? 0x8fe3ff
        : 0xffffff;
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
      if (this.stuckTarget) {
        this.segmentStart = { x: this.x, y: this.y };
        this.position.set(
          this.stuckTarget.x + this.stuckOffset.x,
          this.stuckTarget.y + this.stuckOffset.y,
        );
        this.segmentEnd = { x: this.x, y: this.y };
      }
      return;
    }

    this.segmentStart = { x: this.x, y: this.y };
    const deltaSeconds = deltaMs / 1000;
    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    const stepCount = Math.max(1, Math.ceil((speed * deltaSeconds) / 4));
    const stepSeconds = deltaSeconds / stepCount;

    for (let step = 0; step < stepCount; step += 1) {
      this.velocity.y += Arrow.currentGravity * stepSeconds;
      this.x += this.velocity.x * stepSeconds;
      this.y += this.velocity.y * stepSeconds;
    }

    this.segmentEnd = { x: this.x, y: this.y };

    if (this.trailVisible && Math.hypot(this.previousPosition.x - this.x, this.previousPosition.y - this.y) > 1) {
      this.trail.moveTo(this.previousPosition.x, this.previousPosition.y).lineTo(this.x, this.y)
        .stroke({ width: 5, color: 0xf3c969, alpha: 0.16 });
      this.trail.moveTo(this.previousPosition.x, this.previousPosition.y).lineTo(this.x, this.y)
        .stroke({ width: 2, color: 0xffe7a4, alpha: 0.72 });
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
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.y = y;
    return this;
  }

  public stickToEnemy(target: { x: number; y: number }, impactPoint = { x: this.x, y: this.y }): this {
    this.stuck = true;
    this.stuckTarget = target;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.stuckOffset = { x: impactPoint.x - target.x, y: impactPoint.y - target.y };
    this.position.set(impactPoint.x, impactPoint.y);
    return this;
  }

  public get isStuck(): boolean {
    return this.stuck;
  }

  public static setGravity(value: number): void {
    Arrow.currentGravity = Math.max(0, Math.min(1000, value));
  }

  public static getGravity(): number {
    return Arrow.currentGravity;
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
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.visible = false;
    this.activeProjectile = false;
    return this;
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
