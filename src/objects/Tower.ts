import { Container, Graphics } from 'pixi.js';
import { drawHealthBar } from '../rendering/healthBar';
import { KEEP_BASE, KEEP_FIRE_SPOT, KEEP_SMOKE_SPOT, KEEP_TURRET, drawKeep, keepHitParts } from '../rendering/keep';
import { segmentHitTime, type AxisBounds } from '../systems/collision';
import type { Vec2 } from '../types';
import { keepDamageStage, keepTones, type KeepDamage, type KeepTones } from '../rendering/keepStyle';

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
  /** Co-op: a second, lower tower for the second bowman to hide in. */
  twin?: boolean;
  /** Health bar above it (default on; the menu's backdrop keeps have none). */
  showHealth?: boolean;
}

/** Health bar above the keep (like the enemies'), in world px. */
const HEALTH_BAR = { width: 86, height: 8, y: -224 };

/** Stone chips knocked off by a hit: how many (by damage), how they fly and how long they lie before fading. */
const CHIPS = { min: 3, max: 16, perDamage: 1 / 6, gravity: 900, bounce: 0.3, lifeMs: { min: 1400, max: 2200 }, fadeMs: 400 };

interface Chip {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spin: number;
  angle: number;
  color: number;
  lifeMs: number;
  ageMs: number;
}

const random = (min: number, max: number): number => min + Math.random() * (max - min);

/** A hidden bowman's feet in the main tower: this far below the top of the drawing, behind the parapet. */
const HIDE_BELOW_TOP = 34;
/** In the lower tower: this far below the top of its cornice (as deep as in the main tower). */
const HIDE_BELOW_CORNICE = 5;

/**
 * A keep with health. The flat-style drawing (rendering/keep.ts) is redrawn only when the damage stage
 * changes; the torch flame, and at the last stage fire and smoke, are animated every frame. A hit knocks grey
 * stone chips off where it lands; a health bar sits above it; hits follow its silhouette (`hitTime`).
 */
export default class Tower extends Container {
  public readonly maxHealth: number;
  private health: number;
  private readonly groundY: number;
  private readonly body = new Graphics();
  private readonly flames = new Graphics();
  private readonly smoke = new Graphics();
  private readonly options: KeepOptions;
  private readonly tones: KeepTones;
  /** Chips and the health bar, in the keep's own (unscaled) space: origin at its bottom centre on the ground. */
  private readonly chipsArt = new Graphics();
  private readonly healthBar = new Graphics();
  private chips: Chip[] = [];
  private damage: KeepDamage = 0;
  private drawn = false;
  private timeMs = 0;

  /** `currentHealth` lets a keep start a wave already damaged (health carries over between waves). */
  public constructor(x: number, y: number, options: KeepOptions, health = 100, currentHealth = health) {
    super();
    this.options = options;
    this.tones = keepTones(options.hillColor);
    this.maxHealth = Math.max(1, health);
    this.health = Math.max(0, Math.min(this.maxHealth, currentHealth));
    this.groundY = y;
    // Drawing space → world: bottom centre of the keep at (x, y).
    const art = new Container();
    art.addChild(this.body, this.flames, this.smoke);
    art.position.set(-KEEP_BASE.x * KEEP_SCALE, -KEEP_BASE.y * KEEP_SCALE);
    art.scale.set(KEEP_SCALE);
    this.healthBar.position.set(0, HEALTH_BAR.y);
    this.healthBar.visible = options.showHealth ?? true;
    this.addChild(art, this.chipsArt, this.healthBar);
    this.position.set(x, y);
    this.zIndex = 1;
    this.redraw();
  }

  public update(deltaMs = 16): void {
    this.y = this.groundY;
    this.timeMs += deltaMs;
    this.drawFlames();
    this.updateChips(deltaMs);
  }

  /** Takes a hit (at a world point, where the chips fly off; somewhere on its enemy-facing side if not given). */
  public takeDamage(amount: number, at?: Vec2): number {
    if (this.isDestroyed()) {
      return this.health;
    }
    this.health = Math.max(0, this.health - Math.max(0, amount));
    this.knockChips(amount, at);
    this.redraw();
    return this.health;
  }

  /** The keep's silhouette in world space (rendering/keep.ts `keepHitParts`). */
  public hitParts(): AxisBounds[] {
    const { x, groundY } = this;
    return keepHitParts(this.options.twin).map((part) => ({
      left: x + (part.left - KEEP_BASE.x) * KEEP_SCALE,
      right: x + (part.right - KEEP_BASE.x) * KEEP_SCALE,
      top: groundY + (part.top - KEEP_BASE.y) * KEEP_SCALE,
      bottom: groundY + (part.bottom - KEEP_BASE.y) * KEEP_SCALE,
    }));
  }

  /** When (0..1 along it) the segment `start → start + travel` first hits the keep's silhouette, if it does. */
  public hitTime(start: Vec2, travel: Vec2): number | undefined {
    return this.hitParts()
      .map((part) => segmentHitTime(start, travel, part))
      .filter((time): time is number => time !== undefined)
      .sort((first, second) => first - second)[0];
  }

  /**
   * Where a bowman hiding in the keep stands (world, feet): the main tower for the first, the lower second
   * tower (co-op keep) for the second.
   */
  public hideSpot(index: number): Vec2 {
    if (index > 0 && this.options.twin) {
      return {
        x: this.x + ((KEEP_TURRET.left + KEEP_TURRET.right) / 2 - KEEP_BASE.x) * KEEP_SCALE,
        y: this.groundY - (KEEP_BASE.y - KEEP_TURRET.cornice) * KEEP_SCALE + HIDE_BELOW_CORNICE,
      };
    }
    return { x: this.x, y: this.groundY - TOWER_HEIGHT + HIDE_BELOW_TOP };
  }

  /** Co-op guest: the health the host's keep has (damage stage follows). */
  public setHealth(health: number): void {
    const next = Math.max(0, Math.min(this.maxHealth, health));
    if (next < this.health) {
      this.knockChips(this.health - next);
    }
    this.health = next;
    this.redraw();
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

  /** Grey stone chips fly off where it was hit (more for a harder hit), bounce on the ground and fade. */
  private knockChips(amount: number, at?: Vec2): void {
    const count = Math.round(Math.max(CHIPS.min, Math.min(CHIPS.max, CHIPS.min + amount * CHIPS.perDamage)));
    // Somewhere on the side facing the enemies (the player's keep faces right, the enemy keep left).
    const side = this.options.enemy ? -1 : 1;
    const local = at
      ? { x: at.x - this.x, y: at.y - this.groundY }
      : { x: side * random(25, 45), y: -random(20, 160) };
    const outward = Math.sign(local.x) || side;
    const { base, shade, deep, cap } = this.tones;
    const colors = [base, shade, deep, cap, 0x8a8a86];
    for (let index = 0; index < count; index += 1) {
      this.chips.push({
        x: local.x + random(-4, 4),
        y: local.y + random(-4, 4),
        vx: outward * random(30, 150),
        vy: -random(40, 170),
        size: random(1.5, 3.6),
        spin: random(-12, 12),
        angle: random(0, Math.PI),
        color: colors[Math.floor(Math.random() * colors.length)],
        lifeMs: random(CHIPS.lifeMs.min, CHIPS.lifeMs.max),
        ageMs: 0,
      });
    }
  }

  private updateChips(deltaMs: number): void {
    const seconds = deltaMs / 1000;
    this.chips = this.chips.filter((chip) => {
      chip.ageMs += deltaMs;
      if (chip.ageMs >= chip.lifeMs) {
        return false;
      }
      chip.vy += CHIPS.gravity * seconds;
      chip.x += chip.vx * seconds;
      chip.y += chip.vy * seconds;
      chip.angle += chip.spin * seconds;
      // The keeps stand on flat ground: bounce a little, then lie still.
      if (chip.y >= -chip.size / 2 && chip.vy > 0) {
        chip.y = -chip.size / 2;
        chip.vy = Math.abs(chip.vy) > 60 ? -chip.vy * CHIPS.bounce : 0;
        chip.vx *= 0.5;
        chip.spin *= 0.5;
        if (chip.vy === 0) {
          chip.vx = 0;
          chip.spin = 0;
        }
      }
      return true;
    });
    const art = this.chipsArt;
    art.clear();
    this.chips.forEach((chip) => {
      const fade = Math.min(1, (chip.lifeMs - chip.ageMs) / CHIPS.fadeMs);
      const cos = Math.cos(chip.angle) * chip.size;
      const sin = Math.sin(chip.angle) * chip.size;
      art.poly([chip.x + cos, chip.y + sin, chip.x - sin * 0.8, chip.y + cos * 0.8, chip.x - cos, chip.y - sin, chip.x + sin * 0.7, chip.y - cos * 0.7])
        .fill({ color: chip.color, alpha: fade });
    });
  }

  private drawHealthBar(): void {
    drawHealthBar(this.healthBar, this.getHealthRatio(), HEALTH_BAR.width, HEALTH_BAR.height);
  }

  private redraw(): void {
    this.drawHealthBar();
    const damage = keepDamageStage(this.getHealthRatio());
    if (this.drawn && damage === this.damage) {
      return;
    }
    this.drawn = true;
    this.damage = damage;
    drawKeep(this.body, { tones: this.tones, enemy: this.options.enemy, damage, twin: this.options.twin });
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
