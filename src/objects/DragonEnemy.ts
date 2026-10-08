import { Container, Graphics } from 'pixi.js';
import {
  DRAGON_ALTITUDE,
  DRAGON_DRAW_MS,
  DRAGON_HOVER_OFFSET,
  DRAGON_SCALE,
  DRAGON_SHOT_INTERVAL_MS,
  DRAGON_TURN_MS,
  FIRE_DRAGON_ALTITUDE,
  FIRE_DRAGON_BREATH_INTERVAL_MS,
  FIRE_DRAGON_HOVER_OFFSET,
} from '../config';
import { DRAGON_PALETTES, dragonHitZones, type DragonHitZone, type DragonPalette, type DragonPose } from '../rendering/dragon';
import { drawDragon } from '../rendering/dragonArt';
import { dragonArcherLook, dragonKnightLook, drawDragonWithRider } from '../rendering/designs/heavySkins';
import { drawHumanoid, type HumanoidLook } from '../rendering/designs/skinKit';
import { drawLookGibs } from '../rendering/designs/lookGibs';
import { HUMAN_BODY, type BodyColors } from '../rendering/bodyColors';
import { FIRE_BREATH_MS, IGNITE_HEAT, breathControl, drawFireStream, firePuffs, isBreathingFire, puffPosition } from '../rendering/dragonFire';
import { DRAGON_HIT_MS, dragonFallState, drawThrownRider, lyingDragonPose, riderGibSimulation } from '../rendering/dragonDeath';
import { DragonGibSimulation } from '../rendering/dragonGibs';
import { GIB_GROUND_Y, type GibSimulation } from '../rendering/stickmanGibs';
import type { BodyAnchor } from '../systems/bodyAnchor';
import { cruiseAltitude, facingScale, flyTowards, hoverX, nextHoverSide, stepFacing, type HoverSide } from '../systems/dragonFlight';
import { buffetOffset } from '../systems/vortex';
import { groundAt } from '../systems/terrain';
import { enemyArchetype, type FlyingType } from '../data/enemyKinds';
import type { Bounds, Vec2 } from '../types';
import { drawHealthBar } from '../rendering/healthBar';
import { boundsAround } from '../utils/math';
import type { HitInfo } from './Enemy';
import { AfflictionLayer, type AfflictionNet } from './AfflictionLayer';

/** Flames on a burning dragon, in its (scaled-down) art units. */
const AFFLICTION_SIZE = 1.5;

/** Wraps an angle into (−π, π]. */
const normalizeAngle = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Local aim limits for the rider (radians, + = down): no shooting backwards or straight up. */
const AIM_MIN = -0.25;
const AIM_MAX = 1.35;
const RELAX_MS = 400;
const HIT_FLASH_MS = 120;
/** Health bar above the dragon, in local (unscaled) units. */
const HEALTH_BAR = { width: 70, height: 8, y: -112 };

/** One hit zone of the dragon (world space). */
export interface HitBox {
  bounds: Bounds;
  headshot: boolean;
}

/** Fire dragon: local aim limits of the fire (radians, + = down) and how fast the head turns to follow. */
const FIRE_AIM_MIN = 0.2;
const FIRE_AIM_MAX = 1.25;
const FIRE_TURN_PER_S = 1.2;

/** The dragons (data/enemyKinds: the enemies whose archetype flies). */
export type DragonKind = FlyingType;

/** How each kind looks and flies: hide, rider, cruising height and hover distance. */
const DRAGON_KINDS: Readonly<Record<DragonKind, { palette: DragonPalette; rider: 'archer' | 'unarmed'; altitude: number; hoverOffset: number }>> = {
  dragon: { palette: DRAGON_PALETTES.dark, rider: 'archer', altitude: DRAGON_ALTITUDE, hoverOffset: DRAGON_HOVER_OFFSET },
  fireDragon: { palette: DRAGON_PALETTES.red, rider: 'unarmed', altitude: FIRE_DRAGON_ALTITUDE, hoverOffset: FIRE_DRAGON_HOVER_OFFSET },
};

/**
 * After this long (ms) a dragon's death is over: it has dropped from its altitude and lies flat, and the thrown rider
 * has tumbled and come to rest (each takes well under half of it).
 */
const DRAGON_SETTLE_MS = 6000;
/** Force range of the rider's explosive death (like enemies blown apart). */
const RIDER_GIB_FORCE = { min: 1, max: 1.7 };
/** The riders' looks (rendering/designs): the dragon archer's hooded bandit; the fire dragon's knight is animated. */
const DRAGON_ARCHER_LOOK = dragonArcherLook();
/** Colours of a blown-apart rider's pieces. */
const RIDER_GIB_COLORS: Readonly<Record<'archer' | 'unarmed', BodyColors>> = {
  archer: { ...HUMAN_BODY, bone: 0xd2a07a, boneRear: 0x5a4a6a },
  unarmed: { ...HUMAN_BODY, bone: 0x6d7380, boneRear: 0xa8343a },
};

/**
 * A killed dragon (rendering/dragonDeath.ts): it falls in "death space", the dragon's own sprite space with
 * the ground at GIB_GROUND_Y, where its origin started at `startY` (from its height above the ground).
 */
interface DragonDeath {
  timeMs: number;
  startY: number;
  /** The pose it was killed in (wings freeze; the rider is thrown off from here). */
  pose: DragonPose;
  /** Killed by a direct explosive hit: the rider is blown apart instead of thrown off. */
  riderGibs?: GibSimulation;
  /** A fire dragon killed by a direct explosive hit blows up too: its chunks, in death space. */
  dragonGibs?: DragonGibSimulation;
}

/**
 * Flying dragon. The dark dragon archer flies in high, hovers in front of the bowman (systems/dragonFlight),
 * and its rider draws and shoots hostile arrows like an enemy archer (CombatSystem aims for it). The red fire
 * dragon (unarmed rider) flies lower and closer and breathes long streams of fire (rendering/dragonFire.ts;
 * no damage yet) when the bowman is in reach (CombatSystem calls breathe). Arrows hit
 * the dragon's body or, for a headshot, the rider's head, and stick into it. A killed dragon falls out of
 * the sky and lies flat on the ground; its rider is thrown off, or blown apart by a killing explosive hit. Offers the same interface as Enemy where the combat code shares it.
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
  private readonly look: (typeof DRAGON_KINDS)[DragonKind];
  /** Fire dragon: time into the current breath (undefined between breaths), wait until the next, fire aim. */
  private breathMs?: number;
  private breathCooldownMs = 0;
  private fireAim = 0.6;
  private fireTarget = 0.6;
  private readonly maxHealth: number;
  private health: number;
  private readonly speed: number;
  private timeMs = Math.random() * 1000;
  private pose: DragonPose;
  /** World aim angle and draw progress of the rider's bow. */
  private aimAngle = Math.PI;
  private tension = 0;
  private shotTimerMs = DRAGON_SHOT_INTERVAL_MS * 0.5;
  private flashMs = 0;
  private death?: DragonDeath;
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
      this.tension = 0;
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
      const force = RIDER_GIB_FORCE.min + Math.random() * (RIDER_GIB_FORCE.max - RIDER_GIB_FORCE.min);
      const blast = hit?.cause === 'blast';
      const seed = Math.floor(Math.random() * 1e9);
      this.death = {
        timeMs: 0,
        startY,
        pose: this.pose,
        riderGibs: blast ? riderGibSimulation(this.pose, startY, seed, force) : undefined,
        // The fire dragon's burning gut goes up with it (CombatSystem doubles the blast): it bursts into chunks.
        dragonGibs: blast && enemyArchetype(this.kind).breathesFire ? new DragonGibSimulation(this.pose, startY, seed, force, this.look.palette) : undefined,
      };
      this.healthBar.visible = false;
      this.tension = 0;
      this.afflictions.extinguish();
      this.afflictions.thaw();
      // It falls level, not tilted by the gusts any more.
      this.rotation = 0;
      // Killed mid-breath: the fire goes out.
      this.breathMs = undefined;
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
    return { aim: this.aimAngle, tension: this.tension, breathMs: this.breathMs, fireAim: this.fireAim, side: this.side, af: this.afflictions.getNetState() };
  }

  /** Co-op guest: flies where the host has it, with the host's bow and breath (no AI runs on the guest). */
  public applyNetState(state: { x: number; y: number; aim: number; tension: number; breathMs?: number; fireAim: number; side?: HoverSide; af?: AfflictionNet }): void {
    if (!this.isAlive()) {
      return;
    }
    this.afflictions.applyNetState(state.af);
    this.position.set(state.x, state.y);
    this.aimAngle = state.aim;
    this.tension = state.tension;
    this.breathMs = state.breathMs;
    this.fireAim = state.fireAim;
    this.fireTarget = state.fireAim;
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
    return this.breathMs !== undefined && isBreathingFire(this.breathMs);
  }

  /**
   * Fire dragon: the burning part of its stream in world space (centre and radius of every puff still hot
   * enough to set things alight), empty between breaths.
   */
  public getFlames(): Array<{ center: Vec2; radius: number }> {
    if (this.breathMs === undefined || !this.isAlive()) {
      return [];
    }
    const { point, angle } = this.pose.mouth;
    return firePuffs(this.breathMs)
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
    this.fireTarget = Math.min(FIRE_AIM_MAX, Math.max(FIRE_AIM_MIN, this.toLocalAngle(worldAngle)));
    if (this.breathMs === undefined && this.breathCooldownMs <= 0) {
      this.breathMs = 0;
      this.fireAim = this.fireTarget;
      this.breathCooldownMs = FIRE_DRAGON_BREATH_INTERVAL_MS;
    }
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
    const deltaMs = realDeltaMs * this.afflictions.timeScale;
    this.aimAngle = worldAngle;
    this.shotTimerMs -= deltaMs;
    this.tension = Math.max(0, Math.min(1, 1 - this.shotTimerMs / DRAGON_DRAW_MS));
    if (this.shotTimerMs > 0) {
      return false;
    }
    this.shotTimerMs = DRAGON_SHOT_INTERVAL_MS;
    this.tension = 0;
    return true;
  }

  /** Out of range: ease the string back. */
  public relax(deltaMs: number): void {
    this.tension = Math.max(0, this.tension - deltaMs / RELAX_MS);
    this.shotTimerMs = Math.max(this.shotTimerMs, DRAGON_DRAW_MS);
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
    if (this.death) {
      // At rest on the ground it stays as it was last drawn.
      if (!this.deathSettled) {
        this.drawDeath(realDeltaMs);
        this.afflictions.art.clear();
      }
    } else {
      if (!this.paused) {
        this.timeMs += deltaMs;
        this.updateBreath(deltaMs);
        if (this.isTurning) {
          this.facing = stepFacing(this.facing, this.facingX, deltaMs, DRAGON_TURN_MS);
          this.applyFacing();
        }
      }
      // Buffeted, it tilts with the gusts, and the fire chokes off.
      this.rotation = buffetOffset(this.timeMs, this.afflictions.turbulence).tilt;
      if (this.afflictions.isTurbulent) {
        this.breathMs = undefined;
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
    const local = this.toLocalPoint(point);
    return { along: local.x, side: local.y, angle: this.toLocalAngle(angle) };
  }

  public resolveBodyAnchor(anchor: BodyAnchor): { position: Vec2; rotation: number } {
    return { position: this.toWorld({ x: anchor.along, y: anchor.side }), rotation: this.toWorldAngle(anchor.angle) };
  }

  /** A world angle in the sprite's own frame (its art faces +x; mirrored while it faces left), and back. */
  private toLocalAngle(worldAngle: number): number {
    return normalizeAngle(this.scale.x < 0 ? Math.PI - (worldAngle - this.rotation) : worldAngle - this.rotation);
  }

  private toWorldAngle(localAngle: number): number {
    return this.scale.x < 0 ? this.rotation + Math.PI - localAngle : this.rotation + localAngle;
  }

  /** Draws it facing `facing` (mirrored to face left; squeezed mid-turn); the health bar keeps its size. */
  private applyFacing(): void {
    this.scale.set(facingScale(this.facing) * DRAGON_SCALE, DRAGON_SCALE);
    this.healthBar.scale.set(1 / this.scale.x, 1 / this.scale.y);
  }

  /**
   * Wings frozen, it drops tipping nose-down and settles flat (the art moves, so stuck arrows follow it via
   * toWorld); the rider tumbles to the ground on his back, or his pieces fly.
   */
  private drawDeath(deltaMs: number): void {
    const death = this.death!;
    death.timeMs += deltaMs;
    this.art.clear();
    if (death.dragonGibs) {
      // Blown apart: the chunks fly, bounce and settle (death space, drawn so its origin stays where it was hit).
      death.dragonGibs.step(deltaMs);
      this.art.position.set(0, -death.startY);
      this.art.rotation = 0;
      const { bone } = this.look.palette;
      death.dragonGibs.pieces.forEach((piece) => {
        this.art.poly(DragonGibSimulation.outlineOf(piece).flatMap((point) => [point.x, point.y]))
          .fill({ color: piece.color })
          .stroke({ width: 1.5, color: bone, join: 'round' });
      });
    } else {
      const fall = dragonFallState(DRAGON_HIT_MS + death.timeMs, death.startY);
      drawDragon(this.art, lyingDragonPose(death.pose, fall.lying), false, this.look.palette);
      this.art.position.set(0, fall.y - death.startY);
      this.art.rotation = fall.rotation;
    }
    if (death.riderGibs) {
      death.riderGibs.step(deltaMs);
      drawLookGibs(this.riderArt, death.riderGibs, this.riderLook(death.timeMs), RIDER_GIB_COLORS[this.look.rider], -death.startY);
      this.riderArt.x = death.pose.rider.hip.x;
    } else {
      this.riderArt.clear();
      this.riderArt.position.set(0, -death.startY);
      const look = this.riderLook(death.timeMs);
      drawThrownRider(this.riderArt, death.pose, death.timeMs, death.startY, (g, rider) => drawHumanoid(g, rider, look));
    }
  }

  /**
   * The dragon has fallen and lies flat (or its chunks rest) and the thrown rider lies still (or his pieces rest):
   * nothing in its death moves any more.
   */
  private get deathSettled(): boolean {
    const death = this.death;
    return death !== undefined && death.timeMs >= DRAGON_SETTLE_MS
      && (death.dragonGibs?.settled ?? true) && (death.riderGibs?.settled ?? true);
  }

  /** The rider's look once he's off the dragon (both legs show). */
  private riderLook(timeMs: number): HumanoidLook {
    return { ...(this.look.rider === 'archer' ? DRAGON_ARCHER_LOOK : dragonKnightLook(timeMs)), hideFarLeg: false };
  }

  /** Advances the breath (it runs to the end once started) and the wait until the next; the head follows the target. */
  private updateBreath(deltaMs: number): void {
    this.breathCooldownMs = Math.max(0, this.breathCooldownMs - deltaMs);
    if (this.breathMs === undefined) {
      return;
    }
    this.breathMs += deltaMs;
    const turn = (FIRE_TURN_PER_S * deltaMs) / 1000;
    this.fireAim += Math.max(-turn, Math.min(turn, this.fireTarget - this.fireAim));
    if (this.breathMs >= FIRE_BREATH_MS) {
      this.breathMs = undefined;
    }
  }

  private redraw(): DragonPose {
    const { palette, rider } = this.look;
    // Once killed the clock stops, so the wings freeze mid-beat while it falls.
    if (rider === 'unarmed') {
      const breath = this.breathMs === undefined ? undefined : breathControl(this.breathMs, this.fireAim);
      const pose = drawDragonWithRider(this.art, this.timeMs, 'unarmed', dragonKnightLook(this.timeMs), palette, undefined, breath);
      this.fireArt.clear();
      if (this.breathMs !== undefined) {
        drawFireStream(this.fireArt, pose.mouth.point, pose.mouth.angle, this.breathMs);
      }
      return pose;
    }
    // The sprite faces either way (mirrored to face left) and tilts: turn the world aim into the rider's local aim.
    const local = this.toLocalAngle(this.aimAngle);
    const aim = Math.min(AIM_MAX, Math.max(AIM_MIN, local));
    return drawDragonWithRider(this.art, this.timeMs, 'archer', DRAGON_ARCHER_LOOK, palette, { aim, tension: this.tension });
  }

  /** Local (sprite) point to world, through the art's own transform (moved while the corpse falls). */
  private toWorld(local: Vec2): Vec2 {
    const art = this.art;
    const artCos = Math.cos(art.rotation);
    const artSin = Math.sin(art.rotation);
    const moved = { x: art.x + local.x * artCos - local.y * artSin, y: art.y + local.x * artSin + local.y * artCos };
    const x = moved.x * this.scale.x;
    const y = moved.y * this.scale.y;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    return { x: this.x + x * cos - y * sin, y: this.y + x * sin + y * cos };
  }

  private toLocalPoint(world: Vec2): Vec2 {
    const dx = world.x - this.x;
    const dy = world.y - this.y;
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    const moved = { x: (dx * cos - dy * sin) / this.scale.x - this.art.x, y: (dx * sin + dy * cos) / this.scale.y - this.art.y };
    const artCos = Math.cos(-this.art.rotation);
    const artSin = Math.sin(-this.art.rotation);
    return { x: moved.x * artCos - moved.y * artSin, y: moved.x * artSin + moved.y * artCos };
  }

  private drawHealthBar(): void {
    const { width, height, y } = HEALTH_BAR;
    this.healthBar.position.set(0, y);
    drawHealthBar(this.healthBar, this.health / this.maxHealth, width, height);
  }
}
