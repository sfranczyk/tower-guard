import { WORLD_WIDTH } from '../../config';
import { horseDeathThrow } from '../../rendering/horseDeath';
import { mountedHitZones } from '../../rendering/horseHitZones';
import { gaitGroundSpeed, getHorsePose, type HorseGait, type HorsePose } from '../../rendering/horseRider';
import type { LanceHold } from '../../rendering/horseSeat';
import { spriteToWorld, type Torso } from '../../systems/bodyAnchor';
import { groundAt } from '../../systems/terrain';
import { boundsAround } from '../../utils/math';
import type { HitBox } from './enemyTypes';
import type Enemy from './Enemy';
import { BODY_SCALE } from './EnemyFigure';
import { HORSE_BOLT, Mount } from './Mount';

/** A dying horse lets its rider slide off backwards (lying down) or tips him forwards over its neck (dropping): this hard. */
const RIDER_OFF_FORCE = { back: 1, forward: 1.5 } as const;

/**
 * The horse side of a mounted knight (Enemy with archetype `rides`): the horse (Mount: its health, a lame leg, bolting,
 * dying), its gait's clock and pose as last drawn; the mounted animation (gallop, stand, lance thrust, cheer), the
 * horse's death throwing its rider off, the riderless horse bolting, and the mounted hit zones.
 */
export class MountedRider {
  public readonly mount: Mount;
  /** The gait's clock (at a gallop it advances with the distance covered). */
  private clockMs = Math.random() * 1000;
  /** The horse and rider as last drawn (hit zones, flames). */
  public pose?: HorsePose;

  public constructor(private readonly enemy: Enemy, horseHealth: number) {
    this.mount = new Mount(horseHealth);
  }

  public draw(gait: HorseGait, lance: LanceHold, riderless = false): void {
    this.pose = getHorsePose(this.clockMs, gait, riderless ? undefined : lance);
    this.enemy.figure.draw({ mode: 'mounted', pose: this.pose, riderless });
  }

  /**
   * Gallops (the gait keeping pace with the ground), stands, thrusts the lance, raises it to cheer; killed, the
   * riderless horse bolts.
   */
  public animate(deltaMs: number, moving: boolean): void {
    const { enemy, mount } = this;
    const { body } = enemy.figure;
    body.rotation = 0;
    if (mount.death) {
      this.updateHorseDeath(deltaMs);
      return;
    }
    if (mount.bolting) {
      this.updateBolt(mount.bolting, deltaMs);
      return;
    }
    if (!enemy.isAlive()) {
      return;
    }
    if (enemy.actions.cheer) {
      this.clockMs += deltaMs;
      body.scale.set(-BODY_SCALE.x, BODY_SCALE.y);
      this.draw('stand', { thrust: 0, raised: true });
      return;
    }
    if (enemy.actions.swinging) {
      this.clockMs += deltaMs;
      this.draw('stand', { thrust: enemy.actions.advanceSwing(deltaMs) });
      return;
    }
    if (!moving) {
      this.clockMs += deltaMs;
      this.draw('stand', { thrust: 0 });
      return;
    }
    enemy.figure.face(enemy.velocity.x < 0 ? -1 : 1);
    // A lame horse walks.
    const gait = mount.isLame ? 'walk' : 'gallop';
    this.stride(gait, Math.hypot(enemy.velocity.x, enemy.velocity.y) * deltaMs / 1000);
    this.draw(gait, { thrust: 0 });
  }

  /** The gait's clock for `distance` world px covered, so the planted hooves stay put. */
  private stride(gait: 'walk' | 'gallop', distance: number): void {
    this.clockMs += distance / (gaitGroundSpeed(gait) * BODY_SCALE.x * this.enemy.scale.x);
  }

  /**
   * The horse dying (rendering/horseDeath), its rider in the saddle until he's thrown off (backwards as it lies down,
   * forwards over its neck as it drops): then the host puts him on the ground with the health he has left.
   */
  private updateHorseDeath(deltaMs: number): void {
    const { enemy, mount } = this;
    const riderOff = mount.advanceDeath(deltaMs);
    const fall = mount.deathPose!;
    this.pose = fall.horse;
    enemy.figure.draw({ mode: 'mounted', pose: fall.horse, riderless: fall.riderThrown });
    if (!riderOff) {
      return;
    }
    const { kind, hit } = mount.death!;
    // The sprite faces +x along the way it was going: forwards is that way, backwards the other.
    const { facing } = enemy.figure;
    const { forward } = horseDeathThrow(kind);
    enemy.onUnhorsed?.(enemy.x, hit, {
      health: enemy.currentHealth,
      thrownFrom: forward ? enemy.x - facing : enemy.x + facing,
      force: forward ? RIDER_OFF_FORCE.forward : RIDER_OFF_FORCE.back,
    });
  }

  /**
   * The riderless horse: stands a moment, turns away and gallops off the far edge, then is drawn no more; in a vortex's
   * reach it struggles on against the wind.
   */
  private updateBolt(bolt: { delayMs: number; gone: boolean }, deltaMs: number): void {
    const { enemy } = this;
    if (bolt.gone) {
      return;
    }
    if (bolt.delayMs > 0) {
      bolt.delayMs = Math.max(0, bolt.delayMs - deltaMs);
      this.clockMs += deltaMs;
      this.draw('stand', { thrust: 0 }, true);
      return;
    }
    const step = (enemy.speed * HORSE_BOLT.speedFactor * enemy.afflictions.headwind * deltaMs) / 1000;
    enemy.x += step;
    enemy.y = groundAt(Math.min(enemy.x, WORLD_WIDTH));
    enemy.figure.face(1);
    this.stride('gallop', step);
    if (enemy.x > WORLD_WIDTH + HORSE_BOLT.beyondEdge) {
      bolt.gone = true;
      enemy.figure.body.clear();
      enemy.afflictions.art.clear();
      return;
    }
    this.draw('gallop', { thrust: 0 }, true);
  }

  /** Done for good (the bolting horse gone, the dead one at rest); undefined while neither bolting nor dying. */
  public get settled(): boolean | undefined {
    const { mount } = this;
    if (mount.bolting) {
      return mount.bolting.gone;
    }
    if (mount.death) {
      return mount.deathSettled;
    }
    return undefined;
  }

  /** The rider's head and torso, the horse's body, neck, head and legs, in world space (undefined before it's drawn). */
  public hitZones(): HitBox[] | undefined {
    if (!this.pose) {
      return undefined;
    }
    const transform = this.enemy.figure.transform();
    const unit = Math.abs(transform.scaleX) * transform.scale;
    return mountedHitZones(this.pose).map(({ points, padding, headshot, part, leg }) => ({
      bounds: boundsAround(points.map((point) => spriteToWorld(point, transform)), padding * unit),
      headshot,
      part,
      leg,
    }));
  }

  /** The horse's back (croup to withers), where stuck arrows follow it. */
  public torso(): Torso | undefined {
    return this.pose && { hip: this.pose.croup, shoulder: this.pose.withers };
  }
}
