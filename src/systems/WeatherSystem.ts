import { Graphics, type Container } from 'pixi.js';
import { GAME_HEIGHT, GAME_WIDTH, GROUND_Y, LIGHTNING_FIRST_DELAY_MS, LIGHTNING_GROUND_CHANCE, LIGHTNING_WARNING_MS, WORLD_WIDTH } from '../config';
import type { Background } from '../rendering/Background';
import { Rain } from '../rendering/Rain';
import type { Vec2 } from '../types';
import { createBolt, planStrike, type Bolt, type StrikePlan } from './lightning';

export interface WeatherEvents {
  /** A bolt hit the ground here (the scene applies damage and effects). */
  groundStrike(point: Vec2): void;
  /** Thunder for a strike at `at`; `close` for ground strikes, distant rumble for sky flashes. */
  thunder(at: Vec2, close: boolean): void;
}

type DrawnBolt = { graphics: Graphics; ageMs: number; flash: number };
type PendingStrike = { start: Vec2; target: Vec2; leftMs: number; marker: Graphics };

/** How long a bolt stays on screen (it flickers, then fades). */
const BOLT_LIFE_MS = 450;
const GROUND_FLASH = 0.42;
const SKY_FLASH = 0.16;

/** Bolt brightness over its life: on, a dark flicker, on again, then fading out. */
const flicker = (ageMs: number): number => {
  if (ageMs < 70) {
    return 1;
  }
  if (ageMs < 120) {
    return 0.2;
  }
  if (ageMs < 190) {
    return 1;
  }
  return Math.max(0, 1 - (ageMs - 190) / (BOLT_LIFE_MS - 190));
};

const random = (min: number, max: number): number => min + Math.random() * (max - min);

/**
 * Storm weather: light rain, and now and then a bolt flashes between the clouds, and sometimes one comes down to
 * the ground. Ground strikes crackle at the spot for LIGHTNING_WARNING_MS first so they can be
 * dodged. Bolts are drawn in the world; the sky flash is a screen-wide overlay.
 */
export class WeatherSystem {
  private readonly flashOverlay: Graphics;
  private readonly rain: Rain;
  private readonly bolts: DrawnBolt[] = [];
  private pending?: PendingStrike;
  private plan: StrikePlan = { delayMs: LIGHTNING_FIRST_DELAY_MS, reachesGround: Math.random() < LIGHTNING_GROUND_CHANCE };
  private waitMs = LIGHTNING_FIRST_DELAY_MS;

  public constructor(
    private readonly world: Container,
    screen: Container,
    private readonly background: Background,
    private readonly events: WeatherEvents,
  ) {
    this.rain = new Rain(screen);
    this.flashOverlay = new Graphics().rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0xe6eeff });
    this.flashOverlay.alpha = 0;
    this.flashOverlay.zIndex = 100;
    screen.addChild(this.flashOverlay);
  }

  public update(deltaMs: number, cameraX: number): void {
    this.rain.update(deltaMs, cameraX);
    this.waitMs -= deltaMs;
    if (!this.pending && this.waitMs <= 0) {
      this.trigger(this.plan, cameraX);
      this.plan = planStrike(Math.random);
      this.waitMs = this.plan.delayMs;
    }
    this.updatePending(deltaMs);

    let flash = 0;
    for (let index = this.bolts.length - 1; index >= 0; index -= 1) {
      const bolt = this.bolts[index];
      bolt.ageMs += deltaMs;
      const brightness = flicker(bolt.ageMs);
      bolt.graphics.alpha = brightness;
      flash = Math.max(flash, bolt.flash * brightness);
      if (bolt.ageMs >= BOLT_LIFE_MS) {
        bolt.graphics.destroy();
        this.bolts.splice(index, 1);
      }
    }
    this.flashOverlay.alpha = flash;
  }

  private trigger(plan: StrikePlan, cameraX: number): void {
    const view = { left: cameraX, right: cameraX + GAME_WIDTH };
    if (plan.reachesGround) {
      const target = { x: Math.min(WORLD_WIDTH - 20, Math.max(20, random(view.left + 60, view.right - 60))), y: GROUND_Y };
      const startX = target.x + random(-70, 70);
      const marker = new Graphics();
      marker.zIndex = 1;
      this.world.addChild(marker);
      this.pending = { start: { x: startX, y: this.cloudBaseAt(startX) }, target, leftMs: LIGHTNING_WARNING_MS, marker };
      return;
    }
    // Sky flash: a short bolt sideways between clouds, a dim flash and distant thunder.
    const startX = random(view.left + 80, view.right - 80);
    const start = { x: startX, y: this.cloudBaseAt(startX) - random(10, 30) };
    const end = { x: start.x + random(90, 220) * (Math.random() < 0.5 ? -1 : 1), y: start.y + random(15, 60) };
    this.addBolt(createBolt(start, end, Math.floor(Math.random() * 1e9)), SKY_FLASH, 0.7);
    this.events.thunder(start, false);
  }

  /** Crackling sparks at the target until the bolt comes down. */
  private updatePending(deltaMs: number): void {
    const pending = this.pending;
    if (!pending) {
      return;
    }
    pending.leftMs -= deltaMs;
    const { marker, target } = pending;
    const charge = 1 - Math.max(0, pending.leftMs) / LIGHTNING_WARNING_MS;
    marker.clear();
    marker.ellipse(target.x, target.y + 2, 14 + 14 * charge, 3 + 2 * charge).fill({ color: 0x9ec5ff, alpha: 0.12 + 0.25 * charge });
    for (let index = 0; index < 3; index += 1) {
      if (Math.random() < 0.35 + 0.5 * charge) {
        const x = target.x + random(-16, 16);
        marker.moveTo(x, target.y).lineTo(x + random(-5, 5), target.y - random(4, 10 + 14 * charge))
          .stroke({ width: 1.2, color: 0xdbe8ff, alpha: 0.85 });
      }
    }
    if (pending.leftMs > 0) {
      return;
    }
    marker.destroy();
    this.pending = undefined;
    this.addBolt(createBolt(pending.start, target, Math.floor(Math.random() * 1e9)), GROUND_FLASH, 1);
    this.events.groundStrike(target);
    this.events.thunder(target, true);
  }

  private addBolt(bolt: Bolt, flash: number, thickness: number): void {
    const graphics = new Graphics();
    graphics.zIndex = 1;
    const stroke = (points: Vec2[], width: number, color: number, alpha: number): void => {
      graphics.moveTo(points[0].x, Math.min(GROUND_Y, points[0].y));
      points.slice(1).forEach((point) => graphics.lineTo(point.x, Math.min(GROUND_Y, point.y)));
      graphics.stroke({ width: width * thickness, color, alpha, cap: 'round', join: 'round' });
    };
    bolt.branches.forEach((branch) => {
      stroke(branch, 4, 0x8fb8ff, 0.22);
      stroke(branch, 1.1, 0xeef4ff, 0.9);
    });
    stroke(bolt.trunk, 9, 0x8fb8ff, 0.25);
    stroke(bolt.trunk, 3.6, 0xc9dcff, 0.7);
    stroke(bolt.trunk, 1.6, 0xffffff, 1);
    this.world.addChild(graphics);
    this.bolts.push({ graphics, ageMs: 0, flash });
  }

  /**
   * Bolts come out of the storm deck: the highest cloud over `x` (lower ragged bands hang in front
   * of it), or a default height between clouds.
   */
  private cloudBaseAt(x: number): number {
    const over = this.background.cloudSpots().filter((cloud) => Math.abs(cloud.x - x) < cloud.width * 0.45);
    return over.length > 0 ? Math.min(...over.map((cloud) => cloud.y)) - 6 : 120;
  }
}
