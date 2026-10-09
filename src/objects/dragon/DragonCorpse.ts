import type { Graphics } from 'pixi.js';
import type { DragonPose } from '../../rendering/dragon';
import { drawDragon } from '../../rendering/dragonArt';
import { DRAGON_HIT_MS, dragonFallState, drawThrownRider, lyingDragonPose, riderGibSimulation } from '../../rendering/dragonDeath';
import { DragonGibSimulation } from '../../rendering/dragonGibs';
import { drawHumanoid } from '../../rendering/designs/skinKit';
import { drawLookGibs } from '../../rendering/designs/lookGibs';
import type { GibSimulation } from '../../rendering/stickmanGibs';
import { RIDER_GIB_COLORS, thrownRiderLook, type DragonLook } from './dragonKinds';

/**
 * After this long (ms) a dragon's death is over: it has dropped from its altitude and lies flat, and the thrown rider
 * has tumbled and come to rest (each takes well under half of it).
 */
const DRAGON_SETTLE_MS = 6000;
/** Force range of the rider's explosive death (like enemies blown apart). */
const RIDER_GIB_FORCE = { min: 1, max: 1.7 };

/**
 * A killed dragon (rendering/dragonDeath.ts): it falls in "death space", the dragon's own sprite space with the ground
 * at GIB_GROUND_Y, where its origin started at `startY` (from its height above the ground). Wings frozen in the pose it
 * was killed in, it drops tipping nose-down and settles flat; the rider is thrown off, or blown apart by a direct
 * explosive hit (and the fire dragon, its burning gut going up with it, bursts into chunks).
 */
export class DragonCorpse {
  private timeMs = 0;
  private readonly riderGibs?: GibSimulation;
  private readonly dragonGibs?: DragonGibSimulation;

  public constructor(
    private readonly pose: DragonPose,
    private readonly startY: number,
    private readonly look: DragonLook,
    blast: { breathesFire: boolean } | undefined,
  ) {
    if (blast) {
      const force = RIDER_GIB_FORCE.min + Math.random() * (RIDER_GIB_FORCE.max - RIDER_GIB_FORCE.min);
      const seed = Math.floor(Math.random() * 1e9);
      this.riderGibs = riderGibSimulation(pose, startY, seed, force);
      this.dragonGibs = blast.breathesFire ? new DragonGibSimulation(pose, startY, seed, force, look.palette) : undefined;
    }
  }

  /**
   * Nothing in its death moves any more: the dragon lies flat (or its chunks rest) and the thrown rider lies still (or
   * his pieces rest).
   */
  public get settled(): boolean {
    return this.timeMs >= DRAGON_SETTLE_MS && (this.dragonGibs?.settled ?? true) && (this.riderGibs?.settled ?? true);
  }

  /** Advances the death and draws dragon and rider (the art moves, so stuck arrows follow it via toWorld). */
  public draw(art: Graphics, riderArt: Graphics, deltaMs: number): void {
    this.timeMs += deltaMs;
    const { pose, startY } = this;
    art.clear();
    if (this.dragonGibs) {
      // Blown apart: the chunks fly, bounce and settle (death space, drawn so its origin stays where it was hit).
      this.dragonGibs.step(deltaMs);
      art.position.set(0, -startY);
      art.rotation = 0;
      const { bone } = this.look.palette;
      this.dragonGibs.pieces.forEach((piece) => {
        art.poly(DragonGibSimulation.outlineOf(piece).flatMap((point) => [point.x, point.y]))
          .fill({ color: piece.color })
          .stroke({ width: 1.5, color: bone, join: 'round' });
      });
    } else {
      const fall = dragonFallState(DRAGON_HIT_MS + this.timeMs, startY);
      drawDragon(art, lyingDragonPose(pose, fall.lying), false, this.look.palette);
      art.position.set(0, fall.y - startY);
      art.rotation = fall.rotation;
    }
    const riderLook = thrownRiderLook(this.look.rider, this.timeMs);
    if (this.riderGibs) {
      this.riderGibs.step(deltaMs);
      drawLookGibs(riderArt, this.riderGibs, riderLook, RIDER_GIB_COLORS[this.look.rider], -startY);
      riderArt.x = pose.rider.hip.x;
    } else {
      riderArt.clear();
      riderArt.position.set(0, -startY);
      drawThrownRider(riderArt, pose, this.timeMs, startY, (g, rider) => drawHumanoid(g, rider, riderLook));
    }
  }
}
