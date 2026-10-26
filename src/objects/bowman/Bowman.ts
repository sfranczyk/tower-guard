import { Container } from 'pixi.js';
import { BOWMAN_WALK_SPEED } from '../../config';
import type { Rect, Vec2 } from '../../types';
import { AfflictionLayer } from '../AfflictionLayer';
import { BodyMotion } from '../../systems/bodyMotion';
import { bodyBounds, headBounds, type BodyShape } from '../../systems/bodyHitShape';
import type { HitBox } from '../enemy/enemyTypes';
import type { Knockdown } from '../../systems/bowmanMotion';
import type { ArmorPalette } from '../../rendering/armor';
import { STANDING_BURN_POINTS } from '../../rendering/burning';
import { relight } from '../../systems/burning';
import type { BowmanLook } from '../../rendering/bowmanBody';
import type { FallKind } from '../../rendering/stickmanFall';
import type { BowmanHit } from '../../systems/bowmanDeath';
import { BowAim, type BowmanAim } from './bowAim';
import { BowmanFigure } from './BowmanFigure';
import { BowmanFooting } from './bowmanFooting';
import { BowmanTags } from './BowmanTags';
import { die, knockBack, revive, updateKnockdown } from './bowmanDown';
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
  /** The health bar under his feet (off in the menu). */
  showHealth?: boolean;
  width?: number;
  height?: number;
  movementSpeed?: number;
  maxHealth?: number;
  /** Armor colours (the battleground's `player` palette). */
  armorColors?: ArmorPalette;
  /** Ranger (default, player 1) or keep warden (the co-op second player). */
  look?: BowmanLook;
  /** How long he burns after the fire last touched him (the battle's difficulty: `relight`); easy by default. */
  burnMs?: number;
}

/**
 * A player's bowman: what the rest of the game calls (controls, combat, co-op). Its parts, in this folder: `figure`
 * (the drawn body), `aim` (the draw and the bow), `footing` (walking, jumping, the board's edges), bowmanAloft
 * (vortex, throws, landing, pins) and bowmanNet (co-op state).
 */
export class Bowman extends Container {
  public readonly maxHealth: number;
  public health: number;
  /** Time since death; undefined while alive (bowmanDown). */
  public deathMs?: number;
  /** The fall he dies in (as the enemies': stickmanFall), unless a knockdown was already throwing him down. */
  public deathFall?: { kind: FallKind; timeMs: number };
  /** What hurt him last (picks how he falls if it kills him). */
  public lastHit?: BowmanHit;
  /** Walking speed (px/s); MOBA's speed skill raises it. */
  public movementSpeed: number;
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
   * His fire (the fire dragon's flames, and with friendly fire the fire arrows: BURN_DURATION_MS by difficulty, his own flame
   * size), frost and vortex state, drawn over him.
   */
  public readonly afflictions: AfflictionLayer;
  /**
   * Thrown through the air by a vortex, flailing until he lands (then `onLanded`: the host deals the fall); pinned by
   * the foot to the ground by a pinning arrow (can't walk, jump or hide, still shoots).
   */
  public readonly motion = new BodyMotion();
  /** His health bar (players' health lives in the battle's Player), name and the regeneration plus (BowmanTags). */
  public readonly tags: BowmanTags;
  /** Co-op host: told when he's knocked down or catches fire, to replay it on the guest's screen. */
  public netHooks?: { knockedBack(fromX: number, strength: number): void; ignited(gen: number): void };

  public constructor(
    x: number,
    y: number,
    boardBounds: Rect,
    config: BowmanConfig = {},
  ) {
    super();

    this.footing = new BowmanFooting(boardBounds, config.width ?? 32);
    this.movementSpeed = config.movementSpeed ?? BOWMAN_WALK_SPEED;
    this.maxHealth = config.maxHealth ?? 100;
    this.health = this.maxHealth;
    this.figure = new BowmanFigure(this, config.look ?? 'ranger', config.armorColors);
    this.afflictions = new AfflictionLayer('raider', { burnMs: config.burnMs ?? relight(), flameSize: BURN_FLAME_SIZE, burnFadeMs: BURN_FADE_MS });

    this.addChild(this.figure.body, this.afflictions.art);
    this.tags = new BowmanTags(this, config.showHealth ?? true);

    this.scale.set(1 / 3);
    this.zIndex = 2;
    this.position.set(x, y);
    this.footing.constrain(this);
    this.figure.redraw();
  }

  public get isInTower(): boolean {
    return this.inTower;
  }

  /** Where arrows hit him (world space): his head (a headshot) and body, as he is drawn now. */
  public getHitBoxes(): HitBox[] {
    const { drawn } = this.figure;
    const shape: BodyShape = { transform: this.figure.transform(), size: 1, pose: drawn?.pose, head: drawn?.head };
    return [{ bounds: headBounds(shape), headshot: true }, { bounds: bodyBounds(shape), headshot: false }];
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
   * Touched by fire: catches (or keeps) burning for the full `burnMs` (BURN_DURATION_MS by difficulty); it thaws the ice and drives the chill
   * out (`gen` > 0: caught from another fire, shorter, see systems/afflictions.ts). Returns true if he just caught fire.
   */
  public ignite(gen = 0): boolean {
    this.netHooks?.ignited(gen);
    return this.afflictions.ignite(gen);
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

  /** The arrow is away: the string springs back; `holdBow` keeps the bow up meanwhile. */
  public loose(): void {
    this.aim.loose();
  }

  /** Keeps the bow raised without a draw (the menu's archer between shots). */
  public holdBow(held: boolean): void {
    this.aim.held = held;
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

  /** Thrown onto his back away from a blast at `fromX`, slides, lies a moment and gets up (bowmanDown). */
  public knockBack(fromX: number, strength: number): void {
    knockBack(this, fromX, strength);
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

  /** Killed: falls to what hit him last, or as `death` says (bowmanDown); returns the fall. */
  public die(death: { kind?: FallKind; fromX?: number } = {}, alreadyFallen = false): FallKind {
    return die(this, death, alreadyFallen);
  }

  public get isDead(): boolean {
    return this.deathMs !== undefined;
  }

  /** MOBA: back on his feet at `x` (his keep) after the respawn wait (bowmanDown). */
  public revive(x: number): void {
    revive(this, x);
  }

  /**
   * Counts his afflictions and pin down (real time), plays the body at the frost's pace (held while frozen), flies
   * him when thrown, and draws the burn, frost and vortex glow over him.
   */
  public updateAnimation(deltaMs: number, moving: boolean, sprinting = false): void {
    // Dead, his look holds still (no cape waving on the body).
    if (this.deathMs === undefined) {
      this.figure.lookTimeMs += deltaMs;
    }
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
    this.tags.place(this.figure.burnPoints(), !this.isDead);
  }

  private updateBody(deltaMs: number, moving: boolean, sprinting: boolean): void {
    if (this.knockdown) {
      updateKnockdown(this, deltaMs);
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

  /** At the edge of the board with `direction` pointing out of it (he can't walk that way, and doesn't try). */
  public isAgainstEdge(direction: number): boolean {
    return this.footing.isAgainstEdge(this.x, direction);
  }
}

export default Bowman;
