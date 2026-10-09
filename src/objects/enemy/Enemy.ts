import { Container } from 'pixi.js';
import { ENEMY_ATTACK, HORSE_LEG } from '../../config';
import { getArcherRig, toArcherLocalAngle } from '../../rendering/archer';
import type { AttackStyle } from '../../rendering/attackSwing';
import { BodyMotion } from '../../systems/bodyMotion';
import { ManaPool } from '../../systems/healing';
import type { BodyColors } from '../../rendering/bodyColors';
import { enemyGibColors } from '../../rendering/enemyBody';
import { fromBodyAnchor, spriteToWorld, toBodyAnchor, type BodyAnchor } from '../../systems/bodyAnchor';
import { ENEMY_LOOKS, type EnemyLook } from '../../data/enemies';
import { enemyArchetype } from '../../data/enemyKinds';
import { mountHealth } from '../../data/enemyTuning';
import { groundAt } from '../../systems/terrain';
import { boundsAround } from '../../utils/math';
import type { HitBox } from './enemyTypes';
import type { Bounds, EnemyType, Vec2 } from '../../types';
import { AfflictionLayer } from '../AfflictionLayer';
import { EnemyActions } from './enemyActions';
import { EnemyBars } from './EnemyBars';
import { EnemyBow } from './EnemyBow';
import { EnemyFigure } from './EnemyFigure';
import { bodyBounds, headBounds, type EnemyShape } from './enemyHitShape';
import { holdInVortex, liftFromSaddle, pin, pinnedFootPoint, throwInAir, throwOff, walk } from './enemyMotion';
import { Vitals, applyDamage, applyHeal, unseatRider } from './enemyDamage';
import { applyEnemyNet, enemyNetState } from './enemyNet';
import { MountedRider } from './MountedRider';

export type { ThrowNet } from '../../systems/bodyMotion';
export type { EnemyNet, EnemyTarget, HitInfo, RiderOff } from './enemyTypes';
import type { EnemyNet, EnemyTarget, HitInfo, RiderOff } from './enemyTypes';

/** Container scale of a normal-sized enemy (bigger types multiply it by their size). */
const ENEMY_SCALE = 2 / 3;

/**
 * A ground enemy: what the rest of the game calls (AI, combat, co-op). Its parts, in this folder: `figure` (the drawn
 * body, falls, gibs), `actions` (swing, cast, stagger, cheer), `vitals` and enemyDamage (hits, reactions, heals),
 * enemyMotion (walking, vortex, throws, pins), `rider` (a mounted knight's horse), `bars`, `bow` (archers), `motion`
 * (thrown, pinned state) and enemyNet (co-op state).
 */
export default class Enemy extends Container {
  public readonly look: EnemyLook;
  /** Its health (enemyDamage.ts). */
  public readonly vitals: Vitals;
  /** Walking speed (px/s). */
  public readonly speed: number;
  /** Where it is walking (px/s); changed in place. */
  public readonly velocity: Vec2 = { x: 0, y: 0 };
  /** Its drawn body (falls, gibs, the body transform). */
  public readonly figure: EnemyFigure;
  /** What it is busy doing (a swing, a cast, a stagger, the cheer). */
  public readonly actions: EnemyActions;
  /** On horseback: the horse (its own health, a lame leg; bolting or dying once the fight is over for it). */
  public readonly rider?: MountedRider;
  public readonly bars: EnemyBars;
  /** Archer: the bow (raised, drawn, aimed, the pause between shots). */
  public readonly bow = new EnemyBow();
  /**
   * Thrown through the air (a vortex threw it out, or it was hit up there), flailing until it lands; pinned to the
   * ground by a pinning arrow (it can't walk until the pin runs out, but can still swing or shoot).
   */
  public readonly motion = new BodyMotion();
  public target: EnemyTarget;
  /** Fire, frost and vortex (fire, frost and vortex arrows): drawn over the body. */
  public readonly afflictions: AfflictionLayer;
  /** The priest's mana (healers only): refills fast, spent on heals (EnemyAI); drawn under the health bar. */
  public readonly mana?: ManaPool;
  /** Walked off the field (a priest left alone, `escape`): no longer alive for the battle. */
  private escaped = false;
  /** Co-op host: hears about every hit, swing, heal and spell, to replay them on the guest's screen. */
  public netHooks?: {
    damaged(amount: number, hit: HitInfo): void;
    attacked(style: AttackStyle): void;
    healed?(amount: number): void;
    cast?(): void;
    unseated?(): void;
  };
  /**
   * Host: a mounted knight's rider leaves the saddle at `x` (his horse killed by `hit`, or he by it, or a vortex pulled
   * him out); the scene puts him on the ground as its `unhorsed` kind (dead if `off.health` is 0) and returns him.
   */
  public onUnhorsed?: (x: number, hit: HitInfo, off: RiderOff) => Enemy | undefined;

  public constructor(
    x: number,
    health = 3,
    speed = 60,
    target: EnemyTarget = 'bowman',
    public readonly kind: EnemyType = 'basic',
  ) {
    super();
    this.look = ENEMY_LOOKS[kind];
    this.actions = new EnemyActions(this.look.attackStyles, this.look.attackStyle);
    this.figure = new EnemyFigure(this);
    if (enemyArchetype(kind).rides) {
      this.rider = new MountedRider(this, mountHealth(kind, health));
    }
    this.figure.drawPlaceholder();
    this.afflictions = new AfflictionLayer(kind);
    this.addChild(this.figure.body, this.afflictions.art);
    this.bars = new EnemyBars(this.look.size, this.rider !== undefined, enemyArchetype(kind).heals);
    this.addChild(this.bars.health);
    if (enemyArchetype(kind).heals) {
      this.mana = new ManaPool();
    }
    this.vitals = new Vitals(health);
    this.speed = Math.max(0, speed);
    this.target = target;
    this.scale.set(ENEMY_SCALE * this.look.size);
    this.position.set(x, groundAt(x));
    this.zIndex = 1;
    this.velocity.x = -this.speed;
    this.drawHealthBar();
    if (this.mana) {
      this.bars.drawMana(this.mana.ratio);
    }
  }

  /** On horseback (a mounted knight): drawn with its horse, never knocked down, unhorsed when killed. */
  public get rides(): boolean {
    return enemyArchetype(this.kind).rides;
  }

  /** Ground enemies walk; only dragons fly (lightning strikes the ground, not the sky). */
  public readonly isFlying = false;

  /** Host: told when it lands from a throw, with the speed it hit the ground at (for the fall damage). */
  public get onLanded(): ((impactSpeed: number) => void) | undefined {
    return this.motion.onLanded;
  }

  public set onLanded(callback: ((impactSpeed: number) => void) | undefined) {
    this.motion.onLanded = callback;
  }

  /** Body size (1 = a normal stickman; brutes are 1.5). */
  public get size(): number {
    return this.look.size;
  }

  /** How far the club reaches when it lands (see EnemyLook.strikeReach). */
  public get strikeReach(): number {
    return this.look.strikeReach;
  }

  /** How close it comes to strike the bowman and the keep (EnemyKind build `reach`; undefined = EnemyAI's defaults). */
  public get reach(): { bowman: number; keep: number } | undefined {
    return this.look.reach;
  }

  /** Colours of its pieces when blown apart, and its blood (zombies bleed green). */
  public get bodyColors(): BodyColors {
    return enemyGibColors(this.kind);
  }

  public get isArcher(): boolean {
    return enemyArchetype(this.kind).shoots;
  }

  /** Stops walking. */
  public halt(): void {
    this.velocity.x = 0;
    this.velocity.y = 0;
  }

  /**
   * Archer: face `angle`, raise the bow, draw, and return true on the frame the arrow is released.
   * Call every frame while standing in range; call relaxBow() otherwise.
   */
  public aimBow(angle: number, realDeltaMs: number): boolean {
    // Chilled archers draw slower; frozen or caught in a vortex, not at all.
    const deltaMs = this.afflictions.inVortex ? 0 : realDeltaMs * this.afflictions.timeScale;
    if (deltaMs === 0) {
      return false;
    }
    this.halt();
    this.figure.face(Math.cos(angle) < 0 ? -1 : 1);
    return this.bow.draw(angle, deltaMs);
  }

  /** Archer: lower the bow (walking, knocked down, no target). */
  public relaxBow(realDeltaMs: number): void {
    this.bow.relax(realDeltaMs * this.afflictions.timeScale);
  }

  /** Archer: where the arrow is nocked, in world space (matches the drawn bow). */
  public getBowReleasePoint(): Vec2 {
    const localAngle = toArcherLocalAngle(this.bow.aimAngle, this.figure.body.rotation, this.figure.facing);
    const nock = getArcherRig(localAngle, this.bow.tension, this.bow.ready).stringNock;
    return spriteToWorld(nock, this.figure.transform());
  }

  /** Applies damage and plays the reaction (enemyDamage.applyDamage); returns the health left. */
  public takeDamage(amount: number, hit: HitInfo = { cause: 'arrow', fromX: this.x - 1 }): number {
    if (this.isAlive()) {
      this.netHooks?.damaged(amount, hit);
      applyDamage(this, amount, hit);
    }
    return this.vitals.health;
  }

  /** A vortex arrow hit the rider: pulled out of the saddle, the horse bolts (enemyDamage.unseatRider). */
  public unseat(): Enemy | undefined {
    return unseatRider(this);
  }

  /** A mounted knight's horse hit in the leg: it stumbles and goes lame for `durationMs` (a fresh one restarts it). */
  public lame(durationMs: number): void {
    if (!this.isAlive() || !this.rider) {
      return;
    }
    this.rider.mount.lame(durationMs);
    this.actions.stagger(HORSE_LEG.stumbleMs);
  }

  /** Its horse dead, its rider still in the saddle for a moment: the level isn't over until he's on the ground. */
  public get riderPending(): boolean {
    return this.rider?.mount.riderPending ?? false;
  }

  /** A rider put on the ground with `health` left of his full health (thrown off a horse). */
  public startWounded(health: number): void {
    this.vitals.set(health);
    this.drawHealthBar();
  }

  /** A rider pulled out of the saddle by a vortex: starts at saddle height (enemyMotion). */
  public liftFromSaddle(): void {
    liftFromSaddle(this);
  }

  /** Thrown off its horse (a mounted knight's rider), away from `fromX` (enemyMotion). */
  public throwOff(fromX: number, fromNet = false, force = 1): void {
    throwOff(this, fromX, fromNet, force);
  }

  /**
   * The enemies won: stop and cheer (a random one of three). A knocked-down enemy gets up first.
   * Faces the player's side.
   */
  public celebrate(): void {
    if (!this.isAlive() || this.actions.cheer) {
      return;
    }
    this.actions.celebrate();
    this.halt();
  }

  public get isCelebrating(): boolean {
    return this.isAlive() && this.actions.cheer !== undefined;
  }

  /** True while a surviving enemy is knocked down or flying through the air (can't move or attack). */
  public get isDown(): boolean {
    return this.isAlive() && (this.figure.fall !== undefined || this.motion.isThrown);
  }

  public get isThrown(): boolean {
    return this.motion.isThrown;
  }

  public clearHitTint(): void {
    if (!this.isAlive()) {
      return;
    }
    this.figure.body.alpha = 1;
  }

  public applyHitReaction(pushX: number): void {
    if (!this.isAlive() || this.figure.fall || this.afflictions.isFrozen) {
      return;
    }
    this.actions.stagger(120);
    this.x += Math.max(-6, Math.min(8, pushX));
  }

  /**
   * Swings the club (`style`, or one of its swings at random); `onImpact` runs when the club lands (mid-swing),
   * unless the enemy is knocked down, killed or starts cheering first.
   */
  public playAttackAnimation(onImpact?: () => void, style?: AttackStyle): void {
    const swing = this.actions.swing(onImpact, style);
    this.netHooks?.attacked(swing);
  }

  /** Healed by a priest: gets `amount` health back (up to its full health). */
  public heal(amount: number): void {
    if (!this.isAlive() || amount <= 0) {
      return;
    }
    this.netHooks?.healed?.(amount);
    applyHeal(this, amount);
  }

  /** Healed this much short of its full health (on horseback, the rider's and the horse's). */
  public get missingHealth(): number {
    return this.vitals.missing + (this.rider?.mount.missingHealth ?? 0);
  }

  /**
   * The priest raises its scepter and casts (planted meanwhile); `onDone` (EnemyAI's heals, host only) runs when the cast
   * ends, and is lost if the cast is cut short (knocked down, thrown, frozen, a vortex).
   */
  public castHeal(onDone?: () => void): void {
    this.actions.cast(onDone);
    this.halt();
    this.netHooks?.cast?.();
  }

  public get isCasting(): boolean {
    return this.actions.casting;
  }

  /** Mid-swing (its club on the way). */
  public get isAttacking(): boolean {
    return this.actions.swinging;
  }

  /** The priest's mana refills (host); the bar follows it. */
  public updateMana(deltaMs: number): void {
    if (this.mana && this.isAlive()) {
      this.mana.update(deltaMs);
      this.bars.drawMana(this.mana.ratio, this.mana.exhausted);
    }
  }

  /** Pins it to the ground for `durationMs` (enemyMotion). */
  public pin(durationMs: number): void {
    pin(this, durationMs);
  }

  /** Held by a vortex this frame at `x`, lifted `lift` px and turned `lean` (enemyMotion). */
  public holdInVortex(x: number, lift: number, lean: number, levitating = false): void {
    holdInVortex(this, x, lift, lean, levitating);
  }

  /** Thrown through the air at (`vx`, `vy`) px/s, tumbling at `spin` radians/s (enemyMotion). */
  public throwInAir(vx: number, vy: number, spin: number): void {
    throwInAir(this, vx, vy, spin);
  }

  /** Where the stuck foot of a pinned enemy is (enemyMotion). */
  public pinnedFootPoint(): Vec2 {
    return pinnedFootPoint(this);
  }

  public get isPinned(): boolean {
    return this.isAlive() && this.motion.isPinned;
  }

  /** Co-op: what the guest needs besides the position (enemyNet). */
  public getNetState(): EnemyNet {
    return enemyNetState(this);
  }

  /** Co-op guest: puts the enemy where the host has it (enemyNet). */
  public applyNetState(state: EnemyNet & { x: number; y: number }): void {
    applyEnemyNet(this, state);
  }

  /** Plays and draws the body (EnemyFigure) at the afflictions' pace. */
  public updateAnimation(deltaMs: number, moving: boolean): void {
    this.figure.update(deltaMs, moving);
  }

  /** Out of the battle: dead, or a priest that walked off the field (escape). */
  public isAlive(): boolean {
    return this.vitals.alive && !this.escaped;
  }

  /** A priest left alone walked off the field's edge (EnemyAI): gone for good, counted as defeated. */
  public escape(): void {
    this.escaped = true;
    this.halt();
  }

  /** Health left (e.g. whether a hit will kill it). */
  public get currentHealth(): number {
    return this.vitals.health;
  }

  public getHealthRatio(): number {
    return this.vitals.ratio;
  }

  public getPhysicsBounds(): Bounds {
    const zones = this.rider?.hitZones();
    if (zones) {
      return boundsAround(zones.flatMap(({ bounds }) => [{ x: bounds.left, y: bounds.top }, { x: bounds.right, y: bounds.bottom }]), 0);
    }
    return bodyBounds(this.shape());
  }

  /** Box around the drawn head (follows bob, lean, scale and falls), in world space; a rider's head on horseback. */
  public getHeadBounds(): Bounds {
    const zones = this.rider?.hitZones();
    if (zones) {
      return zones[0].bounds;
    }
    return headBounds(this.shape());
  }

  /** Where it can be hit: head (a headshot) and body; on horseback the rider's head and torso and the horse's body, neck and head. */
  public getHitBoxes(): HitBox[] {
    return this.rider?.hitZones() ?? [{ bounds: this.getHeadBounds(), headshot: true }, { bounds: this.getPhysicsBounds(), headshot: false }];
  }

  /** How it's drawn now, for its hit shape (enemyHitShape.ts). */
  private shape(): EnemyShape {
    return { transform: this.figure.transform(), size: this.look.size, pose: this.figure.jointPose() };
  }

  /** One frame of walking towards `target` (enemyMotion.walk). */
  public update(realDeltaMs: number, target?: Vec2, stopDistance = 0): void {
    walk(this, realDeltaMs, target, stopDistance);
  }

  /** Ready to start a swing (not down, not mid-swing, pause over); starting one restarts the pause. */
  public canAttack(): boolean {
    if (this.figure.fall || this.motion.isThrown || this.afflictions.isFrozen || this.afflictions.inVortex) {
      return false;
    }
    return this.actions.tryStartCooldown(ENEMY_ATTACK.intervalMs);
  }

  public isMoving(): boolean {
    return Math.abs(this.velocity.x) > 1 || Math.abs(this.velocity.y) > 1;
  }

  public setPaused(paused: boolean): void {
    if (paused) {
      this.halt();
    }
  }

  /** Pins a world point/angle (e.g. an arrow hit) to this enemy's torso. */
  public toBodyAnchor(point: Vec2, angle: number): BodyAnchor {
    return toBodyAnchor(point, angle, this.figure.transform(), this.figure.torso());
  }

  /** Where a pinned anchor is now, following walking, attacks, falls and lying. */
  public resolveBodyAnchor(anchor: BodyAnchor): { position: Vec2; rotation: number } {
    return fromBodyAnchor(anchor, this.figure.transform(), this.figure.torso());
  }

  public drawHealthBar(): void {
    this.bars.draw(this.getHealthRatio(), this.rider?.mount.ratio);
  }
}
