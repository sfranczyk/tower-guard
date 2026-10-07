import { Container, Graphics } from 'pixi.js';
import type { IPushStrength, Rect, Vec2 } from '../types';
import { groundAt } from '../systems/terrain';
import { approach, clamp } from '../utils/math';
import { getArcherRig, toArcherLocalAngle } from '../rendering/archer';
import type { ArmorPalette } from '../rendering/armor';
import { armoredFallPose, drawArmoredJointPose } from '../rendering/armoredPose';
import { STANDING_BURN_POINTS, burnPoints, drawBurning } from '../rendering/burning';
import { relight } from '../systems/burning';
import { drawStickman } from '../rendering/stickman';
import { FALL_DURATION_MS, getFallPose } from '../rendering/stickmanFall';
import {
  BOWMAN_KNOCKBACK,
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
/** A grounded bowman this close above the ground snaps onto it (walking downhill). */
const GROUND_SNAP = 4;
/** Time for the dead bowman to topple over backwards, and how far (just short of flat: armor). */
const TOPPLE_MS = 650;
const TOPPLE_ANGLE = Math.PI / 2 - 0.12;
/** Hip to feet in body-sprite space (drawStickman's standing feet). */
const HIP_TO_FEET = 55;
/** A burn fades out over its last this many ms; flames are drawn this much bigger than in the lab, to read at game size. */
const BURN_FADE_MS = 700;
const BURN_FLAME_SIZE = 1.6;

/** Knocked down by a blast: thrown onto his back (stickmanFall's knockback), lies a moment, gets up. */
interface Knockdown {
  kind: 'knockback' | 'getUp';
  timeMs: number;
  /** Extra slide away from the blast (px) over the fall, on top of the pose's own throw. */
  push: number;
  pushed: number;
}

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
  /** Armor colours (the battleground's `player` palette). */
  armorColors?: ArmorPalette;
}

export class Bowman extends Container {
  private readonly armorColors?: ArmorPalette;
  public readonly maxHealth: number;
  public health: number;
  /** Time since death; undefined while alive. */
  private deathMs?: number;
  public readonly movementSpeed: number;

  private readonly boardBounds: Rect;
  private readonly bodyWidth: number;
  private readonly bodySprite: Graphics;
  /** Flames while burning (container space, over the body). */
  private readonly flameArt = new Graphics();
  private burnMs = 0;
  private burnClockMs = 0;
  private inTower = false;
  private verticalVelocity = 0;
  private horizontalSpeed = 0;
  private jumpBuffer = 0;
  private knockdown?: Knockdown;
  /** Co-op host: told when he's knocked down or catches fire, to replay it on the guest's screen. */
  public netHooks?: { knockedBack(fromX: number, strength: number): void; ignited(): void };
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
    this.maxHealth = config.maxHealth ?? 100;
    this.armorColors = config.armorColors;
    this.health = this.maxHealth;

    this.bodySprite = new Graphics();
    this.addChild(this.bodySprite, this.flameArt);

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

  /** On fire: takes steady damage until the burn runs out (CombatSystem applies it). */
  public get isBurning(): boolean {
    return this.burnMs > 0;
  }

  public get burnRemainingMs(): number {
    return this.burnMs;
  }

  /** Touched by fire: catches (or keeps) burning for the full BURN_DURATION_MS. Returns true if he just caught fire. */
  public ignite(): boolean {
    this.netHooks?.ignited();
    const caught = this.burnMs <= 0;
    this.burnMs = relight();
    return caught;
  }

  /** Horizontal speed (px/s, signed), for co-op snapshots. */
  public get velocityX(): number {
    return this.horizontalSpeed;
  }

  /**
   * Co-op guest: the other player's bowman, placed as the host has him (his controls run on the host):
   * position, walking speed (for the animation), the keep, and the bow.
   */
  public applyRemote(state: { x: number; y: number; vx: number; inTower: boolean; ax: number; ay: number; power: number }): void {
    if (state.inTower !== this.inTower) {
      if (state.inTower) {
        this.enterTower();
      } else {
        this.exitTower();
      }
    }
    this.position.set(state.x, state.y);
    this.horizontalSpeed = this.knockdown ? 0 : state.vx;
    this.verticalVelocity = 0;
    this.setAim({ x: state.ax, y: state.ay }, state.power);
  }

  /** Co-op guest: the host has this player somewhere else; put him there (prediction went wrong). */
  public correctTo(x: number, y: number): void {
    this.position.set(x, y);
    this.verticalVelocity = 0;
  }

  /** Knocked down (falling, lying or getting up): can't move, jump, aim or enter the keep. */
  public get isStunned(): boolean {
    return this.knockdown !== undefined;
  }

  /**
   * Thrown onto his back away from a blast at `fromX` (he turns to face it), slides up to
   * BOWMAN_KNOCKBACK.pushMax × `strength` (0..1) further, lies a moment and gets up. Ignored inside the keep.
   */
  public knockBack(fromX: number, strength: number): void {
    if (this.inTower || this.knockdown) {
      return;
    }
    this.netHooks?.knockedBack(fromX, strength);
    this.facingDirection = fromX >= this.x ? 1 : -1;
    this.aim = { ...this.aim, direction: { x: this.facingDirection, y: 0 }, power: 0 };
    this.bowReady = 0;
    this.horizontalSpeed = 0;
    this.jumpBuffer = 0;
    this.knockdown = { kind: 'knockback', timeMs: 0, push: BOWMAN_KNOCKBACK.pushMax * clamp(strength, 0, 1), pushed: 0 };
    this.redraw();
  }

  public moveHorizontal(direction: number, deltaSeconds = 0, sprinting = false): void {
    if (this.knockdown) {
      // Knocked down: no control (the slide is applied in updateKnockdown).
      this.horizontalSpeed = 0;
      return;
    }
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
    if (this.inTower || this.knockdown) {
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

    // Standing or walking: stick to the wavy ground both up and down hill (no micro-falls).
    const ground = this.groundY;
    if (this.verticalVelocity === 0 && this.y >= ground - GROUND_SNAP) {
      this.y = ground;
      return;
    }

    this.verticalVelocity += GRAVITY * deltaSeconds;
    this.y += this.verticalVelocity * deltaSeconds;

    if (this.y >= this.groundY && this.verticalVelocity >= 0) {
      this.y = this.groundY;
      this.verticalVelocity = 0;
    }
  }

  /** Ground height under the bowman. */
  private get groundY(): number {
    return groundAt(this.x);
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
    if (this.knockdown) {
      return;
    }
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

  /**
   * Killed: drops the aim and topples over backwards (see updateAnimation); `alreadyFallen` (fell in an
   * earlier wave) starts him lying on his back.
   */
  public die(alreadyFallen = false): void {
    if (this.deathMs === undefined) {
      this.deathMs = alreadyFallen ? TOPPLE_MS : 0;
      this.aim.power = 0;
      this.updateDeath(0);
    }
  }

  public get isDead(): boolean {
    return this.deathMs !== undefined;
  }

  public updateAnimation(deltaMs: number, moving: boolean, sprinting = false): void {
    this.updateBody(deltaMs, moving, sprinting);
    this.updateBurn(deltaMs);
  }

  private updateBody(deltaMs: number, moving: boolean, sprinting: boolean): void {
    if (this.knockdown) {
      this.updateKnockdown(deltaMs);
      return;
    }
    if (this.deathMs !== undefined) {
      this.deathMs += deltaMs;
      this.updateDeath(deltaMs);
      return;
    }
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

  /** Counts the burn down and draws the flames on the body as it is now (standing, falling or lying). */
  private updateBurn(deltaMs: number): void {
    this.flameArt.clear();
    if (this.burnMs <= 0) {
      return;
    }
    this.burnMs = Math.max(0, this.burnMs - deltaMs);
    this.burnClockMs += deltaMs;
    drawBurning(this.flameArt, this.bodyBurnPoints(), this.burnClockMs, Math.min(1, this.burnMs / BURN_FADE_MS), BURN_FLAME_SIZE);
  }

  /** Where the fire burns from, in container space: the fall pose's joints, or the standing figure's (leaning, toppling). */
  private bodyBurnPoints(): Vec2[] {
    const body = this.bodySprite;
    const points = this.knockdown
      ? burnPoints(armoredFallPose(this.knockdown.kind, this.knockdownProgress))
      : STANDING_BURN_POINTS;
    const cos = Math.cos(body.rotation);
    const sin = Math.sin(body.rotation);
    return points.map(({ x, y }) => {
      const scaledX = x * body.scale.x;
      const scaledY = y * body.scale.y;
      return { x: body.x + scaledX * cos - scaledY * sin, y: body.y + scaledX * sin + scaledY * cos };
    });
  }

  private get knockdownProgress(): number {
    const knockdown = this.knockdown;
    return knockdown ? Math.min(1, (knockdown.timeMs * BOWMAN_KNOCKBACK.animationSpeed) / FALL_DURATION_MS[knockdown.kind]) : 0;
  }

  /**
   * Plays the fall, slides away from the blast meanwhile, lies BOWMAN_KNOCKBACK.lieMs and gets up; then moves
   * to where the get-up pose ends. Killed meanwhile, he stays lying on his back.
   */
  private updateKnockdown(deltaMs: number): void {
    const knockdown = this.knockdown!;
    knockdown.timeMs += deltaMs;
    const progress = this.knockdownProgress;
    if (knockdown.kind === 'knockback') {
      // Away from the blast is −facing; most of the slide while flying, easing out on landing.
      const target = knockdown.push * progress * progress * (3 - 2 * progress);
      this.x -= this.facingDirection * (target - knockdown.pushed);
      knockdown.pushed = target;
      this.constrainToBoard();
      const lyingMs = knockdown.timeMs - FALL_DURATION_MS.knockback / BOWMAN_KNOCKBACK.animationSpeed;
      if (lyingMs >= BOWMAN_KNOCKBACK.lieMs && this.deathMs === undefined) {
        this.knockdown = { ...knockdown, kind: 'getUp', timeMs: 0 };
      }
    } else if (progress >= 1) {
      // The get-up ends standing behind where the fall started; move there for real.
      this.x += getFallPose('getUp', 1).hip.x * this.facingDirection * this.scale.x;
      this.constrainToBoard();
      this.knockdown = undefined;
      this.animationIdleBlend = 1;
      this.animationRunningBlend = 0;
    }
    this.redraw();
  }

  /** Standing pose with the bow lowered, rotated about the feet as the body tips over. */
  private updateDeath(deltaMs: number): void {
    this.animationIdleBlend = approach(this.animationIdleBlend, 1, deltaMs / 120);
    this.animationRunningBlend = 0;
    this.bowReady = approach(this.bowReady, 0, deltaMs / BOW_LOWER_MS);
    this.redraw();
    const t = Math.min(1, (this.deathMs ?? 0) / TOPPLE_MS);
    // Accelerates like a falling plank; backwards = away from the facing direction.
    const angle = -this.facingDirection * TOPPLE_ANGLE * t * t;
    const feet = HIP_TO_FEET * this.bodySprite.scale.y;
    this.bodySprite.rotation = angle;
    this.bodySprite.position.set(Math.sin(angle) * feet, BODY_ORIGIN_Y + feet - Math.cos(angle) * feet);
  }

  private redraw(): void {
    this.bodySprite.scale.x = this.facingDirection;
    if (this.knockdown) {
      drawArmoredJointPose(this.bodySprite, armoredFallPose(this.knockdown.kind, this.knockdownProgress), BODY_ORIGIN_Y, this.armorColors);
      return;
    }
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
      armorColors: this.armorColors,
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
