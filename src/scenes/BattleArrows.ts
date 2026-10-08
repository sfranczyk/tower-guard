import { Graphics, type Container } from 'pixi.js';
import { WORLD_WIDTH } from '../config';
import type { SoundId } from '../audio/SoundManager';
import { aimColorsOf, type Battleground } from '../data/battlegrounds';
import { launchSpeed, shrapnelBurst } from '../data/projectiles';
import type { GameTextures } from '../core/Scene';
import type { AimInput } from '../managers/InputManager';
import type { GuestSync } from '../net/GuestSync';
import type { ArrowLaunch, HostSync } from '../net/HostSync';
import Arrow from '../objects/Arrow';
import type { EffectsSystem } from '../systems/EffectsSystem';
import { isMagicArrow } from '../systems/ArrowMagic';
import { simulateTrajectory } from '../systems/ballistics';
import { groundAt } from '../systems/terrain';
import type { EnemyType, ProjectileType, Vec2 } from '../types';
import type { Player } from './PlayerControl';

const ENEMY_ARROW_TINT = 0xff8f80;
/** Fragments from a shrapnel burst are drawn at this scale (normal arrows: 0.5). */
const FRAGMENT_SCALE = 0.32;

/** What the battle's arrows need from the scene. */
export interface BattleArrowsDeps {
  readonly world: Container;
  readonly textures: GameTextures;
  readonly battleground: Battleground;
  /** This wave's wind (px/s² on a normal arrow). */
  readonly wind: number;
  /** How many of the latest shots keep their trail (settings drawer). */
  arrowTrails(): number;
  effects(): EffectsSystem;
  playSound(id: SoundId, at: Vec2): void;
  hostSync(): HostSync | undefined;
  guestSync(): GuestSync | undefined;
}

/**
 * Every arrow of a wave (`list`, which CombatSystem flies and resolves): the players' shots with their trails, the
 * shrapnel bursts, the enemies' arrows, a co-op guest's copies of the host's, and dropping the ones no longer seen.
 */
export class BattleArrows {
  public readonly list: Arrow[] = [];

  public constructor(private readonly deps: BattleArrowsDeps) {}

  /** Fire, frost and vortex arrows leave flames, glints or motes behind them as they fly. */
  public updateTrails(deltaMs: number): void {
    this.list
      .filter((arrow) => arrow.isActive && !arrow.isStuck && isMagicArrow(arrow.type))
      .forEach((arrow) => this.deps.effects().arrowTrail(arrow.type, { x: arrow.x, y: arrow.y }, deltaMs));
  }

  /** Guest: an arrow the host launched (its sound comes as its own event). */
  public launchReplica(launch: ArrowLaunch): Arrow {
    if (launch.hostile) {
      return this.fireEnemy(launch.from, launch.angle, launch.speed, launch.shooter ?? 'archer', true);
    }
    if (launch.type !== 'fragment') {
      this.list.filter((arrow) => arrow.owner === launch.owner).forEach((arrow) => arrow.ageTrail(this.deps.arrowTrails()));
    }
    return this.launchPlayer(launch.owner, launch.type, launch.from, launch.angle, launch.speed);
  }

  public fire(player: Player, aim: AimInput, power: number): void {
    // Only this player's earlier shots lose their trails.
    this.list.filter((arrow) => arrow.owner === player.index).forEach((arrow) => arrow.ageTrail(this.deps.arrowTrails()));
    const releasePoint = player.bowman.getBowReleasePoint();
    this.launchPlayer(player.index, player.projectile, releasePoint, Math.atan2(aim.direction.y, aim.direction.x), launchSpeed(player.projectile, power));
    this.deps.playSound('bowShot', releasePoint);
  }

  /** A player arrow (with a trail in the battleground's colours) flying from `from`. */
  public launchPlayer(owner: number, type: ProjectileType, from: Vec2, angle: number, speed: number): Arrow {
    const trail = new Graphics();
    trail.zIndex = 1;
    this.deps.world.addChild(trail);
    const { trailGlow, trailCore } = aimColorsOf(this.deps.battleground);
    const arrow = new Arrow(from.x, from.y, this.deps.textures.arrows[type], trail, { glow: trailGlow, core: trailCore });
    if (type === 'fragment') {
      arrow.scale.set(FRAGMENT_SCALE);
    }
    arrow.owner = owner;
    arrow.wind = this.deps.wind;
    arrow.fire(angle, speed, type);
    if (this.deps.arrowTrails() === 0) {
      arrow.hideTrail();
    }
    this.list.push(arrow);
    this.deps.world.addChild(arrow);
    this.deps.hostSync()?.trackArrow(arrow, { owner, type, from, angle, speed, hostile: false });
    return arrow;
  }

  /** Space: every shrapnel arrow of this player still in flight bursts into small arrows fanned around its heading. */
  public burstShrapnel(player: Player): void {
    this.list
      .filter((arrow) => arrow.isActive && !arrow.isStuck && !arrow.hostile && arrow.type === 'shrapnel' && arrow.owner === player.index)
      .forEach((arrow) => {
        const point = { x: arrow.x, y: arrow.y };
        const fragments = shrapnelBurst(arrow.velocityVector);
        arrow.deactivate();
        fragments.forEach((velocity) => {
          this.launchPlayer(player.index, 'fragment', point, Math.atan2(velocity.y, velocity.x), Math.hypot(velocity.x, velocity.y));
        });
        this.deps.effects().impact(point);
        this.deps.playSound('shrapnelBurst', point);
      });
  }

  /**
   * Drops the arrows that no longer show (gone, with no trail left): out of the list and the world, destroyed. Arrows
   * stuck in the ground, the stone or an enemy stay, and so does a gone arrow while its trail still fades.
   */
  public prune(): void {
    for (let index = this.list.length - 1; index >= 0; index -= 1) {
      const arrow = this.list[index];
      if (arrow.isGone) {
        this.list.splice(index, 1);
        this.deps.guestSync()?.forgetArrow(arrow);
        arrow.dispose();
      }
    }
  }

  /** An enemy archer's arrow: reddish, hurts the bowman (or the keep while he hides); `silent` for a co-op guest's copy. */
  public fireEnemy(from: Vec2, angle: number, speed: number, shooter: EnemyType, silent = false): Arrow {
    const trail = new Graphics();
    trail.zIndex = 1;
    this.deps.world.addChild(trail);
    const arrow = new Arrow(from.x, from.y, this.deps.textures.arrows.normal, trail);
    arrow.tint = ENEMY_ARROW_TINT;
    arrow.wind = this.deps.wind;
    arrow.fire(angle, speed, 'normal', true);
    // Enemy arrows fly clean: no trail to keep, so a gone one can be dropped at once.
    arrow.hideTrail();
    arrow.shooter = shooter;
    this.list.push(arrow);
    this.deps.world.addChild(arrow);
    this.deps.hostSync()?.trackArrow(arrow, { owner: -1, type: 'normal', from, angle, speed, hostile: true, shooter });
    if (!silent) {
      this.deps.playSound('bowShot', from);
    }
    return arrow;
  }

  /** Path the arrow would take if released now (same integrator, gravity and drag as real arrows). */
  public simulate(aim: AimInput, releasePoint: Vec2, projectile: ProjectileType): Vec2[] {
    const power = aim.power;
    const speed = launchSpeed(projectile, power);
    const velocity = { x: aim.direction.x * speed, y: aim.direction.y * speed };
    return simulateTrajectory(releasePoint, velocity, Arrow.getFlightParams(projectile, this.deps.wind), {
      // Same surface (and offset) at which flying arrows stick into the ground.
      groundY: (x) => groundAt(x) - 3,
      minX: 0,
      maxX: WORLD_WIDTH,
    });
  }
}
