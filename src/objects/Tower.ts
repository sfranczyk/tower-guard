import { Sprite, Texture } from 'pixi.js';

export const TOWER_HEIGHT = 203;

export default class Tower extends Sprite {
  public readonly maxHealth: number;
  private health: number;
  private readonly groundY: number;
  private damageFlashMs = 0;

  public constructor(x: number, y: number, texture: Texture, health = 100) {
    super(texture);

    this.maxHealth = Math.max(1, health);
    this.health = this.maxHealth;
    this.groundY = y;
    this.anchor.set(0.5, 1);
    this.scale.set(0.42, 1.0667);
    this.position.set(x, y);
    this.zIndex = 1;
    this.updateDurabilityVisual();
  }

  public update(): void {
    this.y = this.groundY;
    this.damageFlashMs = Math.max(0, this.damageFlashMs - 16);
    this.alpha = this.damageFlashMs > 0 ? 0.72 + Math.sin(this.damageFlashMs / 18) * 0.2 : 1;
  }

  public takeDamage(amount: number): number {
    if (this.isDestroyed()) {
      return this.health;
    }

    this.health = Math.max(0, this.health - Math.max(0, amount));
    this.damageFlashMs = 140;
    this.updateDurabilityVisual();
    return this.health;
  }

  public getHealth(): number {
    return this.health;
  }

  public getHealthRatio(): number {
    return this.health / this.maxHealth;
  }

  public isDestroyed(): boolean {
    return this.health <= 0;
  }

  private updateDurabilityVisual(): void {
    const ratio = this.getHealthRatio();
    if (ratio <= 0) {
      this.tint = 0x4a4a4a;
      return;
    }
    if (ratio <= 0.33) {
      this.tint = 0x7a6e67;
      return;
    }
    if (ratio <= 0.66) {
      this.tint = 0x6a7fa5;
      return;
    }
    this.tint = 0xffffff;
  }
}
