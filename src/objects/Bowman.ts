import { Container, Graphics } from 'pixi.js';
import type { IPushStrength, Rect, Vec2 } from '../types';
import { AfflictionLayer, type AfflictionNet } from './AfflictionLayer';
import { getFlailPose } from '../rendering/stickmanFlail';
import { BodyMotion } from '../systems/bodyMotion';
import { knockdownProgress, landedKnockdown, startKnockdown, stepKnockdown, walkSpeed, type Knockdown } from '../systems/bowmanMotion';
import { spriteToContainer } from '../systems/bodyAnchor';
import type { JointPose } from '../rendering/stickmanPose';
import { groundAt } from '../systems/terrain';
import { approach, clamp } from '../utils/math';
import { getArcherRig, toArcherLocalAngle } from '../rendering/archer';
import type { ArmorPalette } from '../rendering/armor';
import { armoredFallPose } from '../rendering/armoredPose';
import { STANDING_BURN_POINTS, burnPoints } from '../rendering/burning';
import { relight } from '../systems/burning';
import { drawBowmanBody, drawBowmanFall, type BowmanLook } from '../rendering/bowmanBody';
import { FALL_DURATION_MS, getFallPose, type FallKind } from '../rendering/stickmanFall';
import { deathFallFor, type BowmanHit } from '../systems/bowmanDeath';
import { GRAVITY, JUMP_BUFFER_MS, JUMP_SPEED } from '../config';

/** Body sprite baseline (hip height) relative to the bowman's feet, in unscaled units. */
const BODY_ORIGIN_Y = -55;
/** Time for the body lean to swing from one side to the other after turning around. */
const LEAN_TURN_MS = 260;
/** Raising the bow when a draw starts, and lowering it after the shot. */
const BOW_RAISE_MS = 200;
const BOW_LOWER_MS = 380;
/** A grounded bowman this close above the ground snaps onto it (walking downhill). */
const GROUND_SNAP = 4;
/** A burn fades out over its last this many ms; flames are drawn this much bigger than in the lab, to read at game size. */
const BURN_FADE_MS = 700;
const BURN_FLAME_SIZE = 1.6;
/** Frost glints, the ice block and the vortex glow are drawn this big (container space). */
const AFFLICTION_SIZE = 1;
/** Lifted this high (px) in a vortex, he flails. */
const FLAIL_LIFT = 4;
/** Levitating, he's drawn in front of the funnel. */
const LEVITATE_Z = 4;
/** Thrown by a vortex he lands into the knockback this far into it (lying on his back). */
const LANDING_PROGRESS = 0.72;
/** The pinned foot is this far behind him (px). */
const PINNED_FOOT_BACK = 4;

/** What the co-op guest needs to show his fire, frost and vortex state, a throw and a pin. */
export interface BowmanNet {
  af?: AfflictionNet;
  th?: { vx: number; spin: number };
  pin?: number;
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
  /** Ranger (default, player 1) or keep warden (the co-op second player). */
  look?: BowmanLook;
}

export class Bowman extends Container {
  private readonly armorColors?: ArmorPalette;
  private readonly look: BowmanLook;
  /** Always-running clock for the look's own motion (the cloak). */
  private lookTimeMs = 0;
  public readonly maxHealth: number;
  public health: number;
  /** Time since death; undefined while alive. */
  private deathMs?: number;
  /** The fall he dies in (as the enemies': stickmanFall), unless a knockdown was already throwing him down. */
  private deathFall?: { kind: FallKind; timeMs: number };
  /** What hurt him last (picks how he falls if it kills him). */
  private lastHit?: BowmanHit;
  public readonly movementSpeed: number;

  private readonly boardBounds: Rect;
  private readonly bodyWidth: number;
  private readonly bodySprite: Graphics;
  private inTower = false;
  private verticalVelocity = 0;
  private horizontalSpeed = 0;
  private jumpBuffer = 0;
  private knockdown?: Knockdown;
  /**
   * His fire (the fire dragon's flames, and with friendly fire the fire arrows: BURN_DURATION_MS, his own flame
   * size), frost and vortex state, drawn over him.
   */
  public readonly afflictions = new AfflictionLayer('basic', { burnMs: relight(), flameSize: BURN_FLAME_SIZE, burnFadeMs: BURN_FADE_MS });
  /**
   * Thrown through the air by a vortex, flailing until he lands (then `onLanded`: the host deals the fall); pinned by
   * the foot to the ground by a pinning arrow (can't walk, jump or hide, still shoots).
   */
  private readonly motion = new BodyMotion();
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
    this.look = config.look ?? 'ranger';
    this.health = this.maxHealth;

    this.bodySprite = new Graphics();
    this.addChild(this.bodySprite, this.afflictions.art);

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
    return this.afflictions.isBurning;
  }

  public get burnRemainingMs(): number {
    return this.afflictions.burnMs;
  }

  /**
   * Touched by fire: catches (or keeps) burning for the full BURN_DURATION_MS; it thaws the ice and drives the chill
   * out. Returns true if he just caught fire.
   */
  public ignite(): boolean {
    this.netHooks?.ignited();
    return this.afflictions.ignite();
  }

  /** Host: told when he lands from a throw, with the speed he hit the ground at (for the fall damage). */
  public get onLanded(): ((impactSpeed: number) => void) | undefined {
    return this.motion.onLanded;
  }

  public set onLanded(callback: ((impactSpeed: number) => void) | undefined) {
    this.motion.onLanded = callback;
  }

  /** Hit by a frost arrow (friendly fire): puts his fire out and chills him; returns true if he just froze solid. */
  public chill(headshot: boolean): boolean {
    if (this.isDead) {
      return false;
    }
    // Frost puts his fire out.
    const froze = this.afflictions.chill(headshot);
    if (froze) {
      this.dropDraw();
    }
    return froze;
  }

  /** Frozen solid: can't move, jump, aim or enter the keep. */
  public get isFrozen(): boolean {
    return this.afflictions.isFrozen;
  }

  /** Held by a vortex or thrown through the air by one. */
  public get isAloft(): boolean {
    return this.motion.isThrown || this.afflictions.inVortex;
  }

  /** Knocked down or thrown through the air (alive); a vortex lets go of him then. */
  public get isDown(): boolean {
    return !this.isDead && (this.knockdown !== undefined || this.motion.isThrown);
  }

  public get isPinned(): boolean {
    return !this.isDead && this.motion.isPinned;
  }

  public isAlive(): boolean {
    return !this.isDead;
  }

  /** Pinned by the foot for `durationMs` (a fresh pin restarts the time); not while up in the air or knocked down. */
  public pin(durationMs: number): void {
    if (!this.isDead && !this.isAloft && !this.knockdown && !this.inTower) {
      this.motion.pin(durationMs);
      this.horizontalSpeed = 0;
    }
  }

  /** Where his pinned foot is (world): just behind him, on the ground. */
  public pinnedFootPoint(): Vec2 {
    const x = this.x - this.facingDirection * PINNED_FOOT_BACK;
    return { x, y: groundAt(x) };
  }

  /**
   * Held by a vortex this frame at `x`, lifted `lift` px (he flails once off his feet) and turned `lean`;
   * `levitating` when the vortex arrow hit him (he glows). Meanwhile he can't move, aim or shoot.
   */
  public holdInVortex(x: number, lift: number, lean: number, levitating = false): void {
    if (this.isDead || this.knockdown || this.motion.isThrown || this.inTower) {
      return;
    }
    this.x = x;
    this.constrainToBoard();
    this.y = groundAt(this.x) - lift;
    this.afflictions.holdInVortex(lift, lean, levitating);
    this.dropDraw();
    this.horizontalSpeed = 0;
    this.verticalVelocity = 0;
    this.motion.setPin(0);
  }

  /** Thrown through the air at (`vx`, `vy`) px/s, tumbling at `spin` radians/s: he flails and lands on his back. */
  public throwInAir(vx: number, vy: number, spin: number): void {
    if (this.knockdown || this.motion.isThrown) {
      return;
    }
    const rotation = this.afflictions.inVortex ? this.afflictions.lean : 0;
    this.afflictions.releaseVortex();
    this.motion.throw(this.x, this.y, vx, vy, spin, rotation);
    this.dropDraw();
    this.horizontalSpeed = 0;
    this.verticalVelocity = 0;
    this.motion.setPin(0);
    // Faces against the way he flies, so he falls backwards along it.
    this.facingDirection = vx > 0 ? -1 : 1;
  }

  /** The draw is lost (frozen, caught, thrown). */
  private dropDraw(): void {
    this.aim = { ...this.aim, power: 0 };
    this.bowReady = 0;
    this.jumpBuffer = 0;
  }

  /** Co-op host: his frost, vortex, throw and pin for the guest. */
  public getNetState(): BowmanNet {
    const af = this.afflictions.getNetState();
    const th = this.motion.netThrow;
    const pin = this.motion.isPinned ? Math.round(this.motion.pinnedMs) : undefined;
    return { af, th, pin };
  }

  /** Co-op guest: the host's frost, vortex, throw and pin (his position comes with applyRemote / correctTo). */
  public applyNetState(net: BowmanNet): void {
    const wasFrozen = this.isFrozen;
    this.afflictions.applyNetState(net.af);
    if (net.af?.lift !== undefined || (!wasFrozen && this.isFrozen)) {
      this.dropDraw();
    }
    this.motion.setPin(net.pin ?? 0);
    if (net.th && !this.motion.isThrown && !this.knockdown) {
      this.throwInAir(net.th.vx, 0, net.th.spin);
      this.motion.fromNet = true;
    } else if (!net.th && this.motion.flight && this.motion.fromNet) {
      this.land(this.motion.flight.vx, 0);
    }
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
    this.motion.placeFlight(state.x, state.y);
    this.horizontalSpeed = this.knockdown || this.isAloft ? 0 : state.vx;
    this.verticalVelocity = 0;
    this.setAim({ x: state.ax, y: state.ay }, state.power);
  }

  /** Co-op guest: the host has this player somewhere else; put him there (prediction went wrong). */
  public correctTo(x: number, y: number): void {
    this.position.set(x, y);
    this.motion.placeFlight(x, y);
    this.verticalVelocity = 0;
  }

  /**
   * Knocked down (falling, lying or getting up), frozen solid, or held or thrown by a vortex: can't move, jump,
   * aim or enter the keep.
   */
  public get isStunned(): boolean {
    return this.knockdown !== undefined || this.isFrozen || this.isAloft;
  }

  /**
   * Thrown onto his back away from a blast at `fromX` (he turns to face it), slides up to
   * BOWMAN_KNOCKBACK.pushMax × `strength` (0..1) further, lies a moment and gets up. Ignored inside the keep.
   */
  public knockBack(fromX: number, strength: number): void {
    if (this.inTower || this.knockdown || this.isAloft) {
      return;
    }
    this.netHooks?.knockedBack(fromX, strength);
    // The blast breaks the ice and tears the pin out.
    this.afflictions.warm();
    this.motion.setPin(0);
    this.facingDirection = fromX >= this.x ? 1 : -1;
    this.aim = { ...this.aim, direction: { x: this.facingDirection, y: 0 }, power: 0 };
    this.bowReady = 0;
    this.horizontalSpeed = 0;
    this.jumpBuffer = 0;
    this.knockdown = startKnockdown(strength);
    this.redraw();
  }

  public moveHorizontal(direction: number, deltaSeconds = 0, sprinting = false): void {
    if (this.isStunned || this.isPinned) {
      // Knocked down, frozen, caught or pinned: no control (a knockdown's slide is applied in updateKnockdown).
      this.horizontalSpeed = 0;
      return;
    }
    const clampedDirection = clamp(direction, -1, 1);
    if (this.inTower && clampedDirection === 0) {
      this.horizontalSpeed = 0;
      return;
    }

    // Chilled, he walks at the frost's pace.
    this.horizontalSpeed = walkSpeed(this.horizontalSpeed, clampedDirection, sprinting, deltaSeconds, this.movementSpeed, this.afflictions.timeScale);

    this.x += this.horizontalSpeed * deltaSeconds;
    this.constrainToBoard();
  }

  public jump(): void {
    if (this.inTower || this.isStunned || this.isPinned) {
      return;
    }
    this.jumpBuffer = JUMP_BUFFER_MS;
    this.tryStartJump();
  }

  public updateVertical(deltaSeconds: number): void {
    // A vortex (or its throw) moves him.
    if (this.inTower || this.isAloft) {
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
    if (this.isStunned) {
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

  /** Hurt by `hit` (CombatSystem): if it kills him, it decides how he falls. */
  public noteHit(hit: BowmanHit): void {
    this.lastHit = hit;
  }

  /** Where the last hit came from (co-op: the guest turns him the same way as he falls). */
  public get lastHitFromX(): number | undefined {
    return this.lastHit?.fromX;
  }

  /**
   * Killed: drops the aim and falls like an enemy would to what hit him last (deathFallFor), turned as if hit from
   * there; `kind` and `fromX` set it instead (a co-op guest plays the host's). Thrown down by a blast already, he
   * just stays down. `alreadyFallen` (fell in an earlier wave) starts him lying on his back. Returns the fall.
   */
  public die(death: { kind?: FallKind; fromX?: number } = {}, alreadyFallen = false): FallKind {
    if (this.deathMs !== undefined) {
      return this.deathFall?.kind ?? 'knockback';
    }
    this.deathMs = 0;
    this.aim.power = 0;
    this.bowReady = 0;
    this.horizontalSpeed = 0;
    this.motion.setPin(0);
    // Frozen solid, he topples stiffly (the scene shatters the ice).
    const frozen = this.isFrozen;
    this.afflictions.warm();
    if (this.afflictions.inVortex) {
      // Killed in a vortex: he drops out of it and lands lying.
      this.throwInAir(0, 0, 0);
    }
    if (this.motion.isThrown) {
      // Up in the air: he falls, lands on his back and stays there (land).
      return 'knockback';
    }
    if (alreadyFallen) {
      this.knockdown = undefined;
      this.deathFall = { kind: 'knockback', timeMs: FALL_DURATION_MS.knockback };
    } else if (this.knockdown?.kind === 'knockback') {
      // Thrown down by the blast that killed him: he doesn't get up (updateKnockdown).
      return 'knockback';
    } else {
      this.knockdown = undefined;
      const fromX = death.fromX ?? this.lastHit?.fromX;
      if (fromX !== undefined && fromX !== this.x) {
        this.facingDirection = fromX > this.x ? 1 : -1;
      }
      this.deathFall = { kind: death.kind ?? (frozen ? 'deathStiff' : deathFallFor(this.lastHit?.cause)), timeMs: 0 };
    }
    this.redraw();
    return this.deathFall.kind;
  }

  public get isDead(): boolean {
    return this.deathMs !== undefined;
  }

  /**
   * Counts his afflictions and pin down (real time), plays the body at the frost's pace (held while frozen), flies
   * him when thrown, and draws the burn, frost and vortex glow over him.
   */
  public updateAnimation(deltaMs: number, moving: boolean, sprinting = false): void {
    this.lookTimeMs += deltaMs;
    this.afflictions.tick(deltaMs);
    this.motion.tickPin(deltaMs);
    this.zIndex = this.afflictions.levitating ? LEVITATE_Z : this.inTower ? 0 : 2;
    if (this.motion.isThrown) {
      this.updateFlight(deltaMs);
    } else {
      this.updateBody(deltaMs * this.afflictions.timeScale, moving && !this.isPinned, sprinting);
    }
    this.bodySprite.tint = this.afflictions.tint;
    // On the body as it is now (standing, falling, lying or flailing); the ice block round the standing figure.
    this.afflictions.draw(this.bodyBurnPoints(), AFFLICTION_SIZE, this.toContainer(STANDING_BURN_POINTS));
  }

  /** Thrown by a vortex: falls, tumbles and flails (frozen, as a block of ice) and lands on his back. */
  private updateFlight(deltaMs: number): void {
    const { vx } = this.motion.flight!;
    const { x, width } = this.boardBounds;
    const halfWidth = this.bodyWidth / 2;
    // Co-op guest: the host moves him and says when he's down (applyNetState); only the tumble is played here.
    const driven = this.motion.fromNet;
    const step = this.motion.step(deltaMs, x + halfWidth, x + width - halfWidth, driven);
    if (step.landed && !driven) {
      this.position.set(step.flight.x, step.flight.y);
      this.land(vx, step.impactSpeed);
      return;
    }
    if (!driven) {
      this.position.set(step.flight.x, step.flight.y);
    }
    this.redraw();
  }

  /** Hits the ground on his back (into the knockback's lying pose); alive, he gets up after a while. Then onLanded. */
  private land(vx: number, impactSpeed: number): void {
    const landed = this.motion.endFlight();
    this.y = groundAt(this.x);
    this.verticalVelocity = 0;
    this.facingDirection = vx > 0 ? -1 : 1;
    if (this.isDead) {
      this.deathFall = { kind: 'knockback', timeMs: FALL_DURATION_MS.knockback * LANDING_PROGRESS };
    } else {
      this.knockdown = landedKnockdown(LANDING_PROGRESS);
    }
    this.redraw();
    landed?.(impactSpeed);
  }

  /** Off his feet in a vortex, or thrown by one (not frozen): flailing. */
  private get isFlailing(): boolean {
    if (this.isFrozen || this.knockdown || this.deathFall) {
      return false;
    }
    return this.motion.isThrown || (this.afflictions.inVortex && this.afflictions.lift > FLAIL_LIFT);
  }

  private updateBody(deltaMs: number, moving: boolean, sprinting: boolean): void {
    if (this.knockdown) {
      this.updateKnockdown(deltaMs);
      return;
    }
    if (this.deathMs !== undefined) {
      this.deathMs += deltaMs;
      if (this.deathFall) {
        this.deathFall.timeMs += deltaMs;
      }
      this.redraw();
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

  /** Where the fire burns from, in container space: the fall pose's joints, or the standing figure's (leaning, toppling). */
  private bodyBurnPoints(): Vec2[] {
    const fall = this.currentFallPose();
    return this.toContainer(fall ? burnPoints(fall) : STANDING_BURN_POINTS);
  }

  /** Body-sprite points in container space (as the body is turned now). */
  private toContainer(points: readonly Vec2[]): Vec2[] {
    return spriteToContainer(points, this.bodySprite);
  }

  /** The joint pose he's in: knocked down (and getting up), dying, or flailing in (or out of) a vortex. */
  private currentFallPose(): JointPose | undefined {
    if (this.isFlailing) {
      return getFlailPose(this.lookTimeMs);
    }
    if (this.knockdown) {
      return armoredFallPose(this.knockdown.kind, this.knockdownProgress);
    }
    if (this.deathFall) {
      const { kind, timeMs } = this.deathFall;
      return armoredFallPose(kind, Math.min(1, timeMs / FALL_DURATION_MS[kind]));
    }
    return undefined;
  }

  private get knockdownProgress(): number {
    return this.knockdown ? knockdownProgress(this.knockdown) : 0;
  }

  /**
   * Plays the fall, slides away from the blast meanwhile, lies BOWMAN_KNOCKBACK.lieMs and gets up; then moves
   * to where the get-up pose ends. Killed meanwhile, he stays lying on his back.
   */
  private updateKnockdown(deltaMs: number): void {
    const step = stepKnockdown(this.knockdown!, deltaMs, this.deathMs === undefined);
    this.knockdown = step.knockdown;
    if (step.slide !== 0) {
      // Away from the blast is −facing.
      this.x -= this.facingDirection * step.slide;
      this.constrainToBoard();
    } else if (step.stoodUp) {
      // The get-up ends standing behind where the fall started; move there for real.
      this.x += getFallPose('getUp', 1).hip.x * this.facingDirection * this.scale.x;
      this.constrainToBoard();
      this.animationIdleBlend = 1;
      this.animationRunningBlend = 0;
    }
    this.redraw();
  }

  private redraw(): void {
    const body = this.bodySprite;
    body.scale.x = this.facingDirection;
    const fall = this.currentFallPose();
    if (fall) {
      drawBowmanFall(body, this.look, this.armorColors, fall, BODY_ORIGIN_Y, this.lookTimeMs);
      this.turnAloft();
      return;
    }
    // Leaning into the walk, more when sprinting (as drawStickman leans the sprite).
    body.rotation = (0.06 + 0.04 * this.animationRunningBlend) * (1 - this.animationIdleBlend) * this.leanDirection;
    drawBowmanBody(body, this.look, this.armorColors, {
      phase: this.animationTime,
      idleBlend: this.animationIdleBlend,
      runningBlend: this.animationRunningBlend,
      localAngle: toArcherLocalAngle(this.aimAngle, body.rotation, this.facingDirection),
      tension: this.aim.power,
      ready: this.bowReady,
    }, BODY_ORIGIN_Y, this.lookTimeMs);
    this.turnAloft();
  }

  /** Thrown, he tumbles; in a vortex he leans into the pull (and rocks round the funnel), flailing a little. */
  private turnAloft(): void {
    const body = this.bodySprite;
    const { flight } = this.motion;
    if (flight) {
      body.rotation = flight.rotation;
    } else if (this.afflictions.inVortex && !this.knockdown && !this.deathFall) {
      body.rotation += this.afflictions.lean + (this.isFlailing ? 0 : Math.sin(this.lookTimeMs / 90) * 0.06);
    }
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
