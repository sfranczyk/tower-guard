import { Container } from 'pixi.js';
import type { Rect, Vec2 } from '../../types';
import { AfflictionLayer } from '../AfflictionLayer';
import { BodyMotion } from '../../systems/bodyMotion';
import { startKnockdown, stepKnockdown, type Knockdown } from '../../systems/bowmanMotion';
import type { ArmorPalette } from '../../rendering/armor';
import { STANDING_BURN_POINTS } from '../../rendering/burning';
import { relight } from '../../systems/burning';
import type { BowmanLook } from '../../rendering/bowmanBody';
import { FALL_DURATION_MS, getFallPose, type FallKind } from '../../rendering/stickmanFall';
import { deathFallFor, type BowmanHit } from '../../systems/bowmanDeath';
import { BowAim, type BowmanAim } from './bowAim';
import { BowmanFigure } from './BowmanFigure';
import { BowmanFooting } from './bowmanFooting';
import { holdInVortex, pin, pinnedFootPoint, throwInAir, updateFlight } from './bowmanAloft';
import { applyBowmanNet, applyRemote, bowmanNetState, type BowmanNet, type BowmanRemote } from './bowmanNet';

export type { BowmanAim } from './bowAim';
export type { BowmanNet } from './bowmanNet';

/** A burn fades out over its last this many ms; flames are drawn this much bigger than in the lab, to read at game size. */
const BURN_FADE_MS = 700;
const BURN_FLAME_SIZE = 1.6;
/** Frost glints, the ice block and the vortex glow are drawn this big (container space). */
const AFFLICTION_SIZE = 1;
/** Levitating, he's drawn in front of the funnel. */
const LEVITATE_Z = 4;

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

/**
 * A player's bowman: what the rest of the game calls (controls, combat, co-op). Its parts, in this folder: `figure`
 * (the drawn body), `aim` (the draw and the bow), `footing` (walking, jumping, the board's edges), bowmanAloft
 * (vortex, throws, landing, pins) and bowmanNet (co-op state).
 */
export class Bowman extends Container {
  public readonly maxHealth: number;
  public health: number;
  /** Time since death; undefined while alive. */
  private deathMs?: number;
  /** The fall he dies in (as the enemies': stickmanFall), unless a knockdown was already throwing him down. */
  public deathFall?: { kind: FallKind; timeMs: number };
  /** What hurt him last (picks how he falls if it kills him). */
  private lastHit?: BowmanHit;
  public readonly movementSpeed: number;
  private inTower = false;
  /** Knocked down (falling, lying, getting up). */
  public knockdown?: Knockdown;
  /** The drawn body. */
  public readonly figure: BowmanFigure;
  /** The draw and the bow. */
  public readonly aim = new BowAim();
  /** Walking, jumping, the board's edges. */
  public readonly footing: BowmanFooting;
  /**
   * His fire (the fire dragon's flames, and with friendly fire the fire arrows: BURN_DURATION_MS, his own flame
   * size), frost and vortex state, drawn over him.
   */
  public readonly afflictions = new AfflictionLayer('basic', { burnMs: relight(), flameSize: BURN_FLAME_SIZE, burnFadeMs: BURN_FADE_MS });
  /**
   * Thrown through the air by a vortex, flailing until he lands (then `onLanded`: the host deals the fall); pinned by
   * the foot to the ground by a pinning arrow (can't walk, jump or hide, still shoots).
   */
  public readonly motion = new BodyMotion();
  /** Co-op host: told when he's knocked down or catches fire, to replay it on the guest's screen. */
  public netHooks?: { knockedBack(fromX: number, strength: number): void; ignited(): void };

  public constructor(
    x: number,
    y: number,
    boardBounds: Rect,
    config: BowmanConfig = {},
  ) {
    super();

    this.footing = new BowmanFooting(boardBounds, config.width ?? 32);
    this.movementSpeed = config.movementSpeed ?? 120;
    this.maxHealth = config.maxHealth ?? 100;
    this.health = this.maxHealth;
    this.figure = new BowmanFigure(this, config.look ?? 'ranger', config.armorColors);

    this.addChild(this.figure.body, this.afflictions.art);

    this.scale.set(1 / 3);
    this.zIndex = 2;
    this.position.set(x, y);
    this.footing.constrain(this);
    this.figure.redraw();
  }

  public get isInTower(): boolean {
    return this.inTower;
  }

  public get currentSpeed(): number {
    return Math.abs(this.footing.horizontalSpeed);
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

  /** Pinned by the foot for `durationMs` (bowmanAloft). */
  public pin(durationMs: number): void {
    pin(this, durationMs);
  }

  /** Where his pinned foot is (bowmanAloft). */
  public pinnedFootPoint(): Vec2 {
    return pinnedFootPoint(this);
  }

  /** Held by a vortex this frame at `x`, lifted `lift` px and turned `lean` (bowmanAloft). */
  public holdInVortex(x: number, lift: number, lean: number, levitating = false): void {
    holdInVortex(this, x, lift, lean, levitating);
  }

  /** Thrown through the air at (`vx`, `vy`) px/s, tumbling at `spin` radians/s (bowmanAloft). */
  public throwInAir(vx: number, vy: number, spin: number): void {
    throwInAir(this, vx, vy, spin);
  }

  /** The draw is lost (frozen, caught, thrown). */
  public dropDraw(): void {
    this.aim.drop();
    this.footing.jumpBuffer = 0;
  }

  /** Co-op host: his frost, vortex, throw and pin for the guest (bowmanNet). */
  public getNetState(): BowmanNet {
    return bowmanNetState(this);
  }

  /** Co-op guest: the host's frost, vortex, throw and pin (bowmanNet). */
  public applyNetState(net: BowmanNet): void {
    applyBowmanNet(this, net);
  }

  /** Horizontal speed (px/s, signed), for co-op snapshots. */
  public get velocityX(): number {
    return this.footing.horizontalSpeed;
  }

  /** Co-op guest: the other player's bowman, placed as the host has him (bowmanNet). */
  public applyRemote(state: BowmanRemote): void {
    applyRemote(this, state);
  }

  /** Co-op guest: the host has this player somewhere else; put him there (prediction went wrong). */
  public correctTo(x: number, y: number): void {
    this.position.set(x, y);
    this.motion.placeFlight(x, y);
    this.footing.verticalVelocity = 0;
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
    this.figure.facing = fromX >= this.x ? 1 : -1;
    this.aim.carry(this.figure.facing);
    this.dropDraw();
    this.footing.horizontalSpeed = 0;
    this.knockdown = startKnockdown(strength);
    this.figure.redraw();
  }

  public moveHorizontal(direction: number, deltaSeconds = 0, sprinting = false): void {
    if (this.isStunned || this.isPinned) {
      // Knocked down, frozen, caught or pinned: no control (a knockdown's slide is applied in updateKnockdown).
      this.footing.horizontalSpeed = 0;
      return;
    }
    // In the keep, or at the edge of the battlefield walking further into it: he just stands. Chilled, he walks at
    // the frost's pace.
    this.footing.move(this, direction, deltaSeconds, sprinting, this.movementSpeed, this.afflictions.timeScale, this.inTower);
  }

  public jump(): void {
    if (this.inTower || this.isStunned || this.isPinned) {
      return;
    }
    this.footing.jump(this);
  }

  public updateVertical(deltaSeconds: number): void {
    // A vortex (or its throw) moves him.
    this.footing.updateVertical(this, deltaSeconds, this.inTower || this.isAloft);
  }

  public setHorizontalPosition(x: number): void {
    this.x = x;
    this.footing.constrain(this);
  }

  public setTowerPosition(x: number, y: number): void {
    this.footing.verticalVelocity = 0;
    this.position.set(x, y);
  }

  public setAim(direction: Vec2, power: number): void {
    if (this.isStunned) {
      return;
    }
    this.aim.set(direction, power);
    if (Math.abs(this.aim.direction.x) > Number.EPSILON) {
      this.figure.facing = this.aim.direction.x < 0 ? -1 : 1;
    }
    this.figure.redraw();
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
   * just stays down. `alreadyFallen` (fell in an earlier level) starts him lying on his back. Returns the fall.
   */
  public die(death: { kind?: FallKind; fromX?: number } = {}, alreadyFallen = false): FallKind {
    if (this.deathMs !== undefined) {
      return this.deathFall?.kind ?? 'knockback';
    }
    this.deathMs = 0;
    this.aim.drop();
    this.footing.horizontalSpeed = 0;
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
        this.figure.facing = fromX > this.x ? 1 : -1;
      }
      this.deathFall = { kind: death.kind ?? (frozen ? 'deathStiff' : deathFallFor(this.lastHit?.cause)), timeMs: 0 };
    }
    this.figure.redraw();
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
    this.figure.lookTimeMs += deltaMs;
    this.afflictions.tick(deltaMs);
    this.motion.tickPin(deltaMs);
    this.zIndex = this.afflictions.levitating ? LEVITATE_Z : this.inTower ? 0 : 2;
    if (this.motion.isThrown) {
      updateFlight(this, deltaMs);
    } else {
      this.updateBody(deltaMs * this.afflictions.timeScale, moving && !this.isPinned, sprinting);
    }
    this.figure.body.tint = this.afflictions.tint;
    // On the body as it is now (standing, falling, lying or flailing); the ice block round the standing figure.
    this.afflictions.draw(this.figure.burnPoints(), AFFLICTION_SIZE, this.figure.toContainer(STANDING_BURN_POINTS));
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
      this.figure.redraw();
      return;
    }
    this.figure.animate(deltaMs, moving, sprinting);
  }

  public getAim(): BowmanAim {
    return this.aim.snapshot();
  }

  /** Where the arrow is nocked: the string hand, in world space. */
  public getBowReleasePoint(): Vec2 {
    return this.figure.getBowReleasePoint();
  }

  /**
   * Plays the fall, slides away from the blast meanwhile, lies BOWMAN_KNOCKBACK.lieMs and gets up; then moves
   * to where the get-up pose ends. Killed meanwhile, he stays lying on his back.
   */
  private updateKnockdown(deltaMs: number): void {
    const step = stepKnockdown(this.knockdown!, deltaMs, this.deathMs === undefined);
    this.knockdown = step.knockdown;
    const { facing } = this.figure;
    if (step.slide !== 0) {
      // Away from the blast is −facing.
      this.x -= facing * step.slide;
      this.footing.constrain(this);
    } else if (step.stoodUp) {
      // The get-up ends standing behind where the fall started; move there for real.
      this.x += getFallPose('getUp', 1).hip.x * facing * this.scale.x;
      this.footing.constrain(this);
      this.figure.stand();
    }
    this.figure.redraw();
  }

  /** At the edge of the board with `direction` pointing out of it (he can't walk that way, and doesn't try). */
  public isAgainstEdge(direction: number): boolean {
    return this.footing.isAgainstEdge(this.x, direction);
  }
}

export default Bowman;
