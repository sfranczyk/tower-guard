import { Container, Graphics } from 'pixi.js';
import { DRAGON_SCALE, DRAGON_TURN_MS } from '../../config';
import { dragonHitZones, type DragonHitZone, type DragonPose } from '../../rendering/dragon';
import { dragonKnightLook, drawDragonWithRider } from '../../rendering/designs/heavySkins';
import { HUMAN_BODY } from '../../rendering/bodyColors';
import { IGNITE_HEAT, breathControl, drawFireStream, firePuffs, puffPosition } from '../../rendering/dragonFire';
import { GIB_GROUND_Y } from '../../rendering/stickmanGibs';
import type { BodyAnchor } from '../../systems/bodyAnchor';
import { cruiseAltitude, facingScale, flyTowards, hoverX, nextHoverSide, stepFacing, type HoverSide } from '../../systems/dragonFlight';
import { buffetOffset } from '../../systems/vortex';
import { groundAt } from '../../systems/terrain';
import { enemyArchetype } from '../../data/enemyKinds';
import type { Bounds, Vec2 } from '../../types';
import { drawHealthBar } from '../../rendering/healthBar';
import { boundsAround } from '../../utils/math';
import type { HitBox, HitInfo } from '../enemy/enemyTypes';
import { AfflictionLayer, type AfflictionNet } from '../AfflictionLayer';
import { DragonBow } from './DragonBow';
import { DragonBreath } from './DragonBreath';
import { DragonCorpse } from './DragonCorpse';
import { frameLocalAngle, frameToLocal, frameToWorld, frameWorldAngle, type DragonFrame } from './dragonFrame';
import { DRAGON_ARCHER_LOOK, DRAGON_KINDS, type DragonKind, type DragonLook } from './dragonKinds';

export type { DragonKind } from './dragonKinds';

/** Flames on a burning dragon, in its (scaled-down) art units. */
const AFFLICTION_SIZE = 1.5;
/** Local aim limits for the rider (radians, + = down): no shooting backwards or straight up. */
const AIM_MIN = -0.25;
const AIM_MAX = 1.35;
const HIT_FLASH_MS = 120;
/** Health bar above the dragon, in local (unscaled) units. */
const HEALTH_BAR = { width: 70, height: 8, y: -112 };

/**
 * Flying dragon. The dark dragon archer flies in high, hovers in front of the bowman (systems/dragonFlight),
 * and its rider draws and shoots hostile arrows like an enemy archer (CombatSystem aims for it; DragonBow). The red fire
 * dragon (unarmed rider) flies lower and closer and breathes long streams of fire (DragonBreath, rendering/dragonFire.ts)
 * when the bowman is in reach (CombatSystem calls breathe). Arrows hit the dragon's body or, for a headshot, the rider's
 * head, and stick into it. A killed dragon falls out of the sky (DragonCorpse). Offers the same interface as Enemy where
 * the combat code shares it.
 */
export default class DragonEnemy extends Container {
  public readonly kind: DragonKind;
  /** Co-op host: hears about every hit, to replay it on the guest's screen. */
  public netHooks?: { damaged(amount: number, hit?: HitInfo): void };
  public readonly isArcher = false;
  public readonly isFlying = true;
  public readonly isDown = false;
  public readonly size = 1;
  public readonly strikeReach = 0;
  /** Arrows draw red blood from the dragon and its rider. */
  public readonly bodyColors = HUMAN_BODY;
  private readonly art = new Graphics();
  /** The rider once he's off the dragon (thrown or blown apart), in death space. */
  private readonly riderArt = new Graphics();
  /** The fire stream, in front of the dragon and untinted by hits. */
  private readonly fireArt = new Graphics();
  private readonly healthBar = new Graphics();
  /** Fire and frost (the dragon archer burns; neither dragon can be frozen, only chilled). */
  public readonly afflictions: AfflictionLayer;
  private readonly look: DragonLook;
  private readonly breath = new DragonBreath();
  private readonly bow = new DragonBow();
  private readonly maxHealth: number;
  private health: number;
  private readonly speed: number;
  private timeMs = Math.random() * 1000;
  private pose: DragonPose;
  private flashMs = 0;
  private corpse?: DragonCorpse;
  private cheering = false;
  private paused = false;
  /** Thrown about by turbulence (a vortex arrow): the offset added to where it flies (px). */
  private buffet = { x: 0, y: 0 };
  /** The side of its target it hovers on (1: to the right, facing left), and its facing mid-turn (−1 left … 1 right). */
  private side: HoverSide = 1;
  private facing = -1;

  public constructor(x: number, health: number, speed: number, kind: DragonKind = 'dragon') {
    super();
    this.kind = kind;
    this.look = DRAGON_KINDS[kind];
    this.maxHealth = Math.max(1, health);
    this.health = this.maxHealth;
    this.speed = speed;
    // Faces left, towards the player's keep (it turns round when its target gets behind it).
    this.applyFacing();
    this.position.set(x, cruiseAltitude(this.timeMs, this.look.altitude));
    this.zIndex = 1;
    this.afflictions = new AfflictionLayer(kind);
    this.addChild(this.art, this.riderArt, this.afflictions.art, this.fireArt, this.healthBar);
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
      this.bow.tension = 0;
    }
  }

  public isMoving(): boolean {
    return this.isAlive();
  }

  public takeDamage(amount: number, hit?: HitInfo): number {
    if (!this.isAlive()) {
      return this.health;
    }
    this.netHooks?.damaged(amount, hit);
    this.health = Math.max(0, this.health - Math.max(0, amount));
    this.drawHealthBar();
    if (this.health === 0) {
      const startY = GIB_GROUND_Y - (groundAt(this.x) - this.y) / DRAGON_SCALE;
      // The fire dragon's burning gut goes up with it (CombatSystem doubles the blast): it bursts into chunks.
      const blast = hit?.cause === 'blast' ? { breathesFire: enemyArchetype(this.kind).breathesFire === true } : undefined;
      this.corpse = new DragonCorpse(this.pose, startY, this.look, blast);
      this.healthBar.visible = false;
      this.bow.tension = 0;
      this.afflictions.extinguish();
      this.afflictions.thaw();
      // It falls level, not tilted by the gusts any more.
      this.rotation = 0;
      // Killed mid-breath: the fire goes out.
      this.breath.stop();
      this.fireArt.clear();
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
  public update(realDeltaMs: number, targetX: number): void {
    if (!this.isAlive()) {
      return;
    }
    // Chilled: it flies slower.
    const deltaMs = realDeltaMs * this.afflictions.timeScale;
    // Flies where it means to, then the turbulence throws it about on top of that.
    this.x -= this.buffet.x;
    this.y -= this.buffet.y;
    if (!this.cheering) {
      this.side = nextHoverSide(this.x, targetX, this.side, this.look.hoverOffset);
      this.x = flyTowards(this.x, hoverX(targetX, this.look.hoverOffset, this.side), this.speed, deltaMs);
    }
    this.y = flyTowards(this.y, cruiseAltitude(this.timeMs, this.look.altitude), 40, deltaMs);
    const { x, y } = buffetOffset(this.timeMs, this.afflictions.turbulence);
    this.buffet = { x, y };
    this.x += x;
    this.y += y;
  }

  /** Co-op: the rider's bow and the fire dragon's breath, for the guest. */
  public getNetState(): { aim: number; tension: number; breathMs?: number; fireAim: number; side: HoverSide; af?: AfflictionNet } {
    return {
      aim: this.bow.aimAngle, tension: this.bow.tension, breathMs: this.breath.timeMs, fireAim: this.breath.aim, side: this.side,
      af: this.afflictions.getNetState(),
    };
  }

  /** Co-op guest: flies where the host has it, with the host's bow and breath (no AI runs on the guest). */
  public applyNetState(state: { x: number; y: number; aim: number; tension: number; breathMs?: number; fireAim: number; side?: HoverSide; af?: AfflictionNet }): void {
    if (!this.isAlive()) {
      return;
    }
    this.afflictions.applyNetState(state.af);
    this.position.set(state.x, state.y);
    this.bow.aimAngle = state.aim;
    this.bow.tension = state.tension;
    this.breath.apply(state.breathMs, state.fireAim);
    // It turns round on the guest's screen too (the turn itself plays here).
    this.side = state.side ?? this.side;
  }

  /** Which way it faces (−1 left, 1 right; mid-turn, the way it's turning to). */
  public get facingX(): HoverSide {
    return -this.side as HoverSide;
  }

  /** Swinging round to face the other way (it doesn't shoot or breathe fire meanwhile). */
  public get isTurning(): boolean {
    return this.facing !== this.facingX;
  }

  /** Fire dragon: whether it is pouring out fire right now (for damage once burning is added). */
  public get isBreathingFire(): boolean {
    return this.breath.isPouring;
  }

  /**
   * Fire dragon: the burning part of its stream in world space (centre and radius of every puff still hot
   * enough to set things alight), empty between breaths.
   */
  public getFlames(): Array<{ center: Vec2; radius: number }> {
    const breathMs = this.breath.timeMs;
    if (breathMs === undefined || !this.isAlive()) {
      return [];
    }
    const { point, angle } = this.pose.mouth;
    return firePuffs(breathMs)
      .filter((puff) => puff.heat >= IGNITE_HEAT)
      .map((puff) => ({ center: this.toWorld(puffPosition(point, angle, puff)), radius: puff.radius * DRAGON_SCALE }));
  }

  /** Fire dragon: where the fire leaves the mouth, in world space. */
  public getMouthPoint(): Vec2 {
    return this.toWorld(this.pose.mouth.point);
  }

  /**
   * Fire dragon with its target in reach: turns the head towards `worldAngle` and, unless it's already
   * breathing or still catching its breath, starts a breath (rear back, then a long stream of fire).
   */
  public breathe(worldAngle: number): void {
    if (!this.isAlive() || this.cheering || !enemyArchetype(this.kind).breathesFire || this.afflictions.isTurbulent || this.isTurning) {
      return;
    }
    this.breath.breathe(frameLocalAngle(this.frame, worldAngle));
  }

  /**
   * Turns the bow towards `worldAngle` and draws; returns true on the frame the arrow is loosed (then waits
   * DRAGON_SHOT_INTERVAL_MS, drawing over the last DRAGON_DRAW_MS of it).
   */
  public aim(worldAngle: number, realDeltaMs: number): boolean {
    if (!this.isAlive() || this.cheering) {
      return false;
    }
    if (this.isTurning) {
      this.relax(realDeltaMs);
      return false;
    }
    return this.bow.draw(worldAngle, realDeltaMs * this.afflictions.timeScale);
  }

  /** Out of range: ease the string back. */
  public relax(deltaMs: number): void {
    this.bow.relax(deltaMs);
  }

  /** Where the rider's arrow leaves the string, in world space. */
  public getBowReleasePoint(): Vec2 {
    const nock = this.pose.bow?.rig.stringNock ?? this.pose.rider.shoulder;
    return this.toWorld(nock);
  }

  public updateAnimation(realDeltaMs: number): void {
    this.flashMs = Math.max(0, this.flashMs - realDeltaMs);
    this.afflictions.tick(realDeltaMs);
    // Chilled: slower wing beats and breath.
    const deltaMs = realDeltaMs * this.afflictions.timeScale;
    if (this.corpse) {
      // At rest on the ground it stays as it was last drawn.
      if (!this.corpse.settled) {
        this.corpse.draw(this.art, this.riderArt, realDeltaMs);
        this.afflictions.art.clear();
      }
    } else {
      if (!this.paused) {
        this.timeMs += deltaMs;
        this.breath.step(deltaMs);
        if (this.isTurning) {
          this.facing = stepFacing(this.facing, this.facingX, deltaMs, DRAGON_TURN_MS);
          this.applyFacing();
        }
      }
      // Buffeted, it tilts with the gusts, and the fire chokes off.
      this.rotation = buffetOffset(this.timeMs, this.afflictions.turbulence).tilt;
      if (this.afflictions.isTurbulent) {
        this.breath.stop();
      }
      this.pose = this.redraw();
      // Flames (or frost) along the body, neck, tail and the rider.
      const points = dragonHitZones(this.pose).map(({ points: zone }) => ({
        x: zone.reduce((sum, point) => sum + point.x, 0) / zone.length,
        y: zone.reduce((sum, point) => sum + point.y, 0) / zone.length,
      }));
      this.afflictions.draw(points, AFFLICTION_SIZE);
    }
    const tint = this.flashMs > 0 ? 0xffb0a8 : this.afflictions.tint;
    this.art.tint = tint;
    this.riderArt.tint = tint;
  }

  /** The dead dragon and its rider have come to rest (not redrawn any more). */
  public get deathSettled(): boolean {
    return this.corpse?.settled ?? false;
  }

  /** The dragon's body (used for splash distance and the like; arrows test every zone). */
  public getPhysicsBounds(): Bounds {
    return this.zoneBounds('body');
  }

  /** The rider (head and shoulders above the dragon's back). */
  public getHeadBounds(): Bounds {
    return this.zoneBounds('rider');
  }

  private zoneBounds(part: DragonHitZone['part']): Bounds {
    const zone = dragonHitZones(this.pose).find((candidate) => candidate.part === part)!;
    return boundsAround(zone.points.map((point) => this.toWorld(point)), zone.padding * DRAGON_SCALE);
  }

  /** Every hit zone in world space (see dragonHitZones): rider and dragon head are headshots. */
  public getHitBoxes(): HitBox[] {
    return dragonHitZones(this.pose).map(({ points, padding, headshot }) => ({
      bounds: boundsAround(points.map((point) => this.toWorld(point)), padding * DRAGON_SCALE),
      headshot,
    }));
  }

  /** Arrows stick at a local point (stored in BodyAnchor's along/side) and follow the dragon. */
  public toBodyAnchor(point: Vec2, angle: number): BodyAnchor {
    const local = frameToLocal(this.frame, point);
    return { along: local.x, side: local.y, angle: frameLocalAngle(this.frame, angle) };
  }

  public resolveBodyAnchor(anchor: BodyAnchor): { position: Vec2; rotation: number } {
    return { position: this.toWorld({ x: anchor.along, y: anchor.side }), rotation: frameWorldAngle(this.frame, anchor.angle) };
  }

  /** Its transforms now (dragonFrame.ts): the sprite's and the art's (moved while the corpse falls). */
  private get frame(): DragonFrame {
    const { art } = this;
    return {
      x: this.x, y: this.y, rotation: this.rotation, scaleX: this.scale.x, scaleY: this.scale.y,
      art: { x: art.x, y: art.y, rotation: art.rotation },
    };
  }

  private toWorld(local: Vec2): Vec2 {
    return frameToWorld(this.frame, local);
  }

  /** Draws it facing `facing` (mirrored to face left; squeezed mid-turn); the health bar keeps its size. */
  private applyFacing(): void {
    this.scale.set(facingScale(this.facing) * DRAGON_SCALE, DRAGON_SCALE);
    this.healthBar.scale.set(1 / this.scale.x, 1 / this.scale.y);
  }

  private redraw(): DragonPose {
    const { palette, rider } = this.look;
    // Once killed the clock stops, so the wings freeze mid-beat while it falls.
    if (rider === 'unarmed') {
      const breathMs = this.breath.timeMs;
      const breath = breathMs === undefined ? undefined : breathControl(breathMs, this.breath.aim);
      const pose = drawDragonWithRider(this.art, this.timeMs, 'unarmed', dragonKnightLook(this.timeMs), palette, undefined, breath);
      this.fireArt.clear();
      if (breathMs !== undefined) {
        drawFireStream(this.fireArt, pose.mouth.point, pose.mouth.angle, breathMs);
      }
      return pose;
    }
    // The sprite faces either way (mirrored to face left) and tilts: turn the world aim into the rider's local aim.
    const local = frameLocalAngle(this.frame, this.bow.aimAngle);
    const aim = Math.min(AIM_MAX, Math.max(AIM_MIN, local));
    return drawDragonWithRider(this.art, this.timeMs, 'archer', DRAGON_ARCHER_LOOK, palette, { aim, tension: this.bow.tension });
  }

  private drawHealthBar(): void {
    const { width, height, y } = HEALTH_BAR;
    this.healthBar.position.set(0, y);
    drawHealthBar(this.healthBar, this.health / this.maxHealth, width, height);
  }
}
