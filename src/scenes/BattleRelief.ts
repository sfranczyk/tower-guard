import type { Container } from 'pixi.js';
import { ALLIES, RELIEF } from '../config';
import { getEnemyStats } from '../data/enemies';
import Enemy from '../objects/enemy/Enemy';
import { reliefFormation, type ReliefPlace } from '../systems/reliefFormation';
import { groundAt } from '../systems/terrain';

type Marcher = { soldier: Enemy; place: ReliefPlace };

/**
 * The relief force at the end of a held survival level (`arrive`): knights, squires and medics march in from beyond the
 * left edge (systems/reliefFormation.ts), form up in front of the keep and cheer; after RELIEF.cheerMs of it (at the
 * latest RELIEF.waitMs after they set out) `onFormed`: the end screen. Only for show: they aren't in the battle (no AI, nothing hits them), and each
 * browser marches its own (a co-op guest's comes when its clock, the host's, runs out).
 */
export class BattleRelief {
  private marchers: Marcher[] = [];
  private onFormed?: () => void;
  private waitedMs = 0;
  /** How long they have stood cheering in formation. */
  private cheeredMs?: number;

  public constructor(private readonly world: Container) {}

  public get arrived(): boolean {
    return this.marchers.length > 0;
  }

  public arrive(onFormed?: () => void): void {
    if (this.arrived) {
      return;
    }
    this.onFormed = onFormed;
    this.marchers = reliefFormation({ ...RELIEF, spawnX: ALLIES.spawnX }).map((place) => {
      const soldier = new Enemy(place.startX, getEnemyStats(place.type, 1).health, RELIEF.speed, 'bowman', place.type);
      soldier.bars.health.visible = false;
      // Lower on the screen is nearer: the front rank is drawn over the ones behind it.
      soldier.zIndex = 1 + place.depth / 100;
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
    if (this.cheeredMs === undefined && (formed || this.waitedMs >= RELIEF.waitMs)) {
      this.cheeredMs = 0;
    }
    if (this.cheeredMs === undefined) {
      return;
    }
    this.marchers.forEach(({ soldier }) => {
      soldier.faceTowards(soldier.x + 100);
      soldier.celebrate();
    });
    this.cheeredMs += deltaMs;
    if (this.cheeredMs >= RELIEF.cheerMs || this.waitedMs >= RELIEF.waitMs) {
      const onFormed = this.onFormed;
      this.onFormed = undefined;
      onFormed?.();
    }
  }
}
