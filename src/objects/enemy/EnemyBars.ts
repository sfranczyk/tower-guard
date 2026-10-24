import { Graphics } from 'pixi.js';
import { drawHealthBar, drawLevelStars } from '../../rendering/healthBar';

/** Health bar size and placement in container space (the container is drawn at 2/3 scale): just under the feet. */
const HEALTH_BAR = { width: 30, height: 4, belowFeet: 15 };
/** The priest's mana bar, just under its health bar. */
const MANA_BAR = { height: 2.5, gap: 1.5, color: 0x5b8cff, drainedColor: 0x4a5266 };
/** A mounted knight's horse's health bar, under his, in this colour. */
const HORSE_BAR = { height: 3, gap: 1.5, color: 0xc8935a };
/** The player's soldiers' health is blue (red once low), so they read apart from the enemies in a melee. */
const ALLY_BAR = { color: 0x5fb4ff, lowBelow: 0.3 };

/** The bars under an enemy's feet: its health, a mounted knight's horse's health under it, or a priest's mana. */
export class EnemyBars {
  /** The health bar (the others hang under it); added to the enemy's container. */
  public readonly health = new Graphics();
  private readonly horse?: Graphics;
  private readonly mana?: Graphics;
  /** MOBA: the minion's level (stars under the bars). */
  private readonly stars = new Graphics();
  /** MOBA: its team's colour instead of green-to-red (red minions), as the soldiers' blue. */
  public teamColor?: number;

  public constructor(size: number, horse: boolean, mana: boolean, private readonly ally = false) {
    if (horse) {
      this.horse = new Graphics();
      this.horse.y = HEALTH_BAR.height / 2 + 1 + HORSE_BAR.gap + HORSE_BAR.height / 2 + 1;
      this.health.addChild(this.horse);
    }
    if (mana) {
      this.mana = new Graphics();
      this.health.addChild(this.mana);
    }
    this.health.addChild(this.stars);
    // The health bar keeps its normal size on big enemies.
    this.health.scale.set(1 / size);
  }

  /** Dark track, fill from green (full) through yellow to red (low; a soldier's blue until low); the horse's in its own colour. */
  public draw(ratio: number, horseRatio?: number): void {
    const fixed = this.teamColor ?? (this.ally ? ALLY_BAR.color : undefined);
    drawHealthBar(this.health, ratio, HEALTH_BAR.width, HEALTH_BAR.height, fixed !== undefined && ratio > ALLY_BAR.lowBelow ? fixed : undefined);
    if (this.horse && horseRatio !== undefined) {
      drawHealthBar(this.horse, horseRatio, HEALTH_BAR.width, HORSE_BAR.height, HORSE_BAR.color);
    }
  }

  /** MOBA: `count` stars under the bars (a minion's level − 1). */
  public setStars(count: number): void {
    drawLevelStars(this.stars, count, HEALTH_BAR.height / 2 + 6 + (this.horse || this.mana ? 5 : 0));
  }

  /** The priest's mana under the health bar; greyed while drained (it can't cast until it refills). */
  public drawMana(ratio: number, drained = false): void {
    if (!this.mana) {
      return;
    }
    const { width } = HEALTH_BAR;
    const top = HEALTH_BAR.height / 2 + 1 + MANA_BAR.gap;
    this.mana.clear()
      .rect(-width / 2 - 1, top, width + 2, MANA_BAR.height + 2).fill({ color: 0x1b1a20, alpha: 0.85 })
      .rect(-width / 2, top + 1, width * ratio, MANA_BAR.height).fill({ color: drained ? MANA_BAR.drainedColor : MANA_BAR.color });
  }

  /** Keeps the bars under the feet (standing, mounted, lying or thrown: they go where the enemy goes). */
  public place(): void {
    this.health.position.set(0, HEALTH_BAR.belowFeet);
  }
}
