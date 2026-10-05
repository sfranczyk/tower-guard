import { Container, Graphics } from 'pixi.js';
import type { IPushStrength, Rect, Vec2 } from '../types';
import { approach, clamp } from '../utils/math';
import { getArcherRig, toArcherLocalAngle } from '../rendering/archer';
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

/** Body sprite baseline (hip height) relative to the bowman's feet, in unscaled units. */
const BODY_ORIGIN_Y = -55;
/** Time for the body lean to swing from one side to the other after turning around. */
const LEAN_TURN_MS = 260;
/** Raising the bow when a draw starts, and lowering it after the shot. */
const BOW_RAISE_MS = 200;
const BOW_LOWER_MS = 380;

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
  private inTower = false;
  private verticalVelocity = 0;
  private horizontalSpeed = 0;
  private jumpBuffer = 0;
  private animationTime = 0;
  private animationIdleBlend = 1;
  private animationRunningBlend = 0;
  private facingDirection = 1;
  /** Follows facingDirection smoothly so the lean doesn't flip instantly on a turn. */
  private leanDirection = 1;
  /** 0 = bow held low (default), 1 = raised to aim; follows whether the player is drawing. */
  private bowReady = 0;
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

    this.scale.set(1 / 3);
    this.zIndex = 2;
    this.position.set(x, y);
    this.constrainToBoard();
    this.redraw();
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
    if (Math.abs(this.aim.direction.x) > Number.EPSILON) {
      this.facingDirection = this.aim.direction.x < 0 ? -1 : 1;
    }
    this.redraw();
  }

  public updateAnimation(deltaMs: number, moving: boolean, sprinting = false): void {
    const isMoving = moving || this.currentSpeed > 1;
    const targetIdleBlend = isMoving ? 0 : 1;
    const targetRunningBlend = isMoving && sprinting ? 1 : 0;
    const blendStep = deltaMs / 220;
    this.animationIdleBlend = approach(this.animationIdleBlend, targetIdleBlend, blendStep);
    this.animationRunningBlend = approach(this.animationRunningBlend, targetRunningBlend, blendStep);

    if (isMoving) {
      // Faster cadence when sprinting.
      this.animationTime += deltaMs / (150 - this.animationRunningBlend * 19);
    }
    // While the bow isn't drawn, face the way we're running and carry the bow pointing forward.
    // While drawing, facing follows the aim (set in setAim).
    if (this.aim.power <= 0 && this.currentSpeed > 1) {
      this.facingDirection = Math.sign(this.horizontalSpeed);
      this.aim.direction = { x: this.facingDirection, y: 0 };
    }
    this.leanDirection = approach(this.leanDirection, this.facingDirection, (deltaMs / LEAN_TURN_MS) * 2);
    // The bow comes up while the player draws and goes back down after the shot.
    const drawing = this.aim.power > 0;
    this.bowReady = approach(this.bowReady, drawing ? 1 : 0, deltaMs / (drawing ? BOW_RAISE_MS : BOW_LOWER_MS));
    this.redraw();
  }

  public getAim(): BowmanAim {
    return {
      direction: { ...this.aim.direction },
      power: this.aim.power,
      strength: { ...this.aim.strength },
    };
  }

  /** Where the arrow is nocked: the string hand, converted from body-sprite space to world space. */
  public getBowReleasePoint(): Vec2 {
    const body = this.bodySprite;
    const localAngle = toArcherLocalAngle(this.aimAngle, body.rotation, this.facingDirection);
    const hand = getArcherRig(localAngle, this.aim.power, this.bowReady).stringNock;
    const cos = Math.cos(body.rotation);
    const sin = Math.sin(body.rotation);
    const x = hand.x * body.scale.x;
    const y = hand.y * body.scale.y;
    return {
      x: this.x + (body.x + x * cos - y * sin) * this.scale.x,
      y: this.y + (body.y + x * sin + y * cos) * this.scale.y,
    };
  }

  private get aimAngle(): number {
    return Math.atan2(this.aim.direction.y, this.aim.direction.x);
  }

  private redraw(): void {
    this.bodySprite.scale.x = this.facingDirection;
    drawStickman(this.bodySprite, this.animationTime, {
      idleBlend: this.animationIdleBlend,
      runningBlend: this.animationRunningBlend,
      originY: BODY_ORIGIN_Y,
      archerPose: true,
      bowTension: this.aim.power,
      bowReady: this.bowReady,
      bowAngle: this.aimAngle,
      facingDirection: this.facingDirection,
      leanDirection: this.leanDirection,
      skin: 'armored',
    });
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
