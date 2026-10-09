import { Graphics } from 'pixi.js';
import { drawHealthBar } from '../../rendering/healthBar';
import { getFallPose } from '../../rendering/stickmanFall';
import { fallProgress, type FallState } from './enemyFall';

/** Health bar size and placement in container space (the container is drawn at 2/3 scale). */
const HEALTH_BAR = { width: 30, height: 4, standingY: -68, aboveHead: 14 };
/** The priest's mana bar, just under its health bar. */
const MANA_BAR = { height: 2.5, gap: 1.5, color: 0x5b8cff };
/** A mounted knight's health bar sits this much higher (over the rider's head); the horse's is under it, this colour. */
const MOUNTED_BAR_RISE = 24;
const HORSE_BAR = { height: 3, gap: 1.5, color: 0xc8935a };

/** The bars over an enemy's head: its health, a mounted knight's horse's health under it, or a priest's mana. */
export class EnemyBars {
  /** The health bar (the others hang under it); added to the enemy's container. */
  public readonly health = new Graphics();
  private readonly horse?: Graphics;
  private readonly mana?: Graphics;

  public constructor(size: number, horse: boolean, mana: boolean) {
    if (horse) {
      this.horse = new Graphics();
      this.horse.y = HEALTH_BAR.height / 2 + 1 + HORSE_BAR.gap + HORSE_BAR.height / 2 + 1;
      this.health.addChild(this.horse);
    }
    if (mana) {
      this.mana = new Graphics();
      this.health.addChild(this.mana);
    }
    // The health bar keeps its normal size on big enemies.
    this.health.scale.set(1 / size);
  }

  /** Dark track, fill from green (full) through yellow to red (low); the horse's in its own colour. */
  public draw(ratio: number, horseRatio?: number): void {
    drawHealthBar(this.health, ratio, HEALTH_BAR.width, HEALTH_BAR.height);
    if (this.horse && horseRatio !== undefined) {
      drawHealthBar(this.horse, horseRatio, HEALTH_BAR.width, HORSE_BAR.height, HORSE_BAR.color);
    }
  }

  /** The priest's mana under the health bar. */
  public drawMana(ratio: number): void {
    if (!this.mana) {
      return;
    }
    const { width } = HEALTH_BAR;
    const top = HEALTH_BAR.height / 2 + 1 + MANA_BAR.gap;
    this.mana.clear()
      .rect(-width / 2 - 1, top, width + 2, MANA_BAR.height + 2).fill({ color: 0x1b1a20, alpha: 0.85 })
      .rect(-width / 2, top + 1, width * ratio, MANA_BAR.height).fill({ color: MANA_BAR.color });
  }

  /** Keeps the bars above the head (of `body`, the drawn sprite), also while knocked down and getting up. */
  public place(body: Graphics, rides: boolean, fall?: FallState): void {
    if (!fall) {
      this.health.position.set(0, HEALTH_BAR.standingY - (rides ? MOUNTED_BAR_RISE : 0));
      return;
    }
    const { head } = getFallPose(fall.kind, fallProgress(fall));
    this.health.position.set(
      body.x + head.x * body.scale.x,
      body.y + head.y * body.scale.y - HEALTH_BAR.aboveHead,
    );
  }
}
