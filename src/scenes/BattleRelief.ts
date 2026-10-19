import type { Container } from 'pixi.js';
import { ALLIES, RELIEF } from '../config';
import { getEnemyStats } from '../data/enemies';
import Enemy from '../objects/enemy/Enemy';
import { reliefFormation, type ReliefPlace } from '../systems/reliefFormation';
import { groundAt } from '../systems/terrain';

type Marcher = { soldier: Enemy; place: ReliefPlace };

/**
 * The relief force at the end of a held survival level (`arrive`): knights, squires and medics march in from beyond the
 * left edge (systems/reliefFormation.ts) at an ordinary walk, all at the slowest one's pace, and form up in front of the
 * keep; the squires and medics cheer (stragglers or not, RELIEF.waitMs after the march should have ended), the knights
 * stand still. The end screen doesn't wait for them ("View battlefield" to watch). Only for show: they aren't in the battle (no AI, nothing hits them), and each
 * browser marches its own (a co-op guest's comes when its clock, the host's, runs out).
 */
export class BattleRelief {
  private marchers: Marcher[] = [];
  private waitedMs = 0;
  /** When to stop waiting for stragglers: the longest march at their pace, plus RELIEF.waitMs. */
  private maxWaitMs = 0;
  private formed = false;

  public constructor(private readonly world: Container) {}

  public get arrived(): boolean {
    return this.marchers.length > 0;
  }

  public arrive(): void {
    if (this.arrived) {
      return;
    }
    const places = reliefFormation({ ...RELIEF, spawnX: ALLIES.spawnX });
    const pace = Math.min(...places.map((place) => getEnemyStats(place.type, 1).speed));
    const longestMarch = Math.max(0, ...places.map((place) => place.x - place.startX));
    this.maxWaitMs = (longestMarch / pace) * 1000 + RELIEF.waitMs;
    this.marchers = places.map((place) => {
      const soldier = new Enemy(place.startX, getEnemyStats(place.type, 1).health, pace, 'bowman', place.type);
      soldier.bars.health.visible = false;
      // Lower on the screen is nearer: the front rank is drawn over the ones behind it.
      soldier.baseZ = 1 + place.depth / 100;
      soldier.zIndex = soldier.baseZ;
      this.world.addChild(soldier);
      return { soldier, place };
    });
  }

  public update(deltaMs: number): void {
    if (!this.arrived) {
      return;
    }
    this.waitedMs += deltaMs;
    let formed = true;
    this.marchers.forEach(({ soldier, place }) => {
      if (!soldier.isCelebrating) {
        soldier.update(deltaMs, { x: place.x, y: groundAt(place.x) }, 2);
        formed &&= !soldier.isMoving();
      }
      soldier.y = groundAt(soldier.x) + place.depth;
      soldier.updateAnimation(deltaMs, soldier.isMoving());
    });
    this.formed ||= formed || this.waitedMs >= this.maxWaitMs;
    if (!this.formed) {
      return;
    }
    this.marchers.forEach(({ soldier, place }) => {
      soldier.faceTowards(soldier.x + 100);
      if (place.cheers) {
        soldier.celebrate();
      }
    });
  }
}
