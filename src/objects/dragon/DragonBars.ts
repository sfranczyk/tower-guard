import { Graphics } from 'pixi.js';
import { drawHealthBar, drawLevelStars } from '../../rendering/healthBar';

const HEALTH_BAR = { width: 70, height: 8, y: 62 };

/** A dragon's health bar under it and, in MOBA, its team colour and level stars (`dragon.bars`, like EnemyBars). */
export class DragonBars {
  public readonly health = new Graphics();
  private readonly stars = new Graphics();
  /** MOBA: the bar in its team's colour (until it runs low). */
  public teamColor?: number;

  public constructor() {
    this.health.addChild(this.stars);
    this.health.position.set(0, HEALTH_BAR.y);
  }

  public draw(ratio: number): void {
    const { width, height } = HEALTH_BAR;
    drawHealthBar(this.health, ratio, width, height, this.teamColor !== undefined && ratio > 0.3 ? this.teamColor : undefined);
  }

  /** MOBA: its level as stars under the health bar (level − 1). */
  public setStars(count: number): void {
    drawLevelStars(this.stars, count, HEALTH_BAR.height / 2 + 6);
  }

  /** Keeps its size and reads the right way while the dragon is scaled and mirrored. */
  public unscale(scaleX: number, scaleY: number): void {
    this.health.scale.set(1 / scaleX, 1 / scaleY);
  }
}
