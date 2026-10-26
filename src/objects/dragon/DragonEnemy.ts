import { Container, Graphics } from 'pixi.js';
import { DRAGON_SCALE, FIRE_DRAGON_STRAFE } from '../../config';
import { dragonHitZones, type DragonHitZone, type DragonPose } from '../../rendering/dragon';
import { dragonKnightLook, drawDragonWithRider } from '../../rendering/designs/heavySkins';
import { HUMAN_BODY } from '../../rendering/bodyColors';
import { FIRE_BREATH, IGNITE_HEAT, breathControl, drawFireStream, firePuffs, puffPosition } from '../../rendering/dragonFire';
import { GIB_GROUND_Y } from '../../rendering/stickmanGibs';
import type { BodyAnchor } from '../../systems/bodyAnchor';
import { cruiseAltitude, type HoverSide } from '../../systems/dragonFlight';
import { groundReach, strafeAltitude, streamLength } from '../../systems/dragonStrafe';
import { groundAt } from '../../systems/terrain';
import { enemyArchetype } from '../../data/enemyKinds';
import type { Bounds, Vec2 } from '../../types';
import { drawHealthBar, drawLevelStars } from '../../rendering/healthBar';
import { boundsAround } from '../../utils/math';
import { killerOf, type HitBox, type HitInfo } from '../enemy/enemyTypes';
import { AfflictionLayer, type AfflictionNet } from '../AfflictionLayer';
import { DragonBow } from './DragonBow';
import { DragonBreath } from './DragonBreath';
import { DragonCorpse } from './DragonCorpse';
import { DragonMotion, type FlightNet } from './DragonMotion';
import { frameLocalAngle, frameToLocal, frameToWorld, frameWorldAngle, type DragonFrame } from './dragonFrame';
import { DRAGON_ARCHER_LOOK, DRAGON_KINDS, type DragonKind, type DragonLook } from './dragonKinds';
import { worldWidth } from '../../systems/battlefield';
import { isShownX } from '../../core/viewport';

export type { DragonKind } from './dragonKinds';

/** Flames on a burning dragon, in its (scaled-down) art units. */
const AFFLICTION_SIZE = 1.5;
/** Local aim limits for the rider (radians, + = down): no shooting backwards or straight up. */
const AIM_MIN = -0.25;
const AIM_MAX = 1.35;
const HIT_FLASH_MS = 120;
/** The fire dragon breathes only hovering, not flying faster than this share of its transit speed. */
const BREATHE_MAX_FLIGHT = 0.25;
/** Health bar under the dragon, in local (unscaled) units. */
const HEALTH_BAR = { width: 70, height: 8, y: 62 };

/**
 * Flying dragon. The dark dragon archer flies in high, hovers in front of the bowman (systems/dragonFlight),
 * and its rider draws and shoots hostile arrows like an enemy archer (CombatSystem aims for it; DragonBow). The red fire
 * dragon (unarmed rider) flies lower and closer and breathes long streams of fire (DragonBreath, rendering/dragonFire.ts)
 * when the bowman is in reach (CombatSystem calls breathe). Arrows hit the dragon's body or, for a headshot, the rider's
 * head, and stick into it. A killed dragon falls out of the sky (DragonCorpse). Offers the same interface as Enemy where
 * the combat code shares it.
 */
/** How a fleeing dragon leaves: × its speed, climbing px/s up to world y `topY`, gone `beyond` the right edge. */
const DRAGON_FLEE = { speedFactor: 1.8, climb: 60, topY: 40, beyond: 260 };

export default class DragonEnemy extends Container {
  public readonly kind: DragonKind;
  /** Every hit taken (host and co-op guest alike): the battle shows its damage number. */
  public onDamaged?: (amount: number, hit?: HitInfo) => void;
  /** MOBA: as Enemy.onKilled. */
  public onKilled?: (by: number | undefined) => void;
  public lastHitBy?: number;
  /** MOBA: as Enemy.power. */
  public power = 1;
  /** MOBA: its team's colour for the health bar (green-to-red otherwise). */
  public barColor?: number;
  private stars = 0;
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
  private readonly starArt = new Graphics();
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
  /** Where the blast was once a fire dragon has blown up (the arrows in it break). */
  public blownApartAt?: Vec2;
  private cheering = false;
  /** Survival: the night is over, it turns and flies off right (`flee`, `flyOff`); `escaped` once out of sight. */
  public fleeing = false;
  private escaped = false;
  /** Hovers and flights between them, side and turn, gusts and jolts, wing beat (DragonMotion). */
  private readonly motion: DragonMotion;

  /** `look`: another hide for its kind (MOBA: the blue lane's dragon, BLUE_DRAGON_LOOK). */
  public constructor(x: number, health: number, speed: number, kind: DragonKind = 'dragon', look: DragonLook = DRAGON_KINDS[kind]) {
    super();
    this.kind = kind;
    this.look = look;
    this.maxHealth = Math.max(1, health);
    this.health = this.maxHealth;
    this.speed = speed;
    this.motion = new DragonMotion(this.look, this.timeMs);
    // Faces left, towards the player's keep (it turns round when its target gets behind it).
    this.applyFacing();
    this.position.set(x, cruiseAltitude(this.timeMs, this.look.altitude));
    this.zIndex = 1;
    this.afflictions = new AfflictionLayer(kind);
    this.healthBar.addChild(this.starArt);
    this.addChild(this.art, this.riderArt, this.afflictions.art, this.fireArt, this.healthBar);
    this.pose = this.redraw();
    this.drawHealthBar();
  }

  public isAlive(): boolean {
    return this.health > 0 && !this.escaped;
  }

  /** MOBA: a blue dragon comes in from the left, facing right (it turns as usual from then on). */
  public faceRight(): void {
    this.motion.side = -1;
    this.motion.facing = 1;
    this.applyFacing();
  }

  /** Survival's end: it gives up, turns round and flies off (EnemyAI calls `flyOff` each frame). */
  public flee(): void {
    if (this.isAlive()) {
      this.fleeing = true;
      this.breath.stop();
      this.bow.tension = 0;
      this.motion.side = -1;
    }
  }

  /** Flies away right and up, faster than it hunts; past the field's edge it is gone (counts as defeated). */
  public flyOff(realDeltaMs: number): void {
    const seconds = (realDeltaMs * this.afflictions.timeScale) / 1000;
    this.x += this.speed * DRAGON_FLEE.speedFactor * seconds;
    this.y = Math.max(DRAGON_FLEE.topY, this.y - DRAGON_FLEE.climb * seconds);
    if (this.x > worldWidth() + DRAGON_FLEE.beyond) {
      this.escaped = true;
    }
  }

  /** Health left (as Enemy.currentHealth). */
  public get currentHealth(): number {
    return this.health;
  }

  public get isCelebrating(): boolean {
    return this.isAlive() && this.cheering;
  }

  /** The enemies won: stop shooting and keep circling in place. */
  public celebrate(): void {
    if (this.isAlive()) {
      this.cheering = true;
      this.bow.tension = 0;
      this.motion.stay();
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
    this.onDamaged?.(amount, hit);
    this.lastHitBy = hit?.by ?? this.lastHitBy;
    this.health = Math.max(0, this.health - Math.max(0, amount));
    if (this.health === 0 && hit) {
      this.onKilled?.(killerOf(hit, this.lastHitBy));
    }
    this.drawHealthBar();
    if (this.health === 0) {
      const startY = GIB_GROUND_Y - (groundAt(this.x) - this.y) / DRAGON_SCALE;
      // The fire dragon's burning gut goes up with it (CombatSystem doubles the blast): it bursts into chunks.
      const blast = hit?.cause === 'blast' ? { breathesFire: enemyArchetype(this.kind).breathesFire === true } : undefined;
      this.corpse = new DragonCorpse(this.pose, startY, this.look, blast, this.motion.wingMs);
      if (blast?.breathesFire) {
        this.blownApartAt = hit?.point ?? { x: this.x, y: this.y };
      }
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

  /** A hit: a flash, a small jolt away from the arrow (`pushX` > 0: from the left), and the archer's draw slips. */
  public applyHitReaction(pushX: number): void {
    this.flashMs = HIT_FLASH_MS;
    if (this.isAlive()) {
      this.motion.kick(pushX > 0);
      this.bow.flinch();
    }
  }

  /** How fast it is flying, as a share of DRAGON_FLIGHT.transitSpeed (0..1): the rider aims worse and shoots less. */
  public get flightSpeed(): number {
    return this.motion.flightSpeed;
  }

  public clearHitTint(): void {}

  /**
   * Hovers in front of `targetX`, now and then flying to another height and distance (DragonMotion); `waiting`
   * (everyone hides in the keep at `targetX`), the fire dragon keeps well away from it.
   */
  public update(realDeltaMs: number, targetX: number, waiting = false): void {
    if (!this.isAlive()) {
      return;
    }
    // Chilled: it flies slower. Mid-breath the fire dragon doesn't set off.
    const deltaMs = realDeltaMs * this.afflictions.timeScale;
    const pos = { x: this.x, y: this.y };
    this.motion.fly(pos, {
      targetX, timeMs: this.timeMs, deltaMs, followSpeed: this.speed, turbulence: this.afflictions.turbulence,
      cheering: this.cheering, hold: this.breath.timeMs !== undefined, strafe: this.strafeGeometry(targetX), waiting,
    });
    this.position.set(pos.x, pos.y);
    // Everyone went into the keep before the flames came out: it doesn't waste them.
    if (waiting && this.breath.timeMs !== undefined && this.breath.timeMs < FIRE_BREATH.windUpMs) {
      this.breath.stop();
    }
    // A strafing run lights the fire at its start (choked by turbulence, it flies the pass without it).
    if (this.motion.takeStrafeIgnite() && !this.afflictions.isTurbulent) {
      this.breath.ignite(FIRE_DRAGON_STRAFE.aim);
    }
  }

  /** Fire dragon: where its fire would meet the ground on a pass at `targetX`, and how high it flies it. */
  private strafeGeometry(targetX: number): { reach: number; altitude: number } | undefined {
    if (!enemyArchetype(this.kind).breathesFire) {
      return undefined;
    }
    const mouth = { ahead: this.pose.mouth.point.x * DRAGON_SCALE, drop: this.pose.mouth.point.y * DRAGON_SCALE };
    const stream = streamLength(DRAGON_SCALE);
    return { reach: groundReach(mouth, stream), altitude: strafeAltitude(groundAt(targetX), mouth, stream) };
  }

  /** Co-op: the rider's bow and the fire dragon's breath, for the guest. */
  public getNetState(): { aim: number; tension: number; breathMs?: number; fireAim: number; side: HoverSide; af?: AfflictionNet; fl: FlightNet } {
    return {
      aim: this.bow.aimAngle, tension: this.bow.tension, breathMs: this.breath.timeMs, fireAim: this.breath.aim,
      af: this.afflictions.getNetState(), ...this.motion.getNetState(),
    };
  }

  /** Co-op guest: flies where the host has it, with the host's bow and breath (no AI runs on the guest). */
  public applyNetState(state: { x: number; y: number; aim: number; tension: number; breathMs?: number; fireAim: number; side?: HoverSide; af?: AfflictionNet; fl?: FlightNet }): void {
    if (!this.isAlive()) {
      return;
    }
    this.afflictions.applyNetState(state.af);
    this.position.set(state.x, state.y);
    this.bow.aimAngle = state.aim;
    this.bow.tension = state.tension;
    this.breath.apply(state.breathMs, state.fireAim);
    // It turns round and flies like the host's (the turn itself plays here).
    this.motion.applyNetState(state.side, state.fl);
  }

  /** Which way it faces (−1 left, 1 right; mid-turn, the way it's turning to). */
  public get facingX(): HoverSide {
    return this.motion.facingX;
  }

  /** Swinging round to face the other way (it doesn't shoot or breathe fire meanwhile). */
  public get isTurning(): boolean {
    return this.motion.isTurning;
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
    const busy = this.afflictions.isTurbulent || this.isTurning || this.motion.isStrafing || this.flightSpeed > BREATHE_MAX_FLIGHT;
    if (!this.isAlive() || this.cheering || !enemyArchetype(this.kind).breathesFire || busy) {
      return;
    }
    this.breath.breathe(frameLocalAngle(this.frame, worldAngle));
  }

  /**
   * Turns the bow towards `worldAngle` and draws; returns true on the frame the arrow is loosed (then waits
   * DRAGON_SHOT_INTERVAL_MS, drawing over the last DRAGON_DRAW_MS of it; `pace` < 1 slower, in flight).
   */
  public aim(worldAngle: number, realDeltaMs: number, pace = 1): boolean {
    if (!this.isAlive() || this.cheering) {
      return false;
    }
    if (this.isTurning) {
      this.relax(realDeltaMs);
      return false;
    }
    return this.bow.draw(worldAngle, realDeltaMs * this.afflictions.timeScale, pace);
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
    // Off screen it is still posed (its hit zones) but not rendered (isShownX).
    this.renderable = isShownX(this.x);
    // Chilled: slower wing beats and breath.
    const deltaMs = realDeltaMs * this.afflictions.timeScale;
    if (this.corpse) {
      // At rest on the ground it stays as it was last drawn.
      if (!this.corpse.settled) {
        this.corpse.draw(this.art, this.riderArt, realDeltaMs);
        this.afflictions.art.clear();
      }
    } else {
      this.timeMs += deltaMs;
      this.breath.step(deltaMs);
      const turning = this.isTurning;
      this.motion.step(deltaMs);
      if (turning) {
        this.applyFacing();
      }
      // Buffeted, it tilts with the gusts, and the fire chokes off; diving it noses down, braking up (either way it faces).
      this.rotation = this.motion.tilt(this.timeMs, this.afflictions.turbulence);
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
    this.scale.set(this.motion.scaleX * DRAGON_SCALE, DRAGON_SCALE);
    this.healthBar.scale.set(1 / this.scale.x, 1 / this.scale.y);
  }

  private redraw(): DragonPose {
    const { palette, rider } = this.look;
    // Once killed the clock stops, so the wings freeze mid-beat while it falls.
    if (rider === 'unarmed') {
      const breathMs = this.breath.timeMs;
      const breath = breathMs === undefined ? undefined : breathControl(breathMs, this.breath.aim);
      const pose = drawDragonWithRider(this.art, this.motion.wingMs, 'unarmed', dragonKnightLook(this.motion.wingMs), palette, undefined, breath, this.motion.glide);
      this.fireArt.clear();
      if (breathMs !== undefined) {
        drawFireStream(this.fireArt, pose.mouth.point, pose.mouth.angle, breathMs);
      }
      return pose;
    }
    // The sprite faces either way (mirrored to face left) and tilts: turn the world aim into the rider's local aim.
    const local = frameLocalAngle(this.frame, this.bow.aimAngle);
    const aim = Math.min(AIM_MAX, Math.max(AIM_MIN, local));
    return drawDragonWithRider(this.art, this.motion.wingMs, 'archer', DRAGON_ARCHER_LOOK, palette, { aim, tension: this.bow.tension }, undefined, this.motion.glide);
  }

  /** MOBA: its level as stars under the health bar (level − 1). */
  public setStars(count: number): void {
    this.stars = count;
    this.drawHealthBar();
  }

  public drawHealthBar(): void {
    const { width, height, y } = HEALTH_BAR;
    this.healthBar.position.set(0, y);
    const ratio = this.health / this.maxHealth;
    drawHealthBar(this.healthBar, ratio, width, height, this.barColor !== undefined && ratio > 0.3 ? this.barColor : undefined);
    if (this.stars > 0) {
      drawLevelStars(this.starArt, this.stars, height / 2 + 6);
    }
  }
}
