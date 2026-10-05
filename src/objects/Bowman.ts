import { Container, Graphics } from 'pixi.js';
import type { IPushStrength, Rect, Vec2 } from '../types';
import { approach, clamp } from '../utils/math';
import { drawStickman } from '../rendering/stickman';
import {
  GRAVITY,
  JUMP_BUFFER_MS,
  JUMP_SPEED,
  SPRINT_ACCELERATION,
  SPRINT_DECELERATION,
  SPRINT_MAX_MULTIPLIER,
  WALK_ACCELERATION,
  WALK_DECELERATION,
} from '../config';

const BOW_PIVOT_X = 17;
export const BOW_RELEASE_OFFSET_X = BOW_PIVOT_X * 0.5;
const BODY_CENTER_Y = -55;
const BOW_ORBIT_OFFSET = { x: 56, y: -43 };
const BOW_STRING_OFFSET_X = -21;
const BOW_STRING_PULL_X = -35;

export interface BowmanAim {
  direction: Vec2;
  power: number;
  strength: IPushStrength;
}

export interface BowmanConfig {
  width?: number;
  height?: number;
  movementSpeed?: number;
  maxHealth?: number;
}

export class Bowman extends Container {
  public readonly maxHealth: number;
  public health: number;
  public readonly movementSpeed: number;

  private readonly boardBounds: Rect;
  private readonly bodyWidth: number;
  private readonly bodySprite: Graphics;
  private readonly groundY: number;
  private readonly bow: Graphics;
  private inTower = false;
  private verticalVelocity = 0;
  private horizontalSpeed = 0;
  private jumpBuffer = 0;
  private animationTime = 0;
  private animationIdleBlend = 1;
  private animationRunningBlend = 0;
  private facingDirection = 1;
  private aim: BowmanAim = {
    direction: { x: 1, y: 0 },
    power: 0,
    strength: { value: 0, max: 1, distance: 0 },
  };

  public constructor(
    x: number,
    y: number,
    boardBounds: Rect,
    config: BowmanConfig = {},
  ) {
    super();

    this.bodyWidth = config.width ?? 32;
    this.boardBounds = { ...boardBounds };
    this.movementSpeed = config.movementSpeed ?? 120;
    this.groundY = y;
    this.maxHealth = config.maxHealth ?? 100;
    this.health = this.maxHealth;

    this.bodySprite = new Graphics();
    this.addChild(this.bodySprite);

    this.bow = new Graphics();
    this.bow.position.set(BOW_ORBIT_OFFSET.x, BODY_CENTER_Y + BOW_ORBIT_OFFSET.y);
    this.drawBow(0);
    this.addChild(this.bow);

    this.scale.set(1 / 3);
    this.zIndex = 2;
    this.position.set(x, y);
    this.constrainToBoard();
  }

  public get isInTower(): boolean {
    return this.inTower;
  }

  public get currentSpeed(): number {
    return Math.abs(this.horizontalSpeed);
  }

  public enterTower(): void {
    this.inTower = true;
    this.zIndex = 0;
  }

  public exitTower(): void {
    this.inTower = false;
    this.zIndex = 2;
  }

  public moveHorizontal(direction: number, deltaSeconds = 0, sprinting = false): void {
    const clampedDirection = clamp(direction, -1, 1);
    if (this.inTower && clampedDirection === 0) {
      this.horizontalSpeed = 0;
      return;
    }

    if (clampedDirection !== 0 && deltaSeconds > 0) {
      const targetSpeed = clampedDirection * this.movementSpeed * (sprinting ? SPRINT_MAX_MULTIPLIER : 1);
      const acceleration = sprinting ? SPRINT_ACCELERATION : WALK_ACCELERATION;
      const isReversing = Math.sign(targetSpeed) !== Math.sign(this.horizontalSpeed) && Math.abs(this.horizontalSpeed) > 0;
      const step = (isReversing ? WALK_DECELERATION : acceleration) * deltaSeconds;
      this.horizontalSpeed = approach(this.horizontalSpeed, targetSpeed, step);
    } else if (deltaSeconds > 0) {
      const deceleration = Math.abs(this.horizontalSpeed) > this.movementSpeed
        ? SPRINT_DECELERATION
        : WALK_DECELERATION;
      this.horizontalSpeed = approach(this.horizontalSpeed, 0, deceleration * deltaSeconds);
    }

    this.x += this.horizontalSpeed * deltaSeconds;
    this.constrainToBoard();
  }

  public jump(): void {
    if (this.inTower) {
      return;
    }
    this.jumpBuffer = JUMP_BUFFER_MS;
    this.tryStartJump();
  }

  public updateVertical(deltaSeconds: number): void {
    if (this.inTower) {
      this.verticalVelocity = 0;
      this.jumpBuffer = 0;
      return;
    }

    this.jumpBuffer = Math.max(0, this.jumpBuffer - deltaSeconds * 1000);
    this.tryStartJump();

    if (this.verticalVelocity === 0 && this.y >= this.groundY) {
      this.y = this.groundY;
      return;
    }

    this.verticalVelocity += GRAVITY * deltaSeconds;
    this.y += this.verticalVelocity * deltaSeconds;

    if (this.y >= this.groundY && this.verticalVelocity >= 0) {
      this.y = this.groundY;
      this.verticalVelocity = 0;
    }
  }

  public setHorizontalPosition(x: number): void {
    this.x = x;
    this.constrainToBoard();
  }

  public setTowerPosition(x: number, y: number): void {
    this.verticalVelocity = 0;
    this.position.set(x, y);
  }

  public setAim(direction: Vec2, power: number): void {
    const length = Math.hypot(direction.x, direction.y);
    if (length > Number.EPSILON) {
      this.aim.direction = {
        x: direction.x / length,
        y: direction.y / length,
      };
    }
    this.aim.power = clamp(power, 0, 1);
    this.aim.strength = {
      value: this.aim.power,
      max: 1,
      distance: this.aim.power,
    };
    const angle = Math.atan2(this.aim.direction.y, this.aim.direction.x);
    this.bow.rotation = angle;
    this.bow.position.set(
      Math.cos(angle) * BOW_ORBIT_OFFSET.x - Math.sin(angle) * BOW_ORBIT_OFFSET.y,
      BODY_CENTER_Y + Math.sin(angle) * BOW_ORBIT_OFFSET.x + Math.cos(angle) * BOW_ORBIT_OFFSET.y,
    );
    if (Math.abs(this.aim.direction.x) > Number.EPSILON) {
      this.facingDirection = this.aim.direction.x < 0 ? -1 : 1;
      this.bodySprite.scale.x = this.facingDirection;
    }
    this.drawBow(this.aim.power);
  }

  public updateAnimation(deltaMs: number, moving: boolean, sprinting = false): void {
    const isMoving = moving || this.currentSpeed > 1;
    const targetIdleBlend = isMoving ? 0 : 1;
    const targetRunningBlend = isMoving && sprinting ? 1 : 0;
    const blendStep = deltaMs / 220;
    this.animationIdleBlend = approach(this.animationIdleBlend, targetIdleBlend, blendStep);
    this.animationRunningBlend = approach(this.animationRunningBlend, targetRunningBlend, blendStep);

    if (isMoving) {
      this.animationTime += deltaMs / (150 + this.animationRunningBlend * 10);
    }
    this.bodySprite.scale.x = this.facingDirection;
    drawStickman(this.bodySprite, this.animationTime, {
      idleBlend: this.animationIdleBlend,
      runningBlend: this.animationRunningBlend,
      originY: -55,
      archerPose: true,
      // FIXME: angle and power look swapped (bowTension gets radians, bowAngle gets 0..1).
      // Kept as-is during the refactor so the archer looks exactly the same.
      bowTension: this.bow.rotation,
      bowAngle: this.aim.power,
      facingDirection: this.facingDirection,
    });
  }

  public getAim(): BowmanAim {
    return {
      direction: { ...this.aim.direction },
      power: this.aim.power,
      strength: { ...this.aim.strength },
    };
  }

  public getBowReleasePoint(): Vec2 {
    const angle = this.bow.rotation;
    const stringOffsetX = BOW_STRING_OFFSET_X + BOW_STRING_PULL_X * this.aim.power;
    const releaseOffsetX = Math.cos(angle) * stringOffsetX * this.bow.scale.x;
    const releaseOffsetY = Math.sin(angle) * stringOffsetX * this.bow.scale.x;
    return {
      x: this.x + (this.bow.position.x + releaseOffsetX) * this.scale.x,
      y: this.y + (this.bow.position.y + releaseOffsetY) * this.scale.y,
    };
  }

  private drawBow(power: number): void {
    this.bow.clear();
    const curve = 21 + power * 3;
    const stringHandX = BOW_STRING_OFFSET_X + BOW_STRING_PULL_X * power;
    this.bow.moveTo(-21, -51).quadraticCurveTo(curve, 0, -21, 51).stroke({
      width: 5,
      color: 0x30243a,
      cap: 'round',
      join: 'round',
    });
    this.bow.moveTo(-21, -51).quadraticCurveTo(curve, 0, -21, 51).stroke({
      width: 3,
      color: 0xe3ad4f,
      cap: 'round',
      join: 'round',
    });
    this.bow.moveTo(-21, -51).lineTo(stringHandX, 0).lineTo(-21, 51).stroke({
      width: 1,
      color: 0xf6e2a4,
      cap: 'round',
      join: 'round',
    });
    const scale = 1 + power * 0.15;
    this.bow.scale.set(scale);
  }

  private constrainToBoard(): void {
    const halfWidth = this.bodyWidth / 2;
    this.x = clamp(this.x, this.boardBounds.x + halfWidth, this.boardBounds.x + this.boardBounds.width - halfWidth);
  }

  private tryStartJump(): void {
    if (this.jumpBuffer <= 0 || !this.isGrounded()) {
      return;
    }
    this.verticalVelocity = -JUMP_SPEED;
    this.jumpBuffer = 0;
  }

  private isGrounded(): boolean {
    return this.y >= this.groundY - 1.5 && this.verticalVelocity >= 0;
  }
}

export default Bowman;
