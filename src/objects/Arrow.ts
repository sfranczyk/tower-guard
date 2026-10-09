import { Graphics, Sprite, Texture } from 'pixi.js';
import { ARROWS, GAME_HEIGHT, SCENERY_MARGIN, WORLD_WIDTH } from '../config';
import { DEFAULT_AIM_COLORS } from '../data/battlegrounds';
import { flightParams } from '../data/projectiles';
import { advanceProjectile, type FlightParams } from '../systems/ballistics';
import type { BodyAnchor } from '../systems/bodyAnchor';
import type { EnemyType, ProjectileType, Vec2 } from '../types';

/** Something an arrow can be pinned to that moves and changes pose (an enemy). */
export interface AnchorTarget {
  toBodyAnchor(point: Vec2, angle: number): BodyAnchor;
  resolveBodyAnchor(anchor: BodyAnchor): { position: Vec2; rotation: number };
}

export default class Arrow extends Sprite {
  private stuck = false;
  private stuckTarget: AnchorTarget | undefined;
  private stuckAnchor: BodyAnchor | undefined;
  private readonly velocity = { x: 0, y: 0 };
  private readonly trail: Graphics;
  private previousPosition = { x: 0, y: 0 };
  private segmentStart = { x: 0, y: 0 };
  private segmentEnd = { x: 0, y: 0 };
  private trailAge = 0;
  private trailVisible = true;
  private activeProjectile = false;
  private projectileType: ProjectileType = 'normal';
  private hitCount = 0;
  /** Shot by an enemy archer: hurts the bowman/keep, ignores enemies. */
  private hostileShot = false;
  /** Who loosed a hostile arrow (its damage depends on it, see ENEMY_DAMAGE). */
  public shooter?: EnemyType;
  /** Which player loosed a player arrow (co-op: their trails and shrapnel bursts are their own). */
  public owner = 0;
  /** Co-op host: told when the arrow sticks (into a target or the ground) or is gone, for the guest. */
  public netHooks?: { stuck(target: AnchorTarget | undefined, point: Vec2): void; gone(): void };
  /** The battleground's wind (px/s² for a normal arrow), set before firing. */
  public wind = 0;
  /** How long it has been flying (ms; friendly fire spares the one who loosed it at first). */
  public flightMs = 0;

  public constructor(
    x: number,
    y: number,
    texture: Texture,
    trail: Graphics,
    private readonly trailColors: { glow: number; core: number } = { glow: DEFAULT_AIM_COLORS.trailGlow, core: DEFAULT_AIM_COLORS.trailCore },
  ) {
    super(texture);
    this.trail = trail;
    this.anchor.set(0.5, 0.5);
    this.scale.set(0.5);
    this.position.set(x, y);
    this.zIndex = 2;
    this.visible = false;
  }

  public fire(angle: number, power: number, projectileType: ProjectileType = 'normal', hostile = false): this {
    this.hostileShot = hostile;
    this.stuck = false;
    this.stuckTarget = undefined;
    this.stuckAnchor = undefined;
    this.trail.clear().visible = true;
    this.trail.alpha = 1;
    this.trailAge = 0;
    this.trailVisible = true;
    this.previousPosition = { x: this.x, y: this.y };
    this.segmentStart = { x: this.x, y: this.y };
    this.segmentEnd = { x: this.x, y: this.y };
    this.visible = true;
    this.activeProjectile = true;
    this.projectileType = projectileType;
    this.hitCount = 0;
    this.flightMs = 0;
    this.rotation = angle;
    this.velocity.x = Math.cos(angle) * power;
    this.velocity.y = Math.sin(angle) * power;
    return this;
  }

  public update(deltaMs: number): void {
    if (!this.activeProjectile) {
      return;
    }

    if (this.stuck) {
      if (this.stuckTarget && this.stuckAnchor) {
        // Ride along with the target's torso: walking, falling and lying.
        this.segmentStart = { x: this.x, y: this.y };
        const { position, rotation } = this.stuckTarget.resolveBodyAnchor(this.stuckAnchor);
        this.position.set(position.x, position.y);
        this.rotation = rotation;
        this.segmentEnd = { x: this.x, y: this.y };
      }
      return;
    }

    this.flightMs += deltaMs;
    this.segmentStart = { x: this.x, y: this.y };
    const state = { x: this.x, y: this.y, vx: this.velocity.x, vy: this.velocity.y };
    advanceProjectile(state, deltaMs / 1000, Arrow.getFlightParams(this.projectileType, this.wind));
    this.position.set(state.x, state.y);
    this.velocity.x = state.vx;
    this.velocity.y = state.vy;

    this.segmentEnd = { x: this.x, y: this.y };

    // Only the player's arrows leave a trail; enemy arrows fly clean.
    if (this.trailVisible && !this.hostileShot && Math.hypot(this.previousPosition.x - this.x, this.previousPosition.y - this.y) > 1) {
      this.trail.moveTo(this.previousPosition.x, this.previousPosition.y).lineTo(this.x, this.y)
        .stroke({ width: 2.5, color: this.trailColors.glow, alpha: 0.16 });
      this.trail.moveTo(this.previousPosition.x, this.previousPosition.y).lineTo(this.x, this.y)
        .stroke({ width: 1, color: this.trailColors.core, alpha: 0.72 });
      this.previousPosition = { x: this.x, y: this.y };
    }

    const velocityLengthSq = this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y;
    if (velocityLengthSq > 0) {
      this.rotation = Math.atan2(this.velocity.y, this.velocity.x);
    }

    // Off the drawn landscape (wide views show past the world's ends).
    const margin = 48;
    if (this.x < -SCENERY_MARGIN || this.x > WORLD_WIDTH + SCENERY_MARGIN || this.y > GAME_HEIGHT + margin) {
      this.deactivate();
    }
  }

  /**
   * Sticks into a wall it hit at `impact`, tip first: it stops there, pointing the way it flew, with its tip a
   * little way into the stone (`sink`: how far its centre stays back from the tip's point).
   */
  public stickToWall(impact: Vec2, sink: number): this {
    const heading = Math.atan2(this.velocity.y, this.velocity.x);
    this.x = impact.x - Math.cos(heading) * sink;
    return this.stickToGround(impact.y - Math.sin(heading) * sink);
  }

  public stickToGround(y: number): this {
    this.netHooks?.stuck(undefined, { x: this.x, y });
    this.stuck = true;
    this.stuckTarget = undefined;
    this.stuckAnchor = undefined;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.y = y;
    return this;
  }

  /** Pins the arrow where it hit; it then follows the target's body, including death falls. */
  public stickToEnemy(target: AnchorTarget, impactPoint = { x: this.x, y: this.y }): this {
    this.netHooks?.stuck(target, impactPoint);
    this.stuck = true;
    this.stuckTarget = target;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.position.set(impactPoint.x, impactPoint.y);
    this.stuckAnchor = target.toBodyAnchor(impactPoint, this.rotation);
    return this;
  }

  /** Current velocity (px/s), e.g. for a shrapnel burst. */
  public get velocityVector(): Vec2 {
    return { x: this.velocity.x, y: this.velocity.y };
  }

  /** What the arrow is stuck in (undefined when flying or in the ground). */
  public get stuckTo(): AnchorTarget | undefined {
    return this.stuckTarget;
  }

  public get isStuck(): boolean {
    return this.stuck;
  }

  /** Gravity, per-type air drag and wind shared by arrows, the trajectory preview and enemy aim. */
  public static getFlightParams(type: ProjectileType, wind = 0): FlightParams {
    return flightParams(type, ARROWS.gravity, wind);
  }

  public getTravelSegment(): { start: Vec2; end: Vec2 } {
    return {
      start: { ...this.segmentStart },
      end: { ...this.segmentEnd },
    };
  }

  /** No trail for this shot (arrow trails set to 0). */
  public hideTrail(): void {
    this.trail.clear();
    this.trail.visible = false;
    this.trailVisible = false;
  }

  /** Called when a new shot is fired: the trail fades and is gone once `keep` newer shots have been fired. */
  public ageTrail(keep: number): void {
    if (!this.trailVisible) {
      return;
    }

    this.trailAge += 1;
    if (this.trailAge >= keep) {
      this.trail.clear();
      this.trail.visible = false;
      this.trailVisible = false;
      return;
    }

    this.trail.alpha = 1 - this.trailAge / keep;
  }

  public deactivate(): this {
    if (this.activeProjectile) {
      this.netHooks?.gone();
    }
    this.stuck = false;
    this.stuckTarget = undefined;
    this.stuckAnchor = undefined;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.visible = false;
    this.activeProjectile = false;
    return this;
  }

  /** Gone and its trail too: nothing of it shows any more, so the scene can drop it (`dispose`). */
  public get isGone(): boolean {
    return !this.activeProjectile && !this.trailVisible;
  }

  /** Destroys the arrow and its trail (once it's gone). */
  public dispose(): void {
    this.trail.destroy();
    this.destroy();
  }

  public get hostile(): boolean {
    return this.hostileShot;
  }

  public get isActive(): boolean {
    return this.activeProjectile;
  }

  public get type(): ProjectileType {
    return this.projectileType;
  }

  public get impacts(): number {
    return this.hitCount;
  }

  public registerImpact(): void {
    this.hitCount += 1;
  }
}
