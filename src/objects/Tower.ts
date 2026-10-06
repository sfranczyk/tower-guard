import { Container, Graphics } from 'pixi.js';
import { KEEP_BASE, KEEP_FIRE_SPOT, KEEP_SMOKE_SPOT, drawKeep } from '../rendering/keep';
import { keepDamageStage, keepTones, type KeepDamage } from '../rendering/keepStyle';

/** The keep is drawn at half size: 200×406 drawing space → ~100×203 in the world. */
const KEEP_SCALE = 0.5;
export const TOWER_HEIGHT = 406 * KEEP_SCALE;

/** Torch flame position in drawing space. */
const TORCH = { x: 130.5, y: 326 };
const SMOKE_PUFFS = 3;
const SMOKE_CYCLE_MS = 2400;

export interface KeepOptions {
  /** Far hill colour of the battleground: the stone is tinted towards it. */
  hillColor: number;
  /** Enemy keep: red banners. */
  enemy: boolean;
}

/**
 * A keep with health. The flat-style drawing (rendering/keep.ts) is redrawn only when the damage stage
 * changes; the torch flame, and at the last stage fire and smoke, are animated every frame.
 */
export default class Tower extends Container {
  public readonly maxHealth: number;
  private health: number;
  private readonly groundY: number;
  private readonly body = new Graphics();
  private readonly flames = new Graphics();
  private readonly smoke = new Graphics();
  private readonly options: KeepOptions;
  private damage: KeepDamage = 0;
  private drawn = false;
  private damageFlashMs = 0;
  private timeMs = 0;

  /** `currentHealth` lets a keep start a wave already damaged (health carries over between waves). */
  public constructor(x: number, y: number, options: KeepOptions, health = 100, currentHealth = health) {
    super();
    this.options = options;
    this.maxHealth = Math.max(1, health);
    this.health = Math.max(0, Math.min(this.maxHealth, currentHealth));
    this.groundY = y;
    // Drawing space → world: bottom centre of the keep at (x, y).
    const art = new Container();
    art.addChild(this.body, this.flames, this.smoke);
    art.position.set(-KEEP_BASE.x * KEEP_SCALE, -KEEP_BASE.y * KEEP_SCALE);
    art.scale.set(KEEP_SCALE);
    this.addChild(art);
    this.position.set(x, y);
    this.zIndex = 1;
    this.redraw();
  }

  public update(deltaMs = 16): void {
    this.y = this.groundY;
    this.timeMs += deltaMs;
    this.damageFlashMs = Math.max(0, this.damageFlashMs - deltaMs);
    this.alpha = this.damageFlashMs > 0 ? 0.72 + Math.sin(this.damageFlashMs / 18) * 0.2 : 1;
    this.drawFlames();
  }

  public takeDamage(amount: number): number {
    if (this.isDestroyed()) {
      return this.health;
    }
    this.health = Math.max(0, this.health - Math.max(0, amount));
    this.damageFlashMs = 140;
    this.redraw();
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

  private redraw(): void {
    const damage = keepDamageStage(this.getHealthRatio());
    if (this.drawn && damage === this.damage) {
      return;
    }
    this.drawn = true;
    this.damage = damage;
    drawKeep(this.body, { tones: keepTones(this.options.hillColor), enemy: this.options.enemy, damage });
  }

  /** Flickering torch; at the last stage fire in the arrow slit and smoke rising from the top. */
  private drawFlames(): void {
    const flicker = 1 + Math.sin(this.timeMs / 70) * 0.12 + Math.sin(this.timeMs / 31) * 0.06;
    const flames = this.flames;
    flames.clear();
    flames.ellipse(TORCH.x, TORCH.y, 3.5 * flicker, 5 * flicker).fill({ color: 0xff9a2e });
    flames.ellipse(TORCH.x, TORCH.y - 1, 1.8, 3 * flicker).fill({ color: 0xffe27a });
    this.smoke.clear();
    if (this.damage < 3) {
      return;
    }
    flames.ellipse(KEEP_FIRE_SPOT.x, KEEP_FIRE_SPOT.y, 5 * flicker, 8 * flicker).fill({ color: 0xff8a2a });
    flames.ellipse(KEEP_FIRE_SPOT.x, KEEP_FIRE_SPOT.y + 2, 2.6, 4.5 * flicker).fill({ color: 0xffe27a });
    for (let index = 0; index < SMOKE_PUFFS; index += 1) {
      const t = ((this.timeMs / SMOKE_CYCLE_MS) + index / SMOKE_PUFFS) % 1;
      const x = KEEP_SMOKE_SPOT.x + (index - 1) * 14 + Math.sin(t * Math.PI * 2 + index) * 4;
      this.smoke.circle(x, KEEP_SMOKE_SPOT.y - t * 40, 8 + t * 8).fill({ color: 0x5f6470, alpha: 0.5 * (1 - t) });
    }
  }
}
